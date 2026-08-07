import type { CharacterPrompt } from "../store/generationStore";
import type { GenerateNovelAiCharacterPrompt } from "./novelai";
import {
  mergeQualityTags,
  mergeUcPreset,
  type UcPresetIndex,
} from "./naiPresets";

export type PreparedImagePromptCaptions = {
  positiveBaseCaption: string;
  negativeBaseCaption: string;
  positiveCharacterCaptions: string[];
  negativeCharacterCaptions: string[];
};

export function resolveActiveCharacterPrompts(
  characterPrompts: CharacterPrompt[],
): GenerateNovelAiCharacterPrompt[] {
  return characterPrompts.flatMap((item) => {
    if (!item.enabled) return [];

    const prompt = item.prompt.trim();
    const negativePrompt = item.negativePrompt.trim();
    if (!prompt && !negativePrompt) return [];

    return [{ prompt, negativePrompt, position: item.position }];
  });
}

export function prepareImagePromptCaptions({
  model,
  prompt,
  negativePrompt,
  qualityToggle,
  ucPreset,
  characterPrompts,
}: {
  model: string;
  prompt: string;
  negativePrompt: string;
  qualityToggle: boolean;
  ucPreset: UcPresetIndex;
  characterPrompts: GenerateNovelAiCharacterPrompt[];
}): PreparedImagePromptCaptions {
  const supportsCharacterCaptions = model.startsWith("nai-diffusion-4");

  return {
    positiveBaseCaption: mergeQualityTags(prompt, qualityToggle),
    negativeBaseCaption: mergeUcPreset(negativePrompt, ucPreset),
    positiveCharacterCaptions: supportsCharacterCaptions
      ? characterPrompts.map((item) => item.prompt)
      : [],
    negativeCharacterCaptions: supportsCharacterCaptions
      ? characterPrompts.map((item) => item.negativePrompt)
      : [],
  };
}
