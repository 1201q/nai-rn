package expo.modules.generationimagepipeline

import android.annotation.TargetApi
import android.app.Activity
import android.app.PendingIntent
import android.app.PictureInPictureParams
import android.app.RemoteAction
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.res.Configuration
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.drawable.Icon
import android.os.Build
import android.os.Bundle
import android.util.Rational
import android.widget.ImageView

// 생성 이미지만 PiP로 띄우는 별도 태스크 Activity. 메인 Activity를 PiP로 보내면 앱 전체가 줄어들기 때문.
@TargetApi(Build.VERSION_CODES.O)
class GenerationPipActivity : Activity() {
  private lateinit var imageView: ImageView
  private var pipRequested = false
  private var leftPip = false
  private var stopped = false
  private var aspect = Rational(1, 1)
  private val cancelReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) { PipImageHub.onCancel?.invoke() }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    // 배경은 PiP 진입 후에 칠한다. 진입 전 프레임은 투명해야 메인 앱 위로 번쩍이지 않는다.
    imageView = ImageView(this).apply { scaleType = ImageView.ScaleType.FIT_CENTER }
    setContentView(imageView)
    PipImageHub.attach(this)
    aspect = clampedRational(PipImageHub.width, PipImageHub.height)
    PipImageHub.bitmap?.let { showBitmap(it) }
    val filter = IntentFilter(ACTION_CANCEL)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) registerReceiver(cancelReceiver, filter, RECEIVER_NOT_EXPORTED)
    else registerReceiver(cancelReceiver, filter)
  }

  override fun onResume() {
    super.onResume()
    if (!pipRequested) {
      // resumed 상태에서 진입해야 한다. 다른 앱의 PiP 전환과 겹치면 예외가 날 수 있어 실패 시 조용히 닫는다.
      pipRequested = true
      val entered = runCatching { enterPictureInPictureMode(buildParams()) }.getOrDefault(false)
      if (!entered) finishPip()
    } else if (leftPip && !isInPictureInPictureMode) {
      // PiP가 풀린 뒤 resume = 확장 탭. 닫기/다른 앱 PiP에 밀려남은 resume 없이 stop된다.
      packageManager.getLaunchIntentForPackage(packageName)?.let {
        startActivity(it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      }
      finishPip()
    }
  }

  override fun onStart() {
    super.onStart()
    stopped = false
  }

  override fun onStop() {
    super.onStop()
    stopped = true
    // PiP가 아닌 채로 가려짐(닫기, 다른 앱 PiP에 밀려남) → 남아 있으면 hub가 active로 고착되므로 종료.
    // 화면 꺼짐은 PiP 모드가 유지되므로 해당하지 않는다.
    if (!isInPictureInPictureMode) finishPip()
  }

  // singleTask라 남아 있던 인스턴스로 재실행이 들어오면 다시 PiP에 진입한다.
  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    PipImageHub.attach(this)
    pipRequested = false
    leftPip = false
  }

  override fun onPictureInPictureModeChanged(isInPictureInPictureMode: Boolean, newConfig: Configuration) {
    super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig)
    if (isInPictureInPictureMode) {
      imageView.setBackgroundColor(Color.parseColor("#13142C"))
      return
    }
    leftPip = true
    // 닫기(X)는 기기에 따라 onStop(아직 PiP 모드) → 여기 순서로 온다. 이미 가려졌으면 확장이 아니라 닫힘.
    if (stopped) finishPip()
  }

  override fun onDestroy() {
    unregisterReceiver(cancelReceiver)
    PipImageHub.release(this)
    super.onDestroy()
  }

  fun finishPip() {
    PipImageHub.release(this)
    finishAndRemoveTask()
  }

  fun showBitmap(bitmap: Bitmap) {
    imageView.setImageBitmap(bitmap)
    val next = clampedRational(bitmap.width, bitmap.height)
    if (next != aspect) {
      aspect = next
      updateParams()
    }
  }

  fun updateParams() {
    if (isInPictureInPictureMode) runCatching { setPictureInPictureParams(buildParams()) }
  }

  private fun buildParams(): PictureInPictureParams {
    val builder = PictureInPictureParams.Builder().setAspectRatio(aspect)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) builder.setSeamlessResizeEnabled(false)
    val actions = if (PipImageHub.generating) {
      val intent = PendingIntent.getBroadcast(
        this, 0, Intent(ACTION_CANCEL).setPackage(packageName),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
      )
      listOf(RemoteAction(Icon.createWithResource(this, R.drawable.nai_pip_cancel), "취소", "생성 취소", intent))
    } else emptyList()
    return builder.setActions(actions).build()
  }

  companion object {
    private const val ACTION_CANCEL = "expo.modules.generationimagepipeline.PIP_CANCEL"
    // PiP 비율 허용 범위는 1:2.39 ~ 2.39:1. 벗어나면 enterPictureInPictureMode가 예외를 던지므로 안쪽으로 클램프.
    private fun clampedRational(width: Int, height: Int): Rational {
      if (width <= 0 || height <= 0) return Rational(1, 1)
      val ratio = (width.toDouble() / height).coerceIn(0.42, 2.38)
      return Rational((ratio * 1000).toInt(), 1000)
    }
  }
}
