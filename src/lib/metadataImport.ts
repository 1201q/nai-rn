import { MAX_CHARACTER_PROMPTS } from "../constants/generation";
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
  model: string;
  resolution: NonNullable<ParsedNaiMetadata["resolution"]>;
  steps: number;
  promptGuidance: number;
  promptGuidanceRescale: number;
  noiseSchedule: NonNullable<ParsedNaiMetadata["noiseSchedule"]>;
  sampler: string;
  varietyPlus: boolean;
  qualityToggle: boolean;
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

export function hasImportableMetadata(parsed: ParsedNaiMetadata) {
  return Object.values(getMetadataImportAvailability(parsed)).some(Boolean);
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
    patch.characterPrompts =
      selection.characterMode === "append"
        ? [...state.characterPrompts, ...parsed.characters].slice(
            0,
            MAX_CHARACTER_PROMPTS,
          )
        : parsed.characters;
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
    if (parsed.qualityToggle !== undefined) {
      patch.qualityToggle = parsed.qualityToggle;
    }
    if (parsed.ucPreset !== undefined) patch.ucPreset = parsed.ucPreset;
  }
  if (selection.seed && parsed.seed !== undefined) {
    patch.seed = parsed.seed;
  }

  return patch;
}
