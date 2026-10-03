package expo.modules.generationimagepipeline

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Paint
import android.net.Uri
import android.os.SystemClock
import android.util.Base64
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.IOException
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.Call
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

class GenerationImagePipelineModule : Module() {
  internal class Pending(@Volatile var previewEnabled: Boolean) {
    @Volatile var call: Call? = null
    @Volatile var cancelled = false
    @Volatile var saving = false
    @Volatile var previewsReleased = false
    fun cancel() = synchronized(this) {
      if (!saving) { cancelled = true; call?.cancel() }
    }
    fun check() { if (cancelled) throw IOException("NAI_CANCELLED") }
    fun beginSaving() = synchronized(this) { check(); saving = true }
  }

  private val requests = ConcurrentHashMap<String, Pending>()
  private val client = OkHttpClient.Builder()
    .retryOnConnectionFailure(false)
    .followRedirects(false)
    .connectTimeout(30, TimeUnit.SECONDS)
    .readTimeout(120, TimeUnit.SECONDS)
    .build()
  private var previewsInitialized = false

  private fun previewRoot(): File {
    val context = appContext.reactContext ?: error("Application context unavailable")
    return File(context.cacheDir, "nai-stream-previews")
  }

  override fun definition() = ModuleDefinition {
    Name("GenerationImagePipeline")
    Events("image")

    // Register synchronously so immediate AbortSignal cancellation cannot race generate().
    Function("prepare") { id: String, enabled: Boolean ->
      require(id.matches(Regex("gen_[a-zA-Z0-9_]+")))
      check(requests.putIfAbsent(id, Pending(enabled)) == null) { "Duplicate request" }
    }
    Function("cancel") { id: String -> requests[id]?.cancel(); Unit }
    Function("setPreviewEnabled") { id: String, enabled: Boolean -> requests[id]?.previewEnabled = enabled; Unit }
    Function("retainPreviews") { id: String -> requests[id]?.previewsReleased = false; Unit }
    AsyncFunction("releasePreviews") Coroutine { id: String ->
      withContext(Dispatchers.IO) {
        if (id.matches(Regex("gen_[a-zA-Z0-9_]+"))) {
          val pending = requests[id]
          if (pending != null) pending.previewsReleased = true
          if (!requests.containsKey(id)) File(previewRoot(), id).deleteRecursively()
        }
        Unit
      }
    }
    AsyncFunction("generate") Coroutine { id: String, token: String, body: String, originalUri: String, thumbnailUri: String ->
      withContext(Dispatchers.IO) { generate(id, token, body, originalUri, thumbnailUri) }
    }
    OnDestroy { requests.values.forEach { it.cancel() } }
  }

  private fun outputFile(uri: String, id: String, directory: String, extension: String): File {
    val context = appContext.reactContext ?: error("Application context unavailable")
    val parsed = Uri.parse(uri)
    require(parsed.scheme == "file")
    val file = File(requireNotNull(parsed.path)).canonicalFile
    val expected = File(context.filesDir, "nai-images/$directory/$id.$extension").canonicalFile
    require(file == expected) { "Unexpected image output path" }
    return file
  }

