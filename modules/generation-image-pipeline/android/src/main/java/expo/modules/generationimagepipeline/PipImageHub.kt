package expo.modules.generationimagepipeline

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Handler
import android.os.Looper

// 파이프라인(IO 스레드) → PiP Activity(메인 스레드) 이미지 전달. 콜백은 모두 메인 스레드에서 호출된다.
internal object PipImageHub {
  private val main = Handler(Looper.getMainLooper())

  // PiP Activity가 떠 있거나 뜨는 중. 파이프라인이 PiP용 디코드 여부를 판단한다.
  @Volatile var active = false
    private set
  @Volatile var generating = false
    private set
  @Volatile var autoEnter = false
  // 앱이 직접 다른 Activity(권한 창, 이미지 선택기)를 띄우는 동안에는 onUserLeaveHint가 와도 자동 PiP를 띄우지 않는다.
  @Volatile var autoSuppressed = false
  @Volatile var width = 1
  @Volatile var height = 1
  // 가장 최근 프레임(중간 jpg 또는 최종 png). PiP를 도중에 열 때 즉시 보여준다.
  @Volatile var latestFrame: ByteArray? = null

  var bitmap: Bitmap? = null
    private set
  var activity: GenerationPipActivity? = null
    private set
  var onActiveChange: ((Boolean) -> Unit)? = null
  var onCancel: (() -> Unit)? = null

  fun setActive(value: Boolean) {
    if (active == value) return
    active = value
    if (!value) main.post { bitmap = null }
    onActiveChange?.invoke(value)
  }

  fun setGenerating(value: Boolean) {
    generating = value
    main.post { activity?.updateParams() }
  }

  // openPip 직후 호출. 시스템이 Activity를 띄우지 않으면(다른 앱 PiP 전환과 겹침 등) active가 고착되지 않게 되돌린다.
  fun expectActivity() {
    main.postDelayed({ if (active && activity == null) setActive(false) }, 3000)
  }

  fun attach(target: GenerationPipActivity) {
    activity = target
    setActive(true)
  }

  // onDestroy를 기다리지 않고 즉시 비활성 처리한다 (종료된 Activity의 destroy는 늦게 올 수 있다).
  fun release(target: GenerationPipActivity) {
    if (activity !== target) return
    activity = null
    setActive(false)
  }

  fun close() {
    main.post {
      val current = activity
      if (current != null) current.finishPip() else setActive(false)
    }
  }

  fun pushFrame(bytes: ByteArray) {
    if (!active) return
    val decoded = decodeSampled(bytes, 1024) ?: return
    main.post {
      if (!active) return@post
      bitmap = decoded
      activity?.showBitmap(decoded)
    }
  }

  private fun decodeSampled(bytes: ByteArray, maxSide: Int): Bitmap? {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
    if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
    var sample = 1
    while (maxOf(bounds.outWidth, bounds.outHeight) / (sample * 2) >= maxSide) sample *= 2
    return BitmapFactory.decodeByteArray(bytes, 0, bytes.size, BitmapFactory.Options().apply { inSampleSize = sample })
  }
}
