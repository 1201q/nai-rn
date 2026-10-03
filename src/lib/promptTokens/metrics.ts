import { getImagePromptTokenPolicy } from "../../constants/models";
import type { CharacterPrompt } from "../../types/generation";
import {
  prepareImagePromptCaptions,
  resolveActiveCharacterPrompts,
} from "../imagePromptCaptions";
import type { QualityPreset, UcPresetIndex } from "../naiPresets";
import { getPromptTokenizer } from "./loader";

export type PromptTokenChannel = "positive" | "negative";

export type PromptTokenTarget =
  | { scope: "base"; channel: PromptTokenChannel }
  | {
      scope: "character";
      characterId: string;
      channel: PromptTokenChannel;
    };

export type PromptTokenMetrics = {
  status: "loading" | "ready" | "error" | "unavailable";
  fieldTokens: number | null;
  totalTokens: number | null;
  maxTokens: number | null;
  remainingTokens: number | null;
  includedInTotal: boolean;
};

export type PromptTokenSnapshot = {
  model: string;
  prompt: string;
  negativePrompt: string;
  qualityPreset: QualityPreset;
  ucPreset: UcPresetIndex;
  characterPrompts: CharacterPrompt[];
};

function applyDraft(
  snapshot: PromptTokenSnapshot,
  target: PromptTokenTarget,
  draftText: string,
): PromptTokenSnapshot {
  if (target.scope === "base") {
    return {
      ...snapshot,
      ...(target.channel === "positive"
        ? { prompt: draftText }
        : { negativePrompt: draftText }),
    };
  }

  return {
    ...snapshot,
    characterPrompts: snapshot.characterPrompts.map((item) =>
      item.id === target.characterId
        ? {
            ...item,
            ...(target.channel === "positive"
              ? { prompt: draftText }
              : { negativePrompt: draftText }),
          }
        : item,
    ),
  };
}

export async function calculatePromptTokenMetrics(
  snapshot: PromptTokenSnapshot,
  target: PromptTokenTarget,
  draftText: string,
): Promise<PromptTokenMetrics> {
  const policy = getImagePromptTokenPolicy(snapshot.model);
  if (!policy) {
    return {
      status: "unavailable",
      fieldTokens: null,
      totalTokens: null,
      maxTokens: null,
      remainingTokens: null,
      includedInTotal: false,
    };
  }

  const withDraft = applyDraft(snapshot, target, draftText);
  const character =
    target.scope === "character"
      ? withDraft.characterPrompts.find(
          (item) => item.id === target.characterId,
        )
      : undefined;
  const activeCharacters = resolveActiveCharacterPrompts(
    withDraft.characterPrompts,
    withDraft.model,
  );
  const captions = prepareImagePromptCaptions({
    model: withDraft.model,
    prompt: withDraft.prompt,
    negativePrompt: withDraft.negativePrompt,
    qualityPreset: withDraft.qualityPreset,
    ucPreset: withDraft.ucPreset,
    characterPrompts: activeCharacters,
    // 공식 웹과 동일: 자동 Text 블록은 토큰 수에 넣지 않는다.
    autoText: false,
  });
  const tokenizer = await getPromptTokenizer(policy.tokenizer);
  const baseCaption =
    target.channel === "positive"
      ? captions.positiveBaseCaption
      : captions.negativeBaseCaption;
  const characterCaptions =
    target.channel === "positive"
      ? captions.positiveCharacterCaptions
      : captions.negativeCharacterCaptions;
  const includedInTotal =
    target.scope === "base" ||
    (policy.tokenizer !== "clip" &&
      Boolean(character?.enabled) &&
      Boolean(character?.prompt.trim()));
  const fieldCaption =
    target.scope === "base"
      ? baseCaption
      : target.channel === "positive"
        ? (character?.prompt.trim() ?? draftText.trim())
        : (character?.negativePrompt.trim() ?? draftText.trim());
  const fieldTokens = tokenizer.countTokens(fieldCaption);
  const totalTokens = [baseCaption, ...characterCaptions].reduce(
    (total, caption) => total + tokenizer.countTokens(caption),
    0,
  );

  return {
    status: "ready",
    fieldTokens,
    totalTokens,
    maxTokens: policy.maxTokens,
    remainingTokens: policy.maxTokens - totalTokens,
    includedInTotal,
  };
}
