import { extractPngTextMetadata } from "../pngMetadata";

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

function ascii(text: string) {
  return Array.from(text, (char) => char.charCodeAt(0));
}

function chunk(type: string, data: number[]) {
  const length = data.length;
  return [
    (length >>> 24) & 0xff,
    (length >>> 16) & 0xff,
    (length >>> 8) & 0xff,
    length & 0xff,
    ...ascii(type),
    ...data,
    0,
    0,
    0,
    0,
  ];
}

function png(...chunks: number[][]) {
  return new Uint8Array([...SIGNATURE, ...chunks.flat()]);
}

test("reads tEXt and iTXt chunks", () => {
  const bytes = png(
    chunk("IHDR", new Array<number>(13).fill(0)),
    chunk("tEXt", [...ascii("Title"), 0, ...ascii("hello")]),
    chunk("iTXt", [
      ...ascii("Comment"),
      0,
      0,
      0,
      ...ascii("en"),
      0,
      ...ascii("t"),
      0,
      ...Array.from(new TextEncoder().encode('{"prompt":"캐릭"}')),
    ]),
    chunk("IEND", []),
  );

  expect(extractPngTextMetadata(bytes)).toEqual({
    Title: "hello",
    Comment: '{"prompt":"캐릭"}',
  });
});

test("suffixes duplicate keys", () => {
  const bytes = png(
    chunk("tEXt", [...ascii("k"), 0, ...ascii("a")]),
    chunk("tEXt", [...ascii("k"), 0, ...ascii("b")]),
    chunk("tEXt", [...ascii("k"), 0, ...ascii("c")]),
  );

  expect(extractPngTextMetadata(bytes)).toEqual({
    k: "a",
    "k#2": "b",
    "k#3": "c",
  });
});

test("returns empty for non-PNG data and stops at truncated chunks", () => {
  expect(extractPngTextMetadata(new Uint8Array([1, 2, 3]))).toEqual({});

  const truncated = png(chunk("tEXt", [...ascii("k"), 0, ...ascii("a")])).slice(
    0,
    -2,
  );
  expect(extractPngTextMetadata(truncated)).toEqual({});
});
