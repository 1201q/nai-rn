package expo.modules.imageupscaler

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.SystemClock
import android.provider.OpenableColumns
import expo.modules.core.interfaces.DoNotStrip
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.io.File
import java.util.concurrent.ConcurrentHashMap
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext

class UpscaleAdvancedOptions : Record {
  @Field var requestId: String = ""
  @Field var ttaMode: Boolean = false
  @Field var syncGap: Int = 3
  @Field var limitGpuPerformance: Boolean = false
  @Field var useGpu: Boolean = true
  @Field var cpuThreads: Int = 0
  @Field var cpuPolicy: Int = 0
}

internal object NativeUpscaler {
  init { System.loadLibrary("image-upscaler") }

  @JvmStatic external fun upscale(
    realcugan: Boolean, paramPath: String, modelPath: String,
    scale: Int, noise: Int, tileSize: Int, ttaMode: Boolean, syncGap: Int, limitGpuPerformance: Boolean,
    useGpu: Boolean, cpuThreads: Int, cpuPolicy: Int,
    input: Bitmap, output: Bitmap, preview: Bitmap?,
  ): IntArray?

  // MiB, or -1 when no Vulkan GPU is available.
  @JvmStatic external fun gpuHeapBudget(): Long
  @JvmStatic external fun cpuInfo(): IntArray

  // Stops the final pass at the next tile boundary; a no-op when idle.
  @JvmStatic external fun cancel()

  @Volatile var tileListener: ((Int, Int, Int, Int, Int, Int) -> Unit)? = null
  @Volatile var previewNeededListener: ((Int, Int) -> Boolean)? = null
  @Volatile var previewListener: (() -> Unit)? = null
  @DoNotStrip @JvmStatic fun onTile(x: Int, y: Int, w: Int, h: Int, done: Int, total: Int) { tileListener?.invoke(x, y, w, h, done, total) }
  @DoNotStrip @JvmStatic fun needsPreview(completed: Int, height: Int): Boolean = previewNeededListener?.invoke(completed, height) ?: false
  @DoNotStrip @JvmStatic fun onPreview() { previewListener?.invoke() }

}

class ImageUpscalerModule : Module() {
  // One job at a time: the GPU is shared.
  private val mutex = Mutex()
  private val sessions = ConcurrentHashMap<String, UpscalePreviewSession>()
  @Volatile private var foreground = true

  private fun previewRoot() = File(requireNotNull(appContext.reactContext).cacheDir, "upscale-previews")

