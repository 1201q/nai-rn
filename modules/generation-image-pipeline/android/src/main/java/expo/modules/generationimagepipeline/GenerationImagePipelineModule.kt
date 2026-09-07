package expo.modules.generationimagepipeline

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.SystemClock
import android.os.Trace
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

  private inline fun <T> traced(name: String, action: () -> T): T {
    Trace.beginSection("nai.native/$name")
    return try { action() } finally { Trace.endSection() }
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
      val originalOutput = outputFile(originalUri, id, "originals", "png")
      val thumbnailOutput = outputFile(thumbnailUri, id, "thumbnails", "jpg")
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
        if (!response.isSuccessful) throw IOException("NAI_HTTP_${response.code}")
        val responseBody = response.body ?: throw IOException("Empty image response")
        responseBody.charStream().buffered().use { reader ->
          readImageEvents(reader, parse = { text -> traced("stream.parse") { JSONObject(text) } }) { event ->
            pending.check()
            val type = event.optString("event_type")
            val generationId = if (event.isNull("gen_id")) null else event.optDouble("gen_id")
            val image = event.optString("image")
            if (type == "error") throw IOException(event.optString("message", event.optString("error", "Image stream failed")))
            if (type == "intermediate" && image.isNotEmpty()) {
              val step = if (event.isNull("step_ix")) null else event.optInt("step_ix")
              val payload = mutableMapOf<String, Any?>("requestId" to id, "type" to type, "step" to step, "generationId" to generationId)
              val now = SystemClock.elapsedRealtime()
              if (pending.previewEnabled && now - lastPreviewAt >= 350) {
                lastPreviewAt = now
                traced("preview.write") {
                  previewDir.mkdirs()
                  val file = File(previewDir, "${sequence++}.jpg")
                  file.writeBytes(Base64.decode(image, Base64.DEFAULT))
                  payload["imageUri"] = Uri.fromFile(file).toString()
                }
              }
              sendEvent("image", payload)
            } else if (type == "final" && image.isNotEmpty()) {
              finalBytes = traced("final.decode") { Base64.decode(image, Base64.DEFAULT) }
              finalGenerationId = generationId
            }
          }
        }
      }
      val bytes = finalBytes ?: throw IOException("NovelAI image stream finished without a final image.")
      // Once the response has completed, finish saving even if the queue is cancelled.
      pending.beginSaving()
      traced("original.write") { original.parentFile?.mkdirs(); original.writeBytes(bytes) }
      sendEvent("image", mapOf("requestId" to id, "type" to "final", "imageUri" to originalUri, "step" to null, "generationId" to finalGenerationId))
      val metadata = traced("metadata") { pngMetadata(bytes) }
      val hasThumbnail = withContext(Dispatchers.Default) { traced("thumbnail") { createThumbnail(original, thumbnail) } }
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
    var cropped: Bitmap? = null
    return try {
      source = BitmapFactory.decodeFile(original.path) ?: return false
      val factor = 512.0 / minOf(source.width, source.height)
      scaled = Bitmap.createScaledBitmap(source, Math.round(source.width * factor).toInt(), Math.round(source.height * factor).toInt(), true)
      cropped = Bitmap.createBitmap(scaled, (scaled.width - 512) / 2, (scaled.height - 512) / 2, 512, 512)
      target.parentFile?.mkdirs()
      target.outputStream().use { check(cropped.compress(Bitmap.CompressFormat.JPEG, 90, it)) }
      true
    } catch (_: Exception) {
      target.delete()
      false
    } finally {
      cropped?.recycle()
      if (scaled !== cropped) scaled?.recycle()
      if (source !== scaled && source !== cropped) source?.recycle()
    }
  }
}