  private suspend fun generate(id: String, token: String, body: String, originalUri: String, thumbnailUri: String): Map<String, Any?> {
    val pending = requests[id] ?: error("Request not prepared")
    var original: File? = null
    var thumbnail: File? = null
    var succeeded = false
    val previewDir = File(previewRoot(), id)
    try {
      pending.check()
      synchronized(this) {
        if (!previewsInitialized) {
          // First request in this runtime: remove leftovers from a previous process.
          previewRoot().deleteRecursively()
          previewsInitialized = true
        }
      }
      val originalOutput = outputFile(originalUri, id, "originals", if (originalUri.endsWith(".webp")) "webp" else "png")
      val thumbnailOutput = outputFile(thumbnailUri, id, "grid-thumbnails", "jpg")
      require(!originalOutput.exists() && !thumbnailOutput.exists()) { "Output already exists" }
      original = originalOutput
      thumbnail = thumbnailOutput
      val request = Request.Builder()
        .url("https://image.novelai.net/ai/generate-image-stream")
        .header("Authorization", "Bearer $token")
        .header("Accept", "text/event-stream")
        .post(body.toRequestBody("application/json".toMediaType())).build()
      val call = client.newCall(request)
      pending.call = call
      pending.check()
      var finalBytes: ByteArray? = null
      var finalGenerationId: Double? = null
      var sequence = 0
      var lastPreviewAt = -350L
      call.execute().use { response ->
        if (!response.isSuccessful) {
          // 서버 오류 본문({"message": ...})을 JS로 전달해 원인을 표시한다.
          val body = runCatching { response.body?.string().orEmpty() }.getOrDefault("")
          val detail = runCatching { JSONObject(body).optString("message") }.getOrNull()
            ?.takeIf { it.isNotBlank() } ?: body
          throw IOException("NAI_HTTP_${response.code}:${detail.replace('\n', ' ').take(500)}")
        }
        val responseBody = response.body ?: throw IOException("Empty image response")
        responseBody.charStream().buffered().use { reader ->
          readImageEvents(reader) { event ->
            pending.check()
            val type = event.optString("event_type")
            val generationId = if (event.isNull("gen_id")) null else event.optDouble("gen_id")
            val image = event.optString("image")
            if (type == "error") {
              val detail = event.optString("message").ifBlank { event.optString("error") }.ifBlank { "Image stream failed" }
              throw IOException("NAI_STREAM_ERROR:${detail.replace('\n', ' ').take(500)}")
            }
            if (type == "intermediate" && image.isNotEmpty()) {
              val step = if (event.isNull("step_ix")) null else event.optInt("step_ix")
              val payload = mutableMapOf<String, Any?>("requestId" to id, "type" to type, "step" to step, "generationId" to generationId)
              val now = SystemClock.elapsedRealtime()
              if (pending.previewEnabled && now - lastPreviewAt >= 350) {
                lastPreviewAt = now
                previewDir.mkdirs()
                val file = File(previewDir, "${sequence++}.jpg")
                file.writeBytes(Base64.decode(image, Base64.DEFAULT))
                payload["imageUri"] = Uri.fromFile(file).toString()
              }
              sendEvent("image", payload)
            } else if (type == "final" && image.isNotEmpty()) {
              finalBytes = Base64.decode(image, Base64.DEFAULT)
              finalGenerationId = generationId
            }
          }
        }
      }
      val bytes = finalBytes ?: throw IOException("NovelAI image stream finished without a final image.")
      // Once the response has completed, finish saving even if the queue is cancelled.
      pending.beginSaving()
      original.parentFile?.mkdirs()
      original.writeBytes(bytes)
      sendEvent("image", mapOf("requestId" to id, "type" to "final", "imageUri" to originalUri, "step" to null, "generationId" to finalGenerationId))
      val metadata = pngMetadata(bytes)
      val hasThumbnail = withContext(Dispatchers.Default) { createThumbnail(original, thumbnail) }
      succeeded = true
      return mapOf("originalUri" to originalUri, "thumbnailUri" to if (hasThumbnail) thumbnailUri else null, "metadata" to metadata)
    } catch (error: Exception) {
      if (pending.cancelled) throw IOException("NAI_CANCELLED")
      throw error
    } finally {
      requests.remove(id)
      if (pending.previewsReleased) previewDir.deleteRecursively()
      if (!succeeded) {
        original?.delete()
        thumbnail?.delete()
        previewDir.deleteRecursively()
      }
    }
  }

  private fun createThumbnail(original: File, target: File): Boolean {
    var source: Bitmap? = null
    var scaled: Bitmap? = null
    var flattened: Bitmap? = null
    return try {
      source = BitmapFactory.decodeFile(original.path) ?: return false
      // Aspect-fit: the long side becomes 512px and nothing is cropped.
      val factor = 512.0 / maxOf(source.width, source.height)
      scaled = Bitmap.createScaledBitmap(source, Math.round(source.width * factor).toInt(), Math.round(source.height * factor).toInt(), true)
      // JPEG has no alpha: transparent areas would turn black, so show them on a checkerboard.
      flattened = if (scaled.hasAlpha()) onCheckerboard(scaled) else scaled
      target.parentFile?.mkdirs()
      target.outputStream().use { check(flattened.compress(Bitmap.CompressFormat.JPEG, 90, it)) }
      true
    } catch (_: Exception) {
      target.delete()
      false
    } finally {
      if (flattened !== scaled) flattened?.recycle()
      scaled?.recycle()
      if (source !== scaled) source?.recycle()
    }
  }

  private fun onCheckerboard(image: Bitmap): Bitmap {
    val result = Bitmap.createBitmap(image.width, image.height, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(result)
    val paint = Paint()
    var y = 0
    while (y < image.height) {
      var x = 0
      while (x < image.width) {
        paint.color = if ((x / CHECKER_SIZE + y / CHECKER_SIZE) % 2 == 0) CHECKER_LIGHT else CHECKER_DARK
        canvas.drawRect(x.toFloat(), y.toFloat(), (x + CHECKER_SIZE).toFloat(), (y + CHECKER_SIZE).toFloat(), paint)
        x += CHECKER_SIZE
      }
      y += CHECKER_SIZE
    }
    canvas.drawBitmap(image, 0f, 0f, null)
    return result
  }
}

// Thumbnail checkerboard for transparent images (tile size in thumbnail pixels).
private const val CHECKER_SIZE = 16
private val CHECKER_LIGHT = 0xFF3A3A42.toInt()
private val CHECKER_DARK = 0xFF2A2A30.toInt()
