package expo.modules.predictiveback

import android.os.Build
import android.util.Log
import androidx.activity.BackEventCompat
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class PredictiveBackModule : Module() {
  private val backCallback = object : OnBackPressedCallback(false) {
    override fun handleOnBackStarted(backEvent: BackEventCompat) {
      sendEvent(EVENT_START, backEvent.toEventMap())
    }

    override fun handleOnBackProgressed(backEvent: BackEventCompat) {
      sendEvent(EVENT_PROGRESS, backEvent.toEventMap())
    }

    override fun handleOnBackCancelled() {
      sendEvent(EVENT_CANCEL)
    }

    override fun handleOnBackPressed() {
      sendEvent(EVENT_COMMIT)
    }
  }

  @Volatile
  private var requestedMode = MODE_SYSTEM
  private var isRegistered = false
  private var reactCallback: OnBackPressedCallback? = null
  private var reactCallbackHost: ComponentActivity? = null

  override fun definition() = ModuleDefinition {
    Name(NAME)

    Constant("progressAvailable") {
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE
    }

    Events(EVENT_START, EVENT_PROGRESS, EVENT_CANCEL, EVENT_COMMIT)

    Function("setMode") { mode: String ->
      if (mode != MODE_APP && mode != MODE_SYSTEM) {
        Log.w(NAME, "Unknown back mode: $mode")
        return@Function
      }

      requestedMode = mode
      applyRequestedMode()
    }

    OnActivityEntersForeground {
      // Lifecycle-bound callbacks can be re-added when the activity resumes.
      // Re-apply our mode so the dispatcher order remains deterministic.
      applyRequestedMode()
    }

    OnDestroy {
      currentActivity()?.runOnUiThread {
        backCallback.isEnabled = false
        if (isRegistered) {
          backCallback.remove()
          isRegistered = false
        }
        reactCallback?.isEnabled = true
        reactCallback = null
        reactCallbackHost = null
      }
    }
  }

  private fun applyRequestedMode() {
    val activity = currentActivity() ?: return
    activity.runOnUiThread {
      when (requestedMode) {
        MODE_APP -> {
          attachTo(activity)
          setReactCallbackEnabled(activity, true)
          backCallback.isEnabled = true
        }
        MODE_SYSTEM -> {
          backCallback.isEnabled = false
          setReactCallbackEnabled(activity, false)
        }
      }
    }
  }

  private fun currentActivity(): ComponentActivity? =
    appContext.currentActivity as? ComponentActivity

  private fun attachTo(activity: ComponentActivity) {
    if (isRegistered) {
      backCallback.remove()
    }
    activity.onBackPressedDispatcher.addCallback(backCallback)
    isRegistered = true
  }

  private fun setReactCallbackEnabled(
    activity: ComponentActivity,
    enabled: Boolean
  ) {
    findReactCallback(activity)?.isEnabled = enabled
  }

  private fun findReactCallback(
    activity: ComponentActivity
  ): OnBackPressedCallback? {
    if (reactCallbackHost === activity) {
      return reactCallback
    }

    var currentClass: Class<*>? = activity.javaClass
    while (currentClass != null && currentClass != ComponentActivity::class.java) {
      for (field in currentClass.declaredFields) {
        if (!OnBackPressedCallback::class.java.isAssignableFrom(field.type)) {
          continue
        }

        try {
          field.isAccessible = true
          val found = field.get(activity) as? OnBackPressedCallback
          if (found != null) {
            reactCallback = found
            reactCallbackHost = activity
            return found
          }
        } catch (error: Exception) {
          Log.w(NAME, "Could not read React Native's back callback", error)
          return null
        }
      }
      currentClass = currentClass.superclass
    }

    Log.w(NAME, "React Native's back callback was not found")
    return null
  }

  private fun BackEventCompat.toEventMap(): Map<String, Any> =
    mapOf(
      "progress" to progress.toDouble(),
      "swipeEdge" to swipeEdge,
      "touchX" to touchX.toDouble(),
      "touchY" to touchY.toDouble()
    )

  companion object {
    const val NAME = "PredictiveBack"
    private const val MODE_APP = "app"
    private const val MODE_SYSTEM = "system"
    private const val EVENT_START = "predictiveBackStart"
    private const val EVENT_PROGRESS = "predictiveBackProgress"
    private const val EVENT_CANCEL = "predictiveBackCancel"
    private const val EVENT_COMMIT = "predictiveBackCommit"
  }
}
