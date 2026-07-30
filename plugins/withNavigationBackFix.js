const { withMainActivity } = require("@expo/config-plugins");

/**
 * MainActivity를 통째로 교체해 navigation-react-native의 예측 뒤로가기와
 * 루트 화면에서의 앱 종료를 정상화한다. 배경은 생성되는 파일의 주석 참고.
 *
 * android/ 디렉터리는 prebuild로 재생성되므로 손으로 고치면 날아간다.
 */
function buildMainActivity(packageName) {
  return `package ${packageName}

import android.os.Bundle
import android.util.Log

import androidx.activity.OnBackPressedCallback

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {
  /**
   * 하드웨어 백을 JS(BackHandler)로 넘기는 콜백.
   *
   * ReactActivity도 targetSdk 36에서 같은 역할의 콜백을 등록하지만, 액티비티 라이프사이클에
   * 묶어서 등록한다. 라이프사이클에 묶인 콜백은 ON_STOP에서 dispatcher에서 빠지고 ON_START에서
   * 맨 위로 다시 쌓인다. 그런데 프래그먼트의 ON_START(FragmentActivity.onStart 안에서 실행)가
   * 액티비티의 ON_START(onActivityPostStarted, API 29+)보다 먼저 실행되므로, 앱이 백그라운드에
   * 다녀오면 RN 콜백이 NavigationStack의 FragmentManager 콜백보다 위에 쌓인다. 그러면 백
   * 제스처가 항상 JS 라운드트립을 타서 예측 뒤로가기 애니메이션이 사라진다.
   *
   * 그래서 RN 콜백은 비활성화하고, 라이프사이클에 묶이지 않은 이 콜백을 onCreate에서 한 번만
   * 등록한다. 큐 위치가 고정되므로 FragmentManager 콜백이 항상 이 콜백보다 위에 있고,
   * 스택이 남아 있으면 프래그먼트가 예측 뒤로가기로 처리하고 루트에서만 JS로 넘어간다.
   */
  private val backPressedCallback = object : OnBackPressedCallback(true) {
    override fun handleOnBackPressed() {
      isEnabled = false
      onBackPressed()
      isEnabled = true
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    // Set the theme to AppTheme BEFORE onCreate to support
    // coloring the background, status bar, and navigation bar.
    // This is required for expo-splash-screen.
    setTheme(R.style.AppTheme);
    super.onCreate(null)
    disableReactBackPressedCallback()
    onBackPressedDispatcher.addCallback(backPressedCallback)
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "main"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
          this,
          BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
          object : DefaultReactActivityDelegate(
              this,
              mainComponentName,
              fabricEnabled
          ){})
  }

  /**
   * JS의 BackHandler가 백을 처리하지 않았을 때 호출된다. targetSdk 36에서는
   * OnBackPressedDispatcher의 fallback인 Activity.onBackPressed()가 no-op이라 루트 화면에서
   * 아무 일도 일어나지 않으므로, 시스템 기본 동작(루트 액티비티를 백그라운드로 보내기)을
   * 직접 수행한다.
   */
  override fun invokeDefaultOnBackPressed() {
    // dispatcher로 되돌리면 안 된다. expo-dev-menu 등 무관한 콜백이 백스택을 물고 있으면
    // 그쪽으로 흘러가 아무 일도 일어나지 않는다.
    if (!moveTaskToBack(false)) {
      // 루트 액티비티가 아니면 그냥 종료한다.
      finish()
    }
  }

  /** ReactActivity가 등록한 백 콜백을 비활성화한다. [backPressedCallback] 주석 참고. */
  private fun disableReactBackPressedCallback() {
    try {
      val field = ReactActivity::class.java.getDeclaredField("mBackPressedCallback")
      field.isAccessible = true
      (field.get(this) as OnBackPressedCallback).isEnabled = false
    } catch (e: Exception) {
      Log.w("MainActivity", "ReactActivity의 백 콜백을 비활성화하지 못했습니다.", e)
    }
  }
}
`;
}

module.exports = function withNavigationBackFix(config) {
  return withMainActivity(config, (mod) => {
    if (mod.modResults.language !== "kt") {
      throw new Error(
        `withNavigationBackFix: MainActivity가 Kotlin이 아닙니다 (${mod.modResults.language}).`,
      );
    }

    const match = mod.modResults.contents.match(/^package\s+(\S+)/m);
    if (!match) {
      throw new Error(
        "withNavigationBackFix: MainActivity에서 package 선언을 찾지 못했습니다.",
      );
    }

    mod.modResults.contents = buildMainActivity(match[1]);
    return mod;
  });
};
