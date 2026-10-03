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
    ["1girl,  blue eyes\nsmile", 8],
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

  // 웹 표시값(2026-10-03): 공백이 두 칸인 곳이 두 군데 있어 그대로 세면 330이 나온다.
  it("matches the web count for a long prompt with repeated spaces", () => {
    const prompt =
      "1girl, 2::solo::, 2::artist:kitano yukito::, 0.3::artist:mignon::,   \n0.3::artist:hiro (dismaless)::, 0.8::artist:mx2j::, artist:natonyanya,\n\n2::artist:kokosando, artist:yutokamizu, artist:9ml,\nartist:7peach, \nartist:jell (jell y fish),\nartist:hwansang ::,\n\n-1::censored::, -5::bad anatomy::, 0.3::location ::, best quality, best illustration, masterpiece, highres, -2::upscaled ::, solo artist, -2::multiple views::,-6::artist collaboration ::, -3::simple illustration::, no text, magazine shoot, novel illustration, year 2025, year 2024, amazing quality, very aesthetic, absurdres,  -1::window::, -1::sky::, 2::blurry, blurry background::, stairs, park, falling petals, \n\n2::3d background, photo background, ai-generated background, screenshot background, game screenshot background, atmospheric perspective::,\n\n\nwide shot, dutch angle, cropped, 5::saturated::, -1::ligne claire ::, 1.7::flat color::,  soft shadow, -2::soft colors::, -3::outlines::, -4::clean lineart::, 0.5::white theme::, dating, couple";
    expect(qwen.countTokens(prompt)).toBe(328);
  });

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
