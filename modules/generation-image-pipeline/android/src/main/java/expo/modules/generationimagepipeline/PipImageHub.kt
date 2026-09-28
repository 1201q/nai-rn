package expo.modules.generationimagepipeline

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Handler
import android.os.Looper

// 파이프라인(IO 스레드) → PiP 오버레이(메인 스레드) 이미지 전달.
internal object PipImageHub {
  private val main = Handler(Looper.getMainLooper())

  // 메인 Activity가 PiP 모드. 파이프라인이 PiP용 디코드 여부를 판단한다.
  @Volatile var active = false
    private set
  // 가장 최근 프레임(중간 jpg 또는 최종 png). PiP에 들어가는 즉시 보여준다.
  @Volatile var latestFrame: ByteArray? = null
  var sink: ((Bitmap) -> Unit)? = null

  fun setActive(value: Boolean) {
    active = value
    if (value) latestFrame?.let { pushFrame(it) }
  }

  fun pushFrame(bytes: ByteArray) {
    if (!active) return
    val decoded = decodeSampled(bytes, 1024) ?: return
    main.post { if (active) sink?.invoke(decoded) }
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
