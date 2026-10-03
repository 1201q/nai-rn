// 모델별 판정 결과를 고정한다. capability 테이블로 옮기기 전후의 동작이 같아야 한다.
import { estimateAnlasCost } from "../../lib/anlasCost";
import { prepareImagePromptCaptions } from "../../lib/imagePromptCaptions";
import { mergeQualityTags, mergeUcPreset } from "../../lib/naiPresets";
import {
  createImageGenerationBody,
  getVarietyPlusSigma,
  resolveNoiseSchedule,
  shouldUseAutoSmea,
} from "../../lib/novelai";
import {
  DEFAULT_MODEL,
  getImagePromptTokenPolicy,
  getModelCapabilities,
  MODELS,
} from "../models";

type ExpectedBehavior = {
  v4Prompt: boolean;
  autoSmea: boolean;
  nativeScheduleReplaced: boolean;
  // 없으면 Variety+를 지원하지 않는 모델
  varietyPlusSigma?: number;
  addsNsfwToUc: boolean;
  vibeAnlasCost: number;
  // 없으면 토큰 정책이 없는 모델
  tokenizer?: "t5" | "clip" | "qwen";
  maxTokens?: number;
};

const EXPECTED: Record<string, ExpectedBehavior> = {
  "nai-diffusion-5-full": {
    v4Prompt: true,
    autoSmea: false,
    nativeScheduleReplaced: true,
    addsNsfwToUc: true,
    vibeAnlasCost: 0,
    tokenizer: "qwen",
    maxTokens: 1471,
  },
  "nai-diffusion-5-curated": {
    v4Prompt: true,
    autoSmea: false,
    nativeScheduleReplaced: true,
    addsNsfwToUc: false,
    vibeAnlasCost: 0,
    tokenizer: "qwen",
    maxTokens: 703,
  },
  "nai-diffusion-4-5-full": {
    v4Prompt: true,
    autoSmea: false,
    nativeScheduleReplaced: true,
    varietyPlusSigma: 58,
    addsNsfwToUc: true,
    vibeAnlasCost: 22,
    tokenizer: "t5",
    maxTokens: 512,
  },
  "nai-diffusion-4-5-curated": {
    v4Prompt: true,
    autoSmea: false,
    nativeScheduleReplaced: true,
    varietyPlusSigma: 58,
    addsNsfwToUc: false,
    vibeAnlasCost: 22,
    tokenizer: "t5",
    maxTokens: 512,
  },
  "nai-diffusion-4-curated-preview": {
    v4Prompt: true,
    autoSmea: false,
    nativeScheduleReplaced: true,
    varietyPlusSigma: 19,
    addsNsfwToUc: false,
    vibeAnlasCost: 22,
    tokenizer: "t5",
    maxTokens: 512,
  },
  "nai-diffusion-3": {
    v4Prompt: false,
    autoSmea: true,
    nativeScheduleReplaced: false,
    varietyPlusSigma: 19,
    addsNsfwToUc: true,
    vibeAnlasCost: 0,
    tokenizer: "clip",
    maxTokens: 225,
  },
  "nai-diffusion-furry-3": {
    v4Prompt: false,
    autoSmea: true,
    nativeScheduleReplaced: false,
    varietyPlusSigma: 19,
    addsNsfwToUc: true,
    vibeAnlasCost: 0,
    tokenizer: "clip",
    maxTokens: 225,
  },
};

const REQUEST = {
  prompt: "1girl",
  negativePrompt: "",
  characterPrompts: [
    { prompt: "hero", negativePrompt: "", position: { x: 0.5, y: 0.5 } },
  ],
  width: 832,
  height: 1216,
  steps: 28,
  promptGuidance: 5,
  promptGuidanceRescale: 0,
  noiseSchedule: "karras" as const,
  sampler: "k_euler_ancestral",
  seed: 1,
};

