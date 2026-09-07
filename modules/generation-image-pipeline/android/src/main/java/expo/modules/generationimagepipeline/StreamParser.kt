package expo.modules.generationimagepipeline

import java.io.BufferedReader
import org.json.JSONObject

// BufferedReader handles UTF-8 boundaries and LF/CRLF/CR line endings.
internal fun readImageEvents(
  reader: BufferedReader,
  parse: (String) -> JSONObject = { JSONObject(it) },
  consume: (JSONObject) -> Unit,
) {
  val data = StringBuilder()
  fun dispatch() {
    if (data.isEmpty()) return
    val text = data.toString()
    data.setLength(0)
    val event = try { parse(text) } catch (_: org.json.JSONException) { return }
    if (event.has("samp_ix") && event.optInt("samp_ix") != 0) return
    consume(event)
  }
  while (true) {
    val line = reader.readLine() ?: break
    if (line.isEmpty()) dispatch()
    else if (line.startsWith("data:")) {
      if (data.isNotEmpty()) data.append('\n')
      data.append(line.substring(5).removePrefix(" "))
    }
  }
  dispatch()
}

internal fun pngMetadata(bytes: ByteArray): Map<String, String> {
  val result = linkedMapOf<String, String>()
  val signature = byteArrayOf(-119, 80, 78, 71, 13, 10, 26, 10)
  if (bytes.size < 8 || !bytes.copyOfRange(0, 8).contentEquals(signature)) return result
  fun add(key: String, value: String) {
    var target = key
    var suffix = 2
    while (!result[target].isNullOrEmpty()) target = "$key#${suffix++}"
    result[target] = value
  }
  var offset = 8
  while (offset.toLong() + 12 <= bytes.size) {
    var size = 0L
    for (i in 0..3) size = (size shl 8) or (bytes[offset + i].toLong() and 255)
    val start = offset + 8
    if (start.toLong() + size + 4 > bytes.size) break
    val end = start + size.toInt()
    val type = String(bytes, offset + 4, 4, Charsets.US_ASCII)
    fun zero(from: Int): Int = (from until end).firstOrNull { bytes[it] == 0.toByte() } ?: -1
    val keywordEnd = if (type == "tEXt" || type == "iTXt") zero(start) else -1
    if (keywordEnd > start) {
      val key = String(bytes, start, keywordEnd - start, Charsets.UTF_8)
      if (type == "tEXt") {
        add(key, String(bytes, keywordEnd + 1, end - keywordEnd - 1, Charsets.UTF_8))
      } else if (keywordEnd + 3 <= end && bytes[keywordEnd + 1] == 0.toByte()) {
        val languageEnd = zero(keywordEnd + 3)
        val translatedEnd = if (languageEnd >= 0) zero(languageEnd + 1) else -1
        if (translatedEnd >= 0) add(key, String(bytes, translatedEnd + 1, end - translatedEnd - 1, Charsets.UTF_8))
      }
    }
    offset = end + 4
  }
  return result
}
