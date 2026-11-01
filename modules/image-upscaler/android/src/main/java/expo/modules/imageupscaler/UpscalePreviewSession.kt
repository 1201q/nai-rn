package expo.modules.imageupscaler

import android.graphics.Bitmap
import android.net.Uri
import android.os.SystemClock
import java.io.File

// Frames are immutable files. Keep the displayed frame plus the newest two so
// a slow image decoder never forces us to retain an unbounded preview history.
internal class UpscalePreviewSession(
  val id: String,
  private val root: File,
  private val emit: (String, Map<String, Any?>) -> Unit,
) {
  @Volatile var enabled = false
  @Volatile var finished = false
  @Volatile var released = false
  var bitmap: Bitmap? = null
  private var lastFrameAt = -350L
  private var lastProgressAt = -80L
  private var sequence = 0
  private var acknowledged = -1
  private val frames = mutableMapOf<Int, File>()

  fun phase(phase: String) = emit("progress", mapOf("requestId" to id, "phase" to phase, "fraction" to if (phase == "saving") 1.0 else 0.0))

  fun tile(x: Int, y: Int, width: Int, height: Int, done: Int, total: Int) {
    val now = SystemClock.elapsedRealtime()
    if (done != 0 && now - lastProgressAt < 80) return
    lastProgressAt = now
    emit("progress", mapOf("requestId" to id, "phase" to "upscaling", "fraction" to done.toDouble() / total,
      "tile" to mapOf("x" to x, "y" to y, "width" to width, "height" to height), "completed" to done, "total" to total))
  }

  @Synchronized fun needsPreview(completed: Int, height: Int): Boolean {
    if (!enabled || bitmap == null) return false
    val now = SystemClock.elapsedRealtime()
    if (completed != height && now - lastFrameAt < 350) return false
    lastFrameAt = now
    return true
  }

  @Synchronized fun publish() {
    if (!enabled) return
    var file: File? = null
    try {
      val image = bitmap ?: return
      val directory = File(root, id).apply { mkdirs() }
      val next = sequence++
      file = File(directory, "$next.jpg")
      file.outputStream().use { check(image.compress(Bitmap.CompressFormat.JPEG, 85, it)) }
      frames[next] = file
      emit("preview", mapOf("requestId" to id, "imageUri" to Uri.fromFile(file).toString(), "sequence" to next))
      prune()
    } catch (_: Throwable) {
      file?.delete()
      enabled = false
      emit("preview", mapOf("requestId" to id, "failed" to true))
    }
  }

  @Synchronized fun acknowledge(value: Int) {
    if (frames.containsKey(value)) { acknowledged = value; prune() }
  }

  @Synchronized fun hasAcknowledgedFrame(): Boolean = acknowledged >= 0

  private fun prune() {
    val expired = frames.keys.filter { it < sequence - 2 && it != acknowledged }
    expired.forEach { frames.remove(it)?.delete() }
  }

  @Synchronized fun release() {
    released = true
    if (finished) runCatching { File(root, id).deleteRecursively() }
  }
}
