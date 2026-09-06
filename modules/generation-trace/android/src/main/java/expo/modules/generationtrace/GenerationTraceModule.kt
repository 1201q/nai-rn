package expo.modules.generationtrace

import android.os.SystemClock
import android.os.Trace
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class GenerationTraceModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("GenerationTrace")

    // Synchronous Functions run on the calling JS thread; no queue hop.
    Function("anchor") { name: String ->
      val beforeMs = SystemClock.elapsedRealtimeNanos() / 1_000_000.0
      val enabled = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && Trace.isEnabled()
      if (enabled) {
        Trace.beginSection(name.take(127))
        Trace.endSection()
      }
      val afterMs = SystemClock.elapsedRealtimeNanos() / 1_000_000.0
      mapOf("beforeBootMs" to beforeMs, "afterBootMs" to afterMs, "enabled" to enabled)
    }

    Function("beginSection") { name: String ->
      val enabled = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && Trace.isEnabled()
      if (enabled) Trace.beginSection(name.take(127))
      enabled
    }

    Function("endSection") {
      Trace.endSection()
    }
  }
}