  override fun definition() = ModuleDefinition {
    Name("ImageUpscaler")
    Events("progress", "preview")

    Function("cancel") { NativeUpscaler.cancel() }

    Function("prepare") { id: String, enabled: Boolean ->
      require(id.matches(Regex("upscale_[a-zA-Z0-9_]+")))
      val session = UpscalePreviewSession(id, previewRoot()) { event, payload -> sendEvent(event, payload) }
      session.enabled = enabled
      check(sessions.putIfAbsent(id, session) == null) { "Duplicate upscale request" }
    }
    Function("setPreviewEnabled") { id: String, enabled: Boolean ->
      sessions[id]?.let { it.enabled = enabled; if (enabled) it.released = false }
      Unit
    }
    Function("acknowledgePreview") { id: String, sequence: Int -> sessions[id]?.acknowledge(sequence); Unit }
    Function("releasePreviews") { id: String ->
      sessions[id]?.let { it.release(); if (it.finished) sessions.remove(id, it) }
      Unit
    }
    OnActivityEntersBackground { foreground = false }
    OnActivityEntersForeground { foreground = true }
    OnCreate {
      // Cache belongs to the previous runtime; no result images live here.
      runCatching { previewRoot().deleteRecursively() }
    }
    OnDestroy {
      NativeUpscaler.cancel()
      sessions.values.forEach { it.release() }
    }

    AsyncFunction("getGpuInfo") Coroutine { ->
      withContext(Dispatchers.Default) {
        mutex.withLock {
          val budget = NativeUpscaler.gpuHeapBudget()
          mapOf("available" to (budget >= 0), "heapBudgetMiB" to budget.takeIf { it >= 0 })
        }
      }
    }

    AsyncFunction("getCpuInfo") Coroutine { ->
      withContext(Dispatchers.Default) {
        mutex.withLock {
          val counts = NativeUpscaler.cpuInfo()
          mapOf("all" to counts[0], "little" to counts[1], "big" to counts[2])
        }
      }
    }

    AsyncFunction("getInputInfo") Coroutine { inputUri: String ->
      withContext(Dispatchers.IO) {
        val context = appContext.reactContext ?: error("Application context unavailable")
        val uri = Uri.parse(inputUri)
        val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        context.contentResolver.openInputStream(uri).use { BitmapFactory.decodeStream(it, null, options) }
        require(options.outWidth > 0 && options.outHeight > 0) { "UNSUPPORTED_IMAGE" }
        val filename = if (uri.scheme == "file") uri.lastPathSegment else runCatching {
          context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) cursor.getString(cursor.getColumnIndexOrThrow(OpenableColumns.DISPLAY_NAME)) else null
          }
        }.getOrNull()
        mapOf("width" to options.outWidth, "height" to options.outHeight, "filename" to filename)
      }
    }

    AsyncFunction("upscale") Coroutine { inputUri: String, model: String, scale: Int, noise: Int, tileSize: Int, format: String, quality: Int, advanced: UpscaleAdvancedOptions ->
      withContext(Dispatchers.Default) {
        mutex.withLock {
          val session = sessions[advanced.requestId]
          try {
            session?.phase("preparing")
            upscale(inputUri, model, scale, noise, tileSize, format, quality, advanced, session)
          } finally {
            NativeUpscaler.tileListener = null
            NativeUpscaler.previewNeededListener = null
            NativeUpscaler.previewListener = null
            session?.let {
              it.bitmap?.recycle()
              it.bitmap = null
              it.finished = true
              // Fast jobs may finish before React ever renders their request.
              // Only a frame acknowledged by the canvas needs a display lease.
              if (it.released || !it.hasAcknowledgedFrame()) { it.release(); sessions.remove(it.id, it) }
            }
          }
        }
      }
    }
  }

  // Model file name for a scale / noise pair, as the upstream main.cpp of each project picks it.
  // Not every pair is bundled; a missing one fails when the asset is opened.
  private fun modelName(model: String, scale: Int, noise: Int) = when (model) {
    "realcugan-se", "realcugan-pro" -> "up${scale}x-" + when (noise) {
      -1 -> "conservative"
      0 -> "no-denoise"
      else -> "denoise${noise}x"
    }
    "waifu2x-cunet" -> when {
      noise == -1 -> "scale2.0x_model"
      scale == 1 -> "noise${noise}_model"
      else -> "noise${noise}_scale2.0x_model"
    }
    else -> error("Unknown model")
  }

  // PNG ignores quality; JPEG and WEBP use the caller's quality.
  @Suppress("DEPRECATION")
  private val formats = mapOf(
    "png" to Bitmap.CompressFormat.PNG,
    "jpg" to Bitmap.CompressFormat.JPEG,
    "webp" to Bitmap.CompressFormat.WEBP,
  )

  // ncnn loads models by file path, so the bundled assets are copied out once.
  private fun modelFile(context: Context, model: String, name: String): File {
    val file = File(context.filesDir, "upscaler-models/$model/$name")
    if (!file.exists()) {
      file.parentFile?.mkdirs()
      val temp = File(file.path + ".tmp")
      context.assets.open("upscaler-models/$model/$name").use { input ->
        temp.outputStream().use { input.copyTo(it) }
      }
      check(temp.renameTo(file)) { "Model copy failed" }
    }
    return file
  }

  private fun upscale(inputUri: String, model: String, scale: Int, noise: Int, tileSize: Int, format: String, quality: Int, advanced: UpscaleAdvancedOptions, session: UpscalePreviewSession?): Map<String, Any> {
    val context = appContext.reactContext ?: error("Application context unavailable")
    val realcugan = model != "waifu2x-cunet"
    require(noise in -1..3 && if (realcugan) scale in 2..4 else scale in 1..2 && (scale == 2 || noise != -1)) { "Unknown model" }
    val name = modelName(model, scale, noise)
    require(tileSize == 0 || tileSize >= 32) { "Invalid tile size" }
    val compressFormat = requireNotNull(formats[format]) { "Unknown format" }
    require(quality in 1..100) { "Invalid image quality" }
    require(advanced.syncGap in 0..3) { "Invalid sync gap" }
    require(advanced.cpuPolicy in 0..2) { "Invalid CPU policy" }
    require(advanced.cpuThreads in 0..1024) { "Invalid CPU threads" }

    val options = BitmapFactory.Options().apply { inPreferredConfig = Bitmap.Config.ARGB_8888 }
    val decoded = context.contentResolver.openInputStream(Uri.parse(inputUri)).use {
      BitmapFactory.decodeStream(it, null, options)
    } ?: error("Image decode failed")
    val input = if (decoded.config == Bitmap.Config.ARGB_8888) decoded
      else decoded.copy(Bitmap.Config.ARGB_8888, false).also { decoded.recycle() }
    // 결과가 16MP를 넘으면 비트맵 메모리가 감당되지 않는다.
    require(input.width.toLong() * input.height * scale * scale <= 4096L * 4096L) { "IMAGE_TOO_LARGE" }

    val output = Bitmap.createBitmap(input.width * scale, input.height * scale, Bitmap.Config.ARGB_8888)
    try {
      val param = modelFile(context, model, "$name.param")
      val bin = modelFile(context, model, "$name.bin")
      // Allocation/encoding are optional; inference must survive preview failures.
      session?.bitmap = runCatching {
        val factor = minOf(1.0, 768.0 / maxOf(input.width, input.height))
        val scaled = Bitmap.createScaledBitmap(input, maxOf(1, (input.width * factor).toInt()), maxOf(1, (input.height * factor).toInt()), true)
        try { scaled.copy(Bitmap.Config.ARGB_8888, true) } finally { if (scaled !== input) scaled.recycle() }
      }.getOrNull()
      NativeUpscaler.tileListener = { x, y, w, h, done, total -> session?.tile(x, y, w, h, done, total) }
      NativeUpscaler.previewNeededListener = { completed, height -> foreground && (session?.needsPreview(completed, height) ?: false) }
      NativeUpscaler.previewListener = { session?.publish() }
      val startedAt = SystemClock.elapsedRealtime()
      val result = NativeUpscaler.upscale(realcugan, param.path, bin.path, scale, noise, tileSize, advanced.ttaMode, advanced.syncGap, advanced.limitGpuPerformance, advanced.useGpu, advanced.cpuThreads, advanced.cpuPolicy, input, output, session?.bitmap)
        ?: error("Upscale failed")
      check(result.isNotEmpty()) { "UPSCALE_CANCELLED" }
      val elapsedMs = SystemClock.elapsedRealtime() - startedAt

      session?.phase("saving")
      // The caller deletes the file once it has saved the result elsewhere.
      val directory = File(context.cacheDir, "upscaled")
      directory.mkdirs()
      val file = File(directory, "upscale_${System.currentTimeMillis()}.$format")
      file.outputStream().use { check(output.compress(compressFormat, quality, it)) }
      return mapOf(
        "uri" to Uri.fromFile(file).toString(),
        "width" to output.width,
        "height" to output.height,
        "bytes" to file.length().toInt(),
        "elapsedMs" to elapsedMs.toInt(),
        "usedGpu" to (result[0] == 1),
        "tileSize" to result[1],
        "cpuThreads" to result[2],
        "cpuPolicy" to result[3],
      )
    } finally {
      input.recycle()
      output.recycle()
    }
  }
}
