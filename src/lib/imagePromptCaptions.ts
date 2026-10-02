import { getModelCapabilities } from "../constants/models";
import type { CharacterPrompt } from "../types/generation";
import type { GenerateNovelAiCharacterPrompt } from "./novelai";
import {
  appendAutoTextBlock,
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

// 모델 상한을 넘는 캐릭터는 앞에서부터 상한까지만 보낸다.
export function resolveActiveCharacterPrompts(
  characterPrompts: CharacterPrompt[],
  model: string,
): GenerateNovelAiCharacterPrompt[] {
  const active = characterPrompts.flatMap((item) => {
    if (!item.enabled) return [];

    const prompt = item.prompt.trim();
    const negativePrompt = item.negativePrompt.trim();
    // 공식 웹과 동일: 긍정 프롬프트가 빈 캐릭터는 보내지 않는다.
    if (!prompt) return [];

    return [{ prompt, negativePrompt, position: item.position }];
  });
  return active.slice(0, getModelCapabilities(model).maxCharacters);
}

export function prepareImagePromptCaptions({
  model,
  prompt,
  negativePrompt,
  qualityToggle,
  ucPreset,
  characterPrompts,
  autoText = true,
}: {
  model: string;
  prompt: string;
  negativePrompt: string;
  qualityToggle: boolean;
  ucPreset: UcPresetIndex;
  characterPrompts: GenerateNovelAiCharacterPrompt[];
  // false면 V5 자동 Text 블록을 붙이지 않는다 (토큰 수 계산용).
  autoText?: boolean;
}): PreparedImagePromptCaptions {
  const capabilities = getModelCapabilities(model);
  const supportsCharacterCaptions = capabilities.v4Prompt;
  const qualityCaption = mergeQualityTags(prompt, qualityToggle, model);
  const positiveBaseCaption =
    capabilities.v5Request && autoText
      ? appendAutoTextBlock(qualityCaption, [
          prompt,
          ...characterPrompts.map((item) => item.prompt),
        ])
      : qualityCaption;

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
