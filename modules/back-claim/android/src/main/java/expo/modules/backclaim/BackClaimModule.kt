package expo.modules.backclaim

import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val BACK_PRESS_EVENT = "onBackPress"

/**
 * JS가 하드웨어 백을 선점할 수 있게 해주는 모듈.
 *
 * NavigationStack은 FragmentManager의 OnBackPressedCallback으로 back을 처리한다(예측
 * 뒤로가기). 그래서 시트/미리보기 같은 JS 오버레이가 열려 있어도 back이 화면 pop으로 먹혀버린다.
 * dispatcher는 마지막에 등록된 콜백부터 처리하므로, JS가 back을 원할 때만 콜백을 맨 위로
 * 다시 등록해서 프래그먼트보다 먼저 가져간다. 원하지 않으면 비활성화해 프래그먼트가 예측
 * 뒤로가기로 처리하게 둔다.
 */
class BackClaimModule : Module() {
  private var claimed = false

  private val callback = object : OnBackPressedCallback(false) {
    override fun handleOnBackPressed() {
      sendEvent(BACK_PRESS_EVENT)
    }
  }

  override fun definition() = ModuleDefinition {
    Name("BackClaim")

    Events(BACK_PRESS_EVENT)

    Function("setClaimed") { value: Boolean ->
      claimed = value
      if (value) reattach()
      callback.isEnabled = value
    }

    OnActivityEntersForeground {
      // 액티비티가 재개되면 FragmentManager 콜백이 dispatcher 맨 위로 다시 쌓인다.
      // 선점 중이라면 우리도 다시 올려야 한다.
      if (claimed) reattach()
    }

    OnDestroy {
      callback.remove()
    }
  }

  private fun reattach() {
    val activity = appContext.currentActivity as? ComponentActivity ?: return
    callback.remove()
    activity.onBackPressedDispatcher.addCallback(callback)
  }
}