describe.each(Object.entries(EXPECTED))("%s", (model, expected) => {
  it("uses the V4 prompt structure only for V4+ models", () => {
    const { body } = createImageGenerationBody({ ...REQUEST, model });
    const parameters = body.parameters as Record<string, unknown>;
    expect("v4_prompt" in parameters).toBe(expected.v4Prompt);
    expect("sm" in parameters).toBe(!expected.v4Prompt);

    const captions = prepareImagePromptCaptions({
      model,
      prompt: "1girl",
      negativePrompt: "",
      qualityPreset: "none" as const,
      ucPreset: 4,
      characterPrompts: REQUEST.characterPrompts,
    });
    expect(captions.positiveCharacterCaptions.length > 0).toBe(
      expected.v4Prompt,
    );
  });

  it("merges quality tags with the V4 or V3 rule", () => {
    // V4는 첫 세그먼트에만, V3는 "|" 세그먼트마다 붙인다.
    const merged = mergeQualityTags("a|b", "standard", model);
    const segments = merged.split("|");
    expect(segments[1] === "b").toBe(expected.v4Prompt);
  });

  it("enables auto SMEA only for V3 models", () => {
    expect(shouldUseAutoSmea(model, 1536, 1536, "k_euler", false)).toBe(
      expected.autoSmea,
    );
  });

  it("replaces the native noise schedule only for V4+ models", () => {
    expect(resolveNoiseSchedule(model, "k_euler", "native")).toBe(
      expected.nativeScheduleReplaced ? "karras" : "native",
    );
  });

  it("uses the model's Variety+ base sigma", () => {
    const sigma = getVarietyPlusSigma(model, 832, 1216);
    if (expected.varietyPlusSigma === undefined) {
      expect(sigma).toBeUndefined();
    } else {
      expect(sigma).toBeCloseTo(expected.varietyPlusSigma);
    }
  });

  it("adds nsfw to the UC preset except for curated models", () => {
    expect(mergeUcPreset("", 0, model, "1girl").startsWith("nsfw")).toBe(
      expected.addsNsfwToUc,
    );
  });

  it("charges vibe costs only for vibe-capable models", () => {
    const base = {
      model,
      width: 832,
      height: 1216,
      steps: 28,
      strength: 1,
      smea: false,
      batchCount: 1,
      tier: 3,
      expiresAt: 2,
      nowSeconds: 1,
      activePreciseReferenceCount: 0,
    };
    const withVibes = estimateAnlasCost({
      ...base,
      activeVibeCount: 6,
      unencodedVibeCount: 9,
    });
    const withoutVibes = estimateAnlasCost({
      ...base,
      activeVibeCount: 0,
      unencodedVibeCount: 0,
    });
    // 4개 초과분 2개 x 2 + 미인코딩 9개 x 2
    expect(withVibes - withoutVibes).toBe(expected.vibeAnlasCost);
  });

  it("uses the model's prompt tokenizer", () => {
    expect(getImagePromptTokenPolicy(model)).toEqual(
      expected.tokenizer
        ? { tokenizer: expected.tokenizer, maxTokens: expected.maxTokens }
        : undefined,
    );
  });
});

it("forces the Karras schedule and params_version 4 only for V5", () => {
  expect(
    MODELS.map(({ value }) => [
      value,
      resolveNoiseSchedule(value, "k_euler", "exponential"),
      createImageGenerationBody({ ...REQUEST, model: value }).body.parameters
        .params_version,
    ]),
  ).toEqual([
    ["nai-diffusion-5-full", "karras", 4],
    ["nai-diffusion-5-curated", "karras", 4],
    ["nai-diffusion-4-5-full", "exponential", 3],
    ["nai-diffusion-4-5-curated", "exponential", 3],
    ["nai-diffusion-4-curated-preview", "exponential", 3],
    ["nai-diffusion-3", "exponential", 3],
    ["nai-diffusion-furry-3", "exponential", 3],
  ]);
});

it("has no token policy for unknown models", () => {
  expect(getImagePromptTokenPolicy("unknown-model")).toBeUndefined();
});

it("supports Vibe Transfer on V4+ and Precise Reference only on V4.5", () => {
  expect(
    MODELS.map(({ value }) => [
      value,
      getModelCapabilities(value).vibeTransfer,
      getModelCapabilities(value).preciseReference,
    ]),
  ).toEqual([
    ["nai-diffusion-5-full", false, false],
    ["nai-diffusion-5-curated", false, false],
    ["nai-diffusion-4-5-full", true, true],
    ["nai-diffusion-4-5-curated", true, true],
    ["nai-diffusion-4-curated-preview", true, false],
    ["nai-diffusion-3", false, false],
    ["nai-diffusion-furry-3", false, false],
  ]);
});

it("uses the default request shape without references for unknown models", () => {
  expect(getModelCapabilities("unknown-model")).toEqual({
    ...getModelCapabilities(DEFAULT_MODEL),
    vibeTransfer: false,
    preciseReference: false,
  });
});

it("allows 22 characters on V5 and 6 elsewhere", () => {
  expect(
    MODELS.map(({ value }) => getModelCapabilities(value).maxCharacters),
  ).toEqual([22, 22, 6, 6, 6, 6, 6]);
});

it("allows positioning a single character only on V5", () => {
  expect(
    MODELS.map(
      ({ value }) => getModelCapabilities(value).minPositionCharacters,
    ),
  ).toEqual([1, 1, 2, 2, 2, 2, 2]);
});
