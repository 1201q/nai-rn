package expo.modules.generationimagepipeline

import android.app.AppOpsManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import android.os.Process
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
    Events("image", "pipChange", "pipAction")

    OnCreate {
      PipImageHub.onActiveChange = { sendEvent("pipChange", mapOf("active" to it)) }
      PipImageHub.onCancel = { sendEvent("pipAction", mapOf("action" to "cancel")) }
    }

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
    Function("isPipSupported") { isPipSupported() }
    Function("openPip") { width: Int, height: Int ->
      PipImageHub.width = width
      PipImageHub.height = height
      openPip()
    }
    Function("closePip") { PipImageHub.close() }
    // 큐 진행 여부(PiP 취소 액션 노출)와 나가면 자동 PiP 여부를 JS 큐 상태와 동기화한다.
    Function("setPipSession") { generating: Boolean, autoEnter: Boolean, width: Int, height: Int ->
      PipImageHub.autoEnter = autoEnter
      PipImageHub.width = width
      PipImageHub.height = height
      PipImageHub.setGenerating(generating)
      if (!generating && !PipImageHub.active) PipImageHub.latestFrame = null
    }
    Function("setAutoPipSuppressed") { suppressed: Boolean -> PipImageHub.autoSuppressed = suppressed }
    OnUserLeavesActivity { if (PipImageHub.autoEnter && !PipImageHub.autoSuppressed) openPip() }
    OnDestroy {
      requests.values.forEach { it.cancel() }
      PipImageHub.onActiveChange = null
      PipImageHub.onCancel = null
    }
  }

  private fun isPipSupported(): Boolean {
    val context = appContext.reactContext ?: return false
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return false
    if (!context.packageManager.hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE)) return false
    // 시스템 설정의 앱별 PiP 허용 여부.
    val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      appOps.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_PICTURE_IN_PICTURE, Process.myUid(), context.packageName)
    } else {
      @Suppress("DEPRECATION")
      appOps.checkOpNoThrow(AppOpsManager.OPSTR_PICTURE_IN_PICTURE, Process.myUid(), context.packageName)
    }
    return mode == AppOpsManager.MODE_ALLOWED
  }

  private fun openPip() {
    if (PipImageHub.active || !isPipSupported()) return
    val context: Context = appContext.currentActivity ?: appContext.reactContext ?: return
    PipImageHub.setActive(true)
    PipImageHub.expectActivity()
    PipImageHub.latestFrame?.let { PipImageHub.pushFrame(it) }
    try {
      // NO_USER_ACTION: 메인 Activity의 onUserLeaveHint(자동 PiP)를 다시 트리거하지 않게 한다.
      context.startActivity(Intent(context, GenerationPipActivity::class.java).addFlags(
        Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_USER_ACTION or Intent.FLAG_ACTIVITY_NO_ANIMATION,
      ))
    } catch (_: Exception) {
      PipImageHub.setActive(false)
    }
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
              if (now - lastPreviewAt >= 350) {
                lastPreviewAt = now
                val frame = Base64.decode(image, Base64.DEFAULT)
                PipImageHub.latestFrame = frame
                // PiP로 보는 중에는 메인 캔버스가 프리뷰를 그리지 않으므로 JS용 파일 쓰기를 생략한다.
                if (PipImageHub.active) PipImageHub.pushFrame(frame)
                else if (pending.previewEnabled) {
                  previewDir.mkdirs()
                  val file = File(previewDir, "${sequence++}.jpg")
                  file.writeBytes(frame)
                  payload["imageUri"] = Uri.fromFile(file).toString()
                }
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
      PipImageHub.latestFrame = bytes
      PipImageHub.pushFrame(bytes)
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
