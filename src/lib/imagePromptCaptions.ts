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
    // 공식 웹과 동일: 긍정 프롬프트가 빈 캐릭터는 보내지 않는다.
    if (!prompt) return [];

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
  const positiveBaseCaption = mergeQualityTags(prompt, qualityToggle, model);

  return {
    positiveBaseCaption,
    negativeBaseCaption: mergeUcPreset(
      negativePrompt,
      ucPreset,
      model,
      positiveBaseCaption,
    ),
    positiveCharacterCaptions: supportsCharacterCaptions
      ? characterPrompts.map((item) => item.prompt)
      : [],
    negativeCharacterCaptions: supportsCharacterCaptions
      ? characterPrompts.map((item) => item.negativePrompt)
      : [],
  };
}
