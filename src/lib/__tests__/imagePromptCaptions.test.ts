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
});
