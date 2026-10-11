import { createSolidPng } from "../devHistorySeed";

jest.mock("../generationHistory", () => ({
  saveGenerationImageBase64: jest.fn(),
}));

const { crc32, inflateSync } = jest.requireActual<{
  crc32: (data: Uint8Array) => number;
  inflateSync: (data: Uint8Array) => Uint8Array;
}>("zlib");

test("builds a decodable solid-color PNG", () => {
  const png = createSolidPng(2, [10, 20, 30]);
  const view = new DataView(png.buffer);

  expect([...png.subarray(0, 8)]).toEqual([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  const chunks: Record<string, Uint8Array> = {};
  for (let offset = 8; offset < png.length;) {
    const length = view.getUint32(offset);
    const typeAndData = png.subarray(offset + 4, offset + 8 + length);
    expect(view.getUint32(offset + 8 + length)).toBe(crc32(typeAndData));
    chunks[String.fromCharCode(...typeAndData.subarray(0, 4))] =
      typeAndData.subarray(4);
    offset += 12 + length;
  }

  expect(Object.keys(chunks)).toEqual(["IHDR", "IDAT", "IEND"]);
  // 2x2, 8비트 RGB
  expect([...chunks.IHDR]).toEqual([0, 0, 0, 2, 0, 0, 0, 2, 8, 2, 0, 0, 0]);
  // 줄마다 필터 바이트 0 + 픽셀 두 개
  expect([...inflateSync(chunks.IDAT)]).toEqual([
    0, 10, 20, 30, 10, 20, 30, 0, 10, 20, 30, 10, 20, 30,
  ]);
});
