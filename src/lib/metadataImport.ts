import { getModelCapabilities } from "../constants/models";
import type { ParsedNaiMetadata } from "./naiMetadata";

export type MetadataCharacterImportMode = "replace" | "append";

export type MetadataImportSelection = {
  prompt: boolean;
  negativePrompt: boolean;
  characters: boolean;
  characterMode: MetadataCharacterImportMode;
  settings: boolean;
  seed: boolean;
};

export type MetadataImportAvailability = {
  prompt: boolean;
  negativePrompt: boolean;
  characters: boolean;
  settings: boolean;
  seed: boolean;
};

export type MetadataImportState = {
  prompt: string;
  negativePrompt: string;
  characterPrompts: NonNullable<ParsedNaiMetadata["characters"]>;
  characterPositionEnabled: boolean;
  model: string;
  resolution: NonNullable<ParsedNaiMetadata["resolution"]>;
  steps: number;
  promptGuidance: number;
  promptGuidanceRescale: number;
  noiseSchedule: NonNullable<ParsedNaiMetadata["noiseSchedule"]>;
  sampler: string;
  varietyPlus: boolean;
  qualityPreset: NonNullable<ParsedNaiMetadata["qualityPreset"]>;
  ucPreset: NonNullable<ParsedNaiMetadata["ucPreset"]>;
  seed: number;
};

export type MetadataImportPatch = Partial<MetadataImportState>;

export function getMetadataImportAvailability(
  parsed: ParsedNaiMetadata,
): MetadataImportAvailability {
  return {
    prompt: parsed.prompt !== undefined,
    negativePrompt: parsed.negativePrompt !== undefined,
    characters: Boolean(parsed.characters?.length),
    settings: parsed.hasSettings,
    seed: parsed.seed !== undefined,
  };
}

export function createMetadataImportSelection(
  parsed: ParsedNaiMetadata,
): MetadataImportSelection {
  const available = getMetadataImportAvailability(parsed);
  return {
    prompt: available.prompt,
    negativePrompt: available.negativePrompt,
    characters: available.characters,
    characterMode: "replace",
    settings: available.settings,
    seed: false,
  };
}

export function hasSelectedMetadataImport(
  selection: MetadataImportSelection,
  available: MetadataImportAvailability,
) {
  return (
    (available.prompt && selection.prompt) ||
    (available.negativePrompt && selection.negativePrompt) ||
    (available.characters && selection.characters) ||
    (available.settings && selection.settings) ||
    (available.seed && selection.seed)
  );
}

export function buildMetadataImportPatch(
  state: MetadataImportState,
  parsed: ParsedNaiMetadata,
  selection: MetadataImportSelection,
): MetadataImportPatch {
  const patch: MetadataImportPatch = {};
  if (selection.prompt && parsed.prompt !== undefined) {
    patch.prompt = parsed.prompt;
  }
  if (selection.negativePrompt && parsed.negativePrompt !== undefined) {
    patch.negativePrompt = parsed.negativePrompt;
  }
  if (selection.characters && parsed.characters) {
    // 설정도 함께 가져오면 모델이 바뀌므로 그 모델의 상한을 쓴다.
    const model =
      selection.settings && parsed.model !== undefined
        ? parsed.model
        : state.model;
    patch.characterPrompts =
      selection.characterMode === "append"
        ? [...state.characterPrompts, ...parsed.characters].slice(
            0,
            getModelCapabilities(model).maxCharacters,
          )
        : parsed.characters;
    // 위치 모드는 캐릭터를 통째로 바꿀 때만 이미지 값을 따른다 (추가하면 기존 캐릭터와 섞이므로).
    if (
      selection.characterMode === "replace" &&
      parsed.characterPositionEnabled !== undefined
    ) {
      patch.characterPositionEnabled = parsed.characterPositionEnabled;
    }
  }
  if (selection.settings) {
    if (parsed.model !== undefined) patch.model = parsed.model;
    if (parsed.resolution !== undefined) {
      patch.resolution = parsed.resolution;
    }
    if (parsed.steps !== undefined) patch.steps = parsed.steps;
    if (parsed.promptGuidance !== undefined) {
      patch.promptGuidance = parsed.promptGuidance;
    }
    if (parsed.promptGuidanceRescale !== undefined) {
      patch.promptGuidanceRescale = parsed.promptGuidanceRescale;
    }
    if (parsed.noiseSchedule !== undefined) {
      patch.noiseSchedule = parsed.noiseSchedule;
    }
    if (parsed.sampler !== undefined) patch.sampler = parsed.sampler;
    if (parsed.varietyPlus !== undefined) {
      patch.varietyPlus = parsed.varietyPlus;
    }
    if (parsed.qualityPreset !== undefined) {
      patch.qualityPreset = parsed.qualityPreset;
    }
    if (parsed.ucPreset !== undefined) patch.ucPreset = parsed.ucPreset;
  }
  if (selection.seed && parsed.seed !== undefined) {
    patch.seed = parsed.seed;
  }

  return patch;
}
