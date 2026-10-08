import { saveGenerationImageBase64 } from "./generationHistory";

const SEED_IMAGE_SIZE = 16;

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function adler32(bytes: Uint8Array) {
  let a = 1;
  let b = 0;
  for (const byte of bytes) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function uint32(value: number) {
  return [
    value >>> 24,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ];
}

function chunk(type: string, data: number[]) {
  const body = [...type].map((char) => char.charCodeAt(0)).concat(data);
  return [
    ...uint32(data.length),
    ...body,
    ...uint32(crc32(new Uint8Array(body))),
  ];
}

// 압축하지 않은 deflate 블록 하나로 만든 단색 RGB PNG
export function createSolidPng(size: number, rgb: [number, number, number]) {
  const raw: number[] = [];
  for (let y = 0; y < size; y += 1) {
    raw.push(0);
    for (let x = 0; x < size; x += 1) raw.push(...rgb);
  }
  const length = raw.length;
  const zlib = [
    0x78,
    0x01,
    0x01,
    length & 0xff,
    length >>> 8,
    ~length & 0xff,
    (~length >>> 8) & 0xff,
    ...raw,
    ...uint32(adler32(new Uint8Array(raw))),
  ];
  return new Uint8Array([
    ...[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    ...chunk("IHDR", [...uint32(size), ...uint32(size), 8, 2, 0, 0, 0]),
    ...chunk("IDAT", zlib),
    ...chunk("IEND", []),
  ]);
}

function hueToRgb(hue: number): [number, number, number] {
  const channel = (offset: number) => {
    const k = (offset + hue / 30) % 12;
    return Math.round(
      255 * (0.5 - 0.4 * Math.max(-1, Math.min(k - 3, 9 - k, 1))),
    );
  };
  return [channel(0), channel(8), channel(4)];
}

// 개발용: History 그리드 테스트에 쓸 단색 이미지를 실제 저장 경로로 넣는다.
export async function seedDevHistory(count: number) {
  const records = [];
  for (let index = 0; index < count; index += 1) {
    // 황금각으로 돌려 이웃한 타일의 색이 구분되게 한다.
    const png = createSolidPng(
      SEED_IMAGE_SIZE,
      hueToRgb((index * 137.5) % 360),
    );
    records.push(
      await saveGenerationImageBase64({
        imageBase64: btoa(String.fromCharCode(...png)),
        imageFormat: "png",
        prompt: `dev seed ${index + 1}`,
        negativePrompt: "",
        model: "nai-diffusion-4-5-full",
        sampler: "k_euler_ancestral",
        noiseSchedule: "karras",
        width: SEED_IMAGE_SIZE,
        height: SEED_IMAGE_SIZE,
        steps: 28,
        scale: 5,
        cfgRescale: 0,
        seed: index,
      }),
    );
  }
  return records;
}
