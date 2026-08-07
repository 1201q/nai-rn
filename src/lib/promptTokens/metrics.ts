import { getImagePromptTokenPolicy } from "../../constants/generation";
import type { CharacterPrompt } from "../../store/generationStore";
import {
  prepareImagePromptCaptions,
  resolveActiveCharacterPrompts,
} from "../imagePromptCaptions";
import type { UcPresetIndex } from "../naiPresets";
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
  qualityToggle: boolean;
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
  );
  const captions = prepareImagePromptCaptions({
    model: withDraft.model,
    prompt: withDraft.prompt,
    negativePrompt: withDraft.negativePrompt,
    qualityToggle: withDraft.qualityToggle,
    ucPreset: withDraft.ucPreset,
    characterPrompts: activeCharacters,
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
    (policy.tokenizer === "t5" &&
      Boolean(character?.enabled) &&
      Boolean(character?.prompt.trim() || character?.negativePrompt.trim()));
  const fieldCaption =
    target.scope === "base"
      ? baseCaption
      : target.channel === "positive"
        ? (character?.prompt.trim() ?? draftText.trim())
        : (character?.negativePrompt.trim() ?? draftText.trim());
  const fieldTokens = tokenizer.encode(fieldCaption).length;
  const totalTokens = [baseCaption, ...characterCaptions].reduce(
    (total, caption) => total + tokenizer.encode(caption).length,
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
