const { readFileSync } = require("fs") as {
  readFileSync: (path: string) => Uint8Array;
};
const { join } = require("path") as {
  join: (...segments: string[]) => string;
};
const { inflateRawSync } = require("zlib") as {
  inflateRawSync: (data: Uint8Array) => { toString: () => string };
};

import {
  NovelAiClipTokenizer,
  NovelAiQwenTokenizer,
  NovelAiT5Tokenizer,
} from "../tokenizers";

function readCompressedDefinition(fileName: string): string {
  return inflateRawSync(
    readFileSync(join(process.cwd(), "assets", "tokenizers", fileName)),
  ).toString();
}

describe("NovelAI prompt tokenizers", () => {
  const t5 = new NovelAiT5Tokenizer(
    JSON.parse(readCompressedDefinition("t5_tokenizer.def")),
  );
  const clipDefinition = JSON.parse(
    readCompressedDefinition("clip_tokenizer.def"),
  ) as { text: string };
  const clip = new NovelAiClipTokenizer(clipDefinition.text);
  const qwen = new NovelAiQwenTokenizer(
    JSON.parse(readCompressedDefinition("qwen35_merges.def")),
  );

  // 기준값: 원본 qwen35_tokenizer.def(vocab 포함)로 따로 계산한 토큰 수.
  it.each([
    ["", 0],
    ["1girl", 2],
    ["1girl, blue eyes", 5],
    ["1girl, blue eyes, long hair, standing in a garden", 13],
    ['a girl holding a sign, "hello"', 9],
    ["1girl,  blue eyes\nsmile", 9],
    ["こんにちは、世界", 3],
    ["소녀, 파란 눈", 6],
    ["very aesthetic, masterpiece, no text", 7],
    ["nsfw, lowres, bad anatomy", 8],
  ])("matches the Qwen fixture for %p", (text, expected) => {
    expect(qwen.countTokens(text)).toBe(expected);
  });

  it.each([702, 703, 704])(
    "counts the Qwen boundary at %i repeated tags",
    (tagCount) => {
      expect(qwen.countTokens(Array(tagCount).fill("girl").join(" "))).toBe(
        tagCount,
      );
    },
  );

  // 웹 표시값(2026-10-02): V5는 가중치 문법을 지우지 않고 그대로 센다.
  it("counts emphasis syntax as written for Qwen", () => {
    expect(qwen.countTokens("1.2::1girl::, {blue eyes}, [long hair]")).toBe(16);
  });

  it.each([
    ["", 1],
    ["1girl", 3],
    ["1girl, blue eyes", 6],
    ["1girl,  blue eyes\nsmile", 7],
    ["1.5::1girl, blue eyes::", 6],
    ["{1girl}, [blue eyes]", 6],
    ["소녀, 파란 눈", 10],
    ["very aesthetic, masterpiece, no text", 8],
    ["nsfw, lowres, bad anatomy", 13],
  ])("matches the T5 fixture for %p", (text, expected) => {
    expect(t5.encode(text)).toHaveLength(expected);
  });

  it.each([
    ["", 0],
    ["1girl", 2],
    ["1girl, blue eyes", 5],
    ["1girl,  blue eyes\nsmile", 6],
    ["1.5::1girl, blue eyes::", 10],
    ["{1girl}, [blue eyes]", 9],
    ["소녀, 파란 눈", 11],
    ["very aesthetic, masterpiece, no text", 7],
    ["nsfw, lowres, bad anatomy", 7],
  ])("matches the CLIP fixture for %p", (text, expected) => {
    expect(clip.encode(text)).toHaveLength(expected);
  });

  it.each([
    [510, 511],
    [511, 512],
    [512, 513],
  ])("counts the T5 boundary at %i repeated tags", (tagCount, expected) => {
    expect(t5.encode(Array(tagCount).fill("girl").join(" "))).toHaveLength(
      expected,
    );
  });

  it.each([224, 225, 226])(
    "counts the CLIP boundary at %i repeated tags",
    (tagCount) => {
      expect(clip.encode(Array(tagCount).fill("a").join(" "))).toHaveLength(
        tagCount,
      );
    },
  );

  it("applies NovelAI T5 emphasis preprocessing", () => {
    expect(t5.encode("1.5::1girl, blue eyes::")).toEqual(
      t5.encode("1girl, blue eyes"),
    );
    expect(t5.encode("{1girl}, [blue eyes]")).toEqual(
      t5.encode("1girl, blue eyes"),
    );
  });
});
