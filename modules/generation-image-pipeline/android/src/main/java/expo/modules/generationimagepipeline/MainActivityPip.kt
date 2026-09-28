package expo.modules.generationimagepipeline

import android.app.Activity
import android.app.PendingIntent
import android.app.PictureInPictureParams
import android.app.RemoteAction
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Rect
import android.graphics.drawable.Icon
import android.os.Build
import android.util.Log
import android.util.Rational
import android.view.ViewGroup
import android.widget.ImageView
import androidx.activity.ComponentActivity
import androidx.core.app.PictureInPictureModeChangedInfo
import androidx.core.util.Consumer
import java.lang.ref.WeakReference

// 메인 Activity 자체를 PiP로 보낸다 (Android 12+). 진입 애니메이션은 sourceRectHint(화면에 보이던 이미지 영역)에서
// 시작하고, PiP 창 안은 RN 화면 위에 덮는 네이티브 ImageView로 이미지만 보여준다.
internal class MainActivityPip {
  @Volatile var autoEnter = false
  @Volatile var generating = false
  @Volatile private var sourceRect: Rect? = null
  private var activityRef = WeakReference<ComponentActivity>(null)
  private var overlay: ImageView? = null
  private val listener = Consumer<PictureInPictureModeChangedInfo> { info ->
    activityRef.get()?.let { onModeChanged(it, info.isInPictureInPictureMode) }
  }

  val supported get() = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S

  // 포그라운드 진입마다 호출. 같은 Activity면 리스너를 다시 등록하지 않는다.
  fun attach(activity: Activity?) {
    val target = activity as? ComponentActivity ?: return
    if (!supported) return
    target.runOnUiThread {
      if (activityRef.get() !== target) {
        activityRef.get()?.removeOnPictureInPictureModeChangedListener(listener)
        target.addOnPictureInPictureModeChangedListener(listener)
        activityRef = WeakReference(target)
      }
      apply()
    }
  }

  fun setSourceRect(x: Int, y: Int, width: Int, height: Int) {
    sourceRect = if (width > 0 && height > 0) Rect(x, y, x + width, y + height) else null
    post { apply() }
  }

  fun update() = post { apply() }

  // 뒤로가기 등 수동 진입. 실패(다른 전환과 겹침 등)는 무시한다.
  fun enter() = post {
    val activity = activityRef.get() ?: return@post
    if (supported) runCatching { activity.enterPictureInPictureMode(buildParams(activity)) }
  }

  fun showBitmap(bitmap: Bitmap) {
    overlay?.setImageBitmap(bitmap)
  }

  private fun post(block: () -> Unit) {
    activityRef.get()?.runOnUiThread(block)
  }

  private fun apply() {
    val activity = activityRef.get() ?: return
    if (!supported) return
    runCatching { activity.setPictureInPictureParams(buildParams(activity)) }
      .onFailure { Log.w(TAG, "setPictureInPictureParams failed", it) }
  }

  private fun buildParams(activity: Activity): PictureInPictureParams {
    val builder = PictureInPictureParams.Builder()
    sourceRect?.let {
      builder.setSourceRectHint(it)
      builder.setAspectRatio(clampedRational(it.width(), it.height()))
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      builder.setAutoEnterEnabled(autoEnter)
      builder.setSeamlessResizeEnabled(false)
    }
    val actions = if (generating) {
      val intent = PendingIntent.getBroadcast(
        activity, 1, Intent(ACTION_CANCEL).setPackage(activity.packageName),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
      )
      listOf(RemoteAction(Icon.createWithResource(activity, R.drawable.nai_pip_cancel), "취소", "생성 취소", intent))
    } else emptyList()
    return builder.setActions(actions).build()
  }

  private fun onModeChanged(activity: ComponentActivity, inPip: Boolean) {
    val decor = activity.window.decorView as ViewGroup
    if (inPip) {
      if (overlay == null) {
        overlay = ImageView(activity).apply {
          scaleType = ImageView.ScaleType.FIT_CENTER
          setBackgroundColor(Color.parseColor("#13142C"))
        }.also { decor.addView(it, ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT) }
      }
      PipImageHub.setActive(true)
    } else {
      PipImageHub.setActive(false)
      // 큐가 끝난 뒤 PiP를 닫으면 최종 이미지 바이트를 더 들고 있을 이유가 없다.
      if (!generating) PipImageHub.latestFrame = null
      overlay?.let { decor.removeView(it) }
      overlay = null
    }
  }

  companion object {
    private const val TAG = "NaiMainPip"
    const val ACTION_CANCEL = "expo.modules.generationimagepipeline.MAIN_PIP_CANCEL"
    // PiP 비율 허용 범위는 1:2.39 ~ 2.39:1. 벗어나면 예외가 나므로 안쪽으로 클램프.
    fun clampedRational(width: Int, height: Int): Rational {
      if (width <= 0 || height <= 0) return Rational(1, 1)
      val ratio = (width.toDouble() / height).coerceIn(0.42, 2.38)
      return Rational((ratio * 1000).toInt(), 1000)
    }
  }
}
