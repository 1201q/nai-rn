import { AlphaType, ColorType, Skia } from "@shopify/react-native-skia";
import { gunzipSync, strFromU8 } from "fflate";

const MAGIC_BITS = 15 * 8;
const LENGTH_BITS = 32;
const MAGIC_COMPRESSED = "stealth_pngcomp";
const MAGIC_PLAIN = "stealth_pnginfo";

// NovelAI stealth 메타데이터: 알파 채널 LSB에 열 우선(x 바깥, y 안쪽) 순서로
// magic(15바이트) → 데이터 비트 길이(32비트) → 데이터(gzip 또는 평문 JSON)가 들어 있다.
export function decodeStealthAlpha(
  rgba: Uint8Array,
  width: number,
  height: number,
): Record<string, string> {
  const totalBits = width * height;
  const bitAt = (index: number) => {
    const x = Math.floor(index / height);
    const y = index % height;
    return rgba[(y * width + x) * 4 + 3] & 1;
  };
  const readBytes = (start: number, byteCount: number) => {
    const bytes = new Uint8Array(byteCount);
    for (let byte = 0; byte < byteCount; byte += 1) {
      let value = 0;
      for (let bit = 0; bit < 8; bit += 1) {
        value = (value << 1) | bitAt(start + byte * 8 + bit);
      }
      bytes[byte] = value;
    }
    return bytes;
  };

  if (totalBits < MAGIC_BITS + LENGTH_BITS) return {};
  const magic = String.fromCharCode(...readBytes(0, MAGIC_BITS / 8));
  if (magic !== MAGIC_COMPRESSED && magic !== MAGIC_PLAIN) return {};

  let dataBits = 0;
  for (let bit = 0; bit < LENGTH_BITS; bit += 1) {
    dataBits = dataBits * 2 + bitAt(MAGIC_BITS + bit);
  }
  const dataStart = MAGIC_BITS + LENGTH_BITS;
  if (dataBits % 8 !== 0 || dataStart + dataBits > totalBits) return {};

  let data = readBytes(dataStart, dataBits / 8);
  if (magic === MAGIC_COMPRESSED) data = gunzipSync(data);

  const parsed: unknown = JSON.parse(strFromU8(data));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

  const metadata: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    metadata[key] = typeof value === "string" ? value : JSON.stringify(value);
  }
  return metadata;
}

export function extractStealthMetadata(
  bytes: Uint8Array,
): Record<string, string> {
  const image = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(bytes));
  if (!image) return {};

  const width = image.width();
  const height = image.height();
  const pixels = image.readPixels(0, 0, {
    width,
    height,
    colorType: ColorType.RGBA_8888,
    alphaType: AlphaType.Unpremul,
  });
  if (!(pixels instanceof Uint8Array)) return {};

  return decodeStealthAlpha(pixels, width, height);
}
