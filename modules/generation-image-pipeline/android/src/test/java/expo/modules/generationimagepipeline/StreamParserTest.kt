package expo.modules.generationimagepipeline

import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.DataOutputStream
import java.io.FilterInputStream
import java.io.IOException
import org.junit.Assert.*
import org.junit.Test

class StreamParserTest {
  @Test fun fragmentedUtf8AndMultipleEvents() {
    val text = ": keepalive\r\nevent: message\r\ndata: {\"event_type\":\"intermediate\",\r\ndata: \"message\":\"한글\",\"samp_ix\":0}\r\n\r\n" +
      "data: {\"samp_ix\":1}\n\ndata: [DONE]\n\ndata: {\"event_type\":\"final\"}"
    val fragmented = object : FilterInputStream(ByteArrayInputStream(text.toByteArray())) {
      override fun read(b: ByteArray, off: Int, len: Int): Int = super.read(b, off, minOf(len, 1))
    }
    val events = mutableListOf<org.json.JSONObject>()
    readImageEvents(fragmented.reader(Charsets.UTF_8).buffered()) { events.add(it) }
    assertEquals(2, events.size)
    assertEquals("한글", events[0].getString("message"))
    assertEquals("final", events[1].getString("event_type"))
  }

  @Test fun callbackErrorsAreNotSwallowed() {
    assertThrows(IOException::class.java) {
      readImageEvents("data: {}\n\n".reader().buffered()) { throw IOException("cancelled") }
    }
  }

  private fun png(vararg chunks: Pair<String, ByteArray>): ByteArray {
    val output = ByteArrayOutputStream()
    output.write(byteArrayOf(-119, 80, 78, 71, 13, 10, 26, 10))
    val data = DataOutputStream(output)
    for ((type, content) in chunks) {
      data.writeInt(content.size); data.writeBytes(type); data.write(content); data.writeInt(0)
    }
    return output.toByteArray()
  }

  @Test fun metadataMatchesTextAndUncompressedInternationalTextRules() {
    val bytes = png(
      "tEXt" to "Comment\u0000first".toByteArray(),
      "tEXt" to "Comment\u0000second".toByteArray(),
      "iTXt" to "Title\u0000\u0000\u0000en\u0000translated\u0000한글".toByteArray(),
      "iTXt" to "Skip\u0000\u0001\u0000en\u0000translated\u0000compressed".toByteArray(),
    )
    assertEquals(mapOf("Comment" to "first", "Comment#2" to "second", "Title" to "한글"), pngMetadata(bytes))
  }

  @Test fun emptyDuplicateAndMalformedChunkRemainCompatible() {
    assertEquals(mapOf("Comment" to "replacement"), pngMetadata(png(
      "tEXt" to "Comment\u0000".toByteArray(), "tEXt" to "Comment\u0000replacement".toByteArray(),
    )))
    assertTrue(pngMetadata(byteArrayOf(1, 2)).isEmpty())
    assertTrue(pngMetadata(png("tEXt" to "Key\u0000value".toByteArray()).dropLast(2).toByteArray()).isEmpty())
  }

  @Test fun cancellationBeforeResponsePreventsSaving() {
    val request = GenerationImagePipelineModule.Pending(true)
    request.cancel()
    assertThrows(IOException::class.java) { request.beginSaving() }
  }

  @Test fun cancellationAfterResponseKeepsCompletedImage() {
    val request = GenerationImagePipelineModule.Pending(true)
    request.beginSaving()
    request.cancel()
    request.check()
    assertFalse(request.cancelled)
  }
}
