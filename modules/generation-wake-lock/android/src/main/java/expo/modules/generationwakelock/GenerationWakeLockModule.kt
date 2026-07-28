package expo.modules.generationwakelock

import android.content.Context
import android.os.PowerManager
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.delay

private const val WAKE_LOCK_TAG = "nairn:imageGeneration"

class GenerationWakeLockModule : Module() {
  private var wakeLock: PowerManager.WakeLock? = null

  override fun definition() = ModuleDefinition {
    Name("GenerationWakeLock")

    AsyncFunction("acquire") { timeoutMs: Double ->
      acquire(timeoutMs.toLong())
    }

    AsyncFunction("release") {
      release()
    }

    AsyncFunction("isHeld") {
      wakeLock?.isHeld == true
    }

    AsyncFunction("wait") Coroutine { delayMs: Double ->
      require(delayMs.isFinite() && delayMs >= 0) {
        "Wait duration must be a finite non-negative number."
      }
      delay(delayMs.toLong())
      true
    }

    OnDestroy {
      release()
    }
  }

  @Synchronized
  private fun acquire(timeoutMs: Long): Boolean {
    require(timeoutMs > 0) { "Wake lock timeout must be greater than zero." }

    val existingWakeLock = wakeLock
    if (existingWakeLock?.isHeld == true) {
      return true
    }

    val context =
      appContext.reactContext?.applicationContext
        ?: throw IllegalStateException("Android application context is unavailable.")
    val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
    val newWakeLock =
      powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, WAKE_LOCK_TAG).apply {
        setReferenceCounted(false)
        acquire(timeoutMs)
      }

    wakeLock = newWakeLock
    return true
  }

  @Synchronized
  private fun release(): Boolean {
    val currentWakeLock = wakeLock ?: return false
    val wasHeld = currentWakeLock.isHeld

    if (wasHeld) {
      currentWakeLock.release()
    }
    wakeLock = null
    return wasHeld
  }
}
