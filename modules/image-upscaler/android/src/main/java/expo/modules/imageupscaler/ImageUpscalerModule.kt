package expo.modules.imageupscaler

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.SystemClock
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext

internal object NativeUpscaler {
  init { System.loadLibrary("image-upscaler") }

  @JvmStatic external fun upscale(
    engine: String, paramPath: String, modelPath: String,
    noise: Int, tileSize: Int, input: Bitmap, output: Bitmap,
  ): IntArray?
}

class ImageUpscalerModule : Module() {
  // One job at a time: the GPU and the output directory are shared.
  private val mutex = Mutex()

  override fun definition() = ModuleDefinition {
    Name("ImageUpscaler")

    AsyncFunction("upscale") Coroutine { inputUri: String, engine: String, model: String, tileSize: Int, format: String ->
      withContext(Dispatchers.Default) { mutex.withLock { upscale(inputUri, engine, model, tileSize, format) } }
    }
  }

  // Bundled model -> noise level passed to the engine.
  private val models = mapOf(
    "realcugan" to mapOf("up2x-conservative" to -1, "up2x-no-denoise" to 0),
    "waifu2x" to mapOf("scale2.0x_model" to -1, "noise0_scale2.0x_model" to 0),
  )

  // Output format -> encoder and quality. WEBP below 100 is lossy on every API level.
  @Suppress("DEPRECATION")
  private val formats = mapOf(
    "png" to (Bitmap.CompressFormat.PNG to 100),
    "jpg" to (Bitmap.CompressFormat.JPEG to 95),
    "webp" to (Bitmap.CompressFormat.WEBP to 90),
  )

  // ncnn loads models by file path, so the bundled assets are copied out once.
  private fun modelFile(context: Context, engine: String, name: String): File {
    val file = File(context.filesDir, "upscaler-models/$engine/$name")
    if (!file.exists()) {
      file.parentFile?.mkdirs()
      val temp = File(file.path + ".tmp")
      context.assets.open("upscaler-models/$engine/$name").use { input ->
        temp.outputStream().use { input.copyTo(it) }
      }
      check(temp.renameTo(file)) { "Model copy failed" }
    }
    return file
  }

  private fun upscale(inputUri: String, engine: String, model: String, tileSize: Int, format: String): Map<String, Any> {
    val context = appContext.reactContext ?: error("Application context unavailable")
    val noise = requireNotNull(models[engine]?.get(model)) { "Unknown model" }
    require(tileSize == 0 || tileSize >= 32) { "Invalid tile size" }
    val (compressFormat, quality) = requireNotNull(formats[format]) { "Unknown format" }

    val options = BitmapFactory.Options().apply { inPreferredConfig = Bitmap.Config.ARGB_8888 }
    val decoded = context.contentResolver.openInputStream(Uri.parse(inputUri)).use {
      BitmapFactory.decodeStream(it, null, options)
    } ?: error("Image decode failed")
    val input = if (decoded.config == Bitmap.Config.ARGB_8888) decoded
      else decoded.copy(Bitmap.Config.ARGB_8888, false).also { decoded.recycle() }
    // 2x 결과가 16MP를 넘으면 비트맵 메모리가 감당되지 않는다.
    require(input.width.toLong() * input.height <= 2048L * 2048L) { "IMAGE_TOO_LARGE" }

    val output = Bitmap.createBitmap(input.width * 2, input.height * 2, Bitmap.Config.ARGB_8888)
    try {
      val param = modelFile(context, engine, "$model.param")
      val bin = modelFile(context, engine, "$model.bin")
      val startedAt = SystemClock.elapsedRealtime()
      val result = NativeUpscaler.upscale(engine, param.path, bin.path, noise, tileSize, input, output)
        ?: error("Upscale failed")
      val elapsedMs = SystemClock.elapsedRealtime() - startedAt

      // Only the latest result is kept.
      val directory = File(context.cacheDir, "upscaled")
      directory.deleteRecursively()
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
      )
    } finally {
      input.recycle()
      output.recycle()
    }
  }
}
