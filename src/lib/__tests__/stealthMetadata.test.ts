import { gzipSync, strToU8 } from "fflate";

import { decodeStealthAlpha } from "../stealthMetadata";

jest.mock("@shopify/react-native-skia", () => ({}));

function encodeStealth(
  magic: string,
  payload: Uint8Array,
  width: number,
  height: number,
) {
  const bits: number[] = [];
  const pushByte = (value: number) => {
    for (let bit = 7; bit >= 0; bit -= 1) bits.push((value >> bit) & 1);
  };
  for (const char of magic) pushByte(char.charCodeAt(0));
  const length = payload.length * 8;
  for (let bit = 31; bit >= 0; bit -= 1)
    bits.push(Math.floor(length / 2 ** bit) % 2);
  payload.forEach(pushByte);

  const rgba = new Uint8Array(width * height * 4).fill(255);
  bits.forEach((bit, index) => {
    const x = Math.floor(index / height);
    const y = index % height;
    rgba[(y * width + x) * 4 + 3] = 254 | bit;
  });
  return rgba;
}

const json = JSON.stringify({
  Description: "1girl, 한글",
  Comment: '{"seed":42}',
  Software: "NovelAI",
});

describe("decodeStealthAlpha", () => {
  it("decodes gzip-compressed metadata in column-major order", () => {
    const rgba = encodeStealth(
      "stealth_pngcomp",
      gzipSync(strToU8(json)),
      40,
      30,
    );
    expect(decodeStealthAlpha(rgba, 40, 30)).toEqual(JSON.parse(json));
  });

  it("decodes uncompressed metadata", () => {
    const rgba = encodeStealth("stealth_pnginfo", strToU8(json), 60, 50);
    expect(decodeStealthAlpha(rgba, 60, 50)).toEqual(JSON.parse(json));
  });

  it("returns empty metadata when the alpha channel has no magic", () => {
    expect(
      decodeStealthAlpha(new Uint8Array(40 * 30 * 4).fill(255), 40, 30),
    ).toEqual({});
  });
});
