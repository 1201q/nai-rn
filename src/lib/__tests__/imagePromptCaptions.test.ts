import {
  prepareImagePromptCaptions,
  resolveActiveCharacterPrompts,
} from "../imagePromptCaptions";
import { createImageGenerationBody } from "../novelai";

const characters = [
  {
    id: "character-1",
    prompt: "hero",
    negativePrompt: "hat",
    enabled: true,
    position: { x: 0.2, y: 0.4 },
  },
  {
    id: "character-empty",
    prompt: "",
    negativePrompt: "",
    enabled: true,
    position: { x: 0.5, y: 0.5 },
  },
  {
    id: "character-disabled",
    prompt: "villain",
    negativePrompt: "",
    enabled: false,
    position: { x: 0.8, y: 0.4 },
  },
];

const requestDefaults = {
  prompt: "1girl",
  negativePrompt: "bad anatomy",
  characterPositionEnabled: true,
  width: 832,
  height: 1216,
  steps: 28,
  promptGuidance: 5,
  promptGuidanceRescale: 0,
  noiseSchedule: "karras" as const,
  sampler: "k_euler_ancestral",
  qualityToggle: true,
  ucPreset: 4 as const,
};

describe("image prompt captions", () => {
  it("filters disabled and entirely empty characters", () => {
    expect(resolveActiveCharacterPrompts(characters)).toEqual([
      {
        prompt: "hero",
        negativePrompt: "hat",
        position: { x: 0.2, y: 0.4 },
      },
    ]);
  });

  it("uses the same V4 captions in metrics preparation and payload", () => {
    const activeCharacters = resolveActiveCharacterPrompts(characters);
    const prepared = prepareImagePromptCaptions({
      model: "nai-diffusion-4-5-full",
      prompt: requestDefaults.prompt,
      negativePrompt: requestDefaults.negativePrompt,
      qualityToggle: requestDefaults.qualityToggle,
      ucPreset: requestDefaults.ucPreset,
      characterPrompts: activeCharacters,
    });
    const { body } = createImageGenerationBody({
      ...requestDefaults,
      model: "nai-diffusion-4-5-full",
      characterPrompts: activeCharacters,
    });
    const parameters = body.parameters;
    const v4Prompt = parameters.v4_prompt;
    const v4NegativePrompt = parameters.v4_negative_prompt;
    expect(v4Prompt).toBeDefined();
    expect(v4NegativePrompt).toBeDefined();
    if (!v4Prompt || !v4NegativePrompt) {
      throw new Error("Expected V4 prompt payloads.");
    }

    expect(body.input).toBe(prepared.positiveBaseCaption);
    expect(parameters.negative_prompt).toBe(prepared.negativeBaseCaption);
    expect(v4Prompt.caption.base_caption).toBe(
      prepared.positiveBaseCaption,
    );
    expect(v4NegativePrompt.caption.base_caption).toBe(
      prepared.negativeBaseCaption,
    );
    expect(
      v4Prompt.caption.char_captions.map(
        (item) => item.char_caption,
      ),
    ).toEqual(prepared.positiveCharacterCaptions);
    expect(
      v4NegativePrompt.caption.char_captions.map(
        (item) => item.char_caption,
      ),
    ).toEqual(prepared.negativeCharacterCaptions);
  });

  it("excludes V3 character captions", () => {
    const prepared = prepareImagePromptCaptions({
      model: "nai-diffusion-3",
      prompt: requestDefaults.prompt,
      negativePrompt: requestDefaults.negativePrompt,
      qualityToggle: requestDefaults.qualityToggle,
      ucPreset: requestDefaults.ucPreset,
      characterPrompts: resolveActiveCharacterPrompts(characters),
    });

    expect(prepared.positiveCharacterCaptions).toEqual([]);
    expect(prepared.negativeCharacterCaptions).toEqual([]);
  });

  it("drops characters without a positive prompt", () => {
    expect(
      resolveActiveCharacterPrompts([
        {
          id: "negative-only",
          prompt: " ",
          negativePrompt: "hat",
          enabled: true,
          position: { x: 0.5, y: 0.5 },
        },
      ]),
    ).toEqual([]);
  });

  it("sends official web i2i defaults", () => {
    const { seed, body } = createImageGenerationBody({
      ...requestDefaults,
      model: "nai-diffusion-4-5-full",
      seed: 100,
      i2iImageBase64: "abc",
    });
    expect(seed).toBe(100);
    expect(body.action).toBe("img2img");
    expect(body.parameters).toMatchObject({
      extra_noise_seed: 99,
      color_correct: false,
    });
  });

  it("resolves the noise schedule like the official web client", () => {
    const params = (
      model: string,
      sampler: string,
      noiseSchedule: "karras" | "native",
    ) =>
      createImageGenerationBody({
        ...requestDefaults,
        model,
        sampler,
        noiseSchedule,
      }).body.parameters as Record<string, unknown>;

    expect(params("nai-diffusion-4-5-full", "ddim_v3", "karras")).not.toHaveProperty(
      "noise_schedule",
    );
    expect(params("nai-diffusion-4-5-full", "k_euler", "native").noise_schedule).toBe(
      "karras",
    );
    expect(params("nai-diffusion-4-5-full", "k_dpmpp_2m", "native").noise_schedule).toBe(
      "exponential",
    );
    expect(params("nai-diffusion-3", "k_euler", "native").noise_schedule).toBe(
      "native",
    );
  });

  it("enables V3 auto SMEA only above the web threshold", () => {
    const params = (model: string, size: number) =>
      createImageGenerationBody({
        ...requestDefaults,
        model,
        width: size,
        height: size,
      }).body.parameters as Record<string, unknown>;

    expect(params("nai-diffusion-3", 1536).sm).toBe(true);
    expect(params("nai-diffusion-3", 1472).sm).toBe(false);
    expect(params("nai-diffusion-4-5-full", 1536)).not.toHaveProperty("sm");
  });

  it("disables the Euler Ancestral bug like the official web client", () => {
    // V4 이상은 native를 karras로 바꿔 보내므로 native 조합은 V3로 확인한다.
    const params = (sampler: string, noiseSchedule: "karras" | "native") =>
      createImageGenerationBody({
        ...requestDefaults,
        model: "nai-diffusion-3",
        sampler,
        noiseSchedule,
      }).body.parameters as Record<string, unknown>;

    expect(params("k_euler_ancestral", "karras")).toMatchObject({
      deliberate_euler_ancestral_bug: false,
      prefer_brownian: true,
    });
    for (const parameters of [
      params("k_euler_ancestral", "native"),
      params("k_euler", "karras"),
    ]) {
      expect(parameters).not.toHaveProperty("deliberate_euler_ancestral_bug");
      expect(parameters).not.toHaveProperty("prefer_brownian");
    }
  });
});
