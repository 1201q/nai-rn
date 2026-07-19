import { MAX_CHARACTER_PROMPTS } from "../constants/generation";
import { useGenerationStore } from "../store/generationStore";
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

export function applyMetadataImport(
  parsed: ParsedNaiMetadata,
  selection: MetadataImportSelection,
) {
  const state = useGenerationStore.getState();

  if (selection.prompt && parsed.prompt !== undefined) {
    state.setPrompt(parsed.prompt);
  }
  if (selection.negativePrompt && parsed.negativePrompt !== undefined) {
    state.setNegativePrompt(parsed.negativePrompt);
  }
  if (selection.characters && parsed.characters) {
    const characters =
      selection.characterMode === "append"
        ? [...state.characterPrompts, ...parsed.characters].slice(
            0,
            MAX_CHARACTER_PROMPTS,
          )
        : parsed.characters;
    state.setCharacterPrompts(characters);
  }
  if (selection.settings) {
    if (parsed.model !== undefined) state.setModel(parsed.model);
    if (parsed.resolution !== undefined) {
      state.setResolution(parsed.resolution);
    }
    if (parsed.steps !== undefined) state.setSteps(parsed.steps);
    if (parsed.promptGuidance !== undefined) {
      state.setPromptGuidance(parsed.promptGuidance);
    }
    if (parsed.promptGuidanceRescale !== undefined) {
      state.setPromptGuidanceRescale(parsed.promptGuidanceRescale);
    }
    if (parsed.noiseSchedule !== undefined) {
      state.setNoiseSchedule(parsed.noiseSchedule);
    }
    if (parsed.sampler !== undefined) state.setSampler(parsed.sampler);
    if (parsed.varietyPlus !== undefined) {
      state.setVarietyPlus(parsed.varietyPlus);
    }
    if (parsed.qualityToggle !== undefined) {
      state.setQualityToggle(parsed.qualityToggle);
    }
    if (parsed.ucPreset !== undefined) state.setUcPreset(parsed.ucPreset);
  }
  if (selection.seed && parsed.seed !== undefined) {
    state.setSeed(parsed.seed);
  }
}
