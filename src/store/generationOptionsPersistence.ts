import type { NaiResolution, NoiseSchedule } from "../constants/generation";
import type { UcPresetIndex } from "../lib/naiPresets";

export const GENERATION_OPTIONS_PERSIST_DEBOUNCE_MS = 250;

type StoredCharacterPrompt = {
  id: string;
  name?: string;
  prompt: string;
  negativePrompt: string;
  enabled: boolean;
  position: { x: number; y: number };
};

type StoredCustomResolution = {
  id: string;
  width: number;
  height: number;
};

type StoredGenerationOptions = {
  prompt: string;
  negativePrompt: string;
  qualityToggle: boolean;
  ucPreset: UcPresetIndex;
  characterPrompts: StoredCharacterPrompt[];
  characterPromptExpandedIds: string[];
  characterPositionEnabled: boolean;
  model: string;
  resolution: NaiResolution;
  customResolutions: StoredCustomResolution[];
  steps: number;
  promptGuidance: number;
  promptGuidanceRescale: number;
  noiseSchedule: NoiseSchedule;
  sampler: string;
  seed: number;
  seedLocked: boolean;
  batchCount: number;
  varietyPlus: boolean;
  normalizeVibeStrengths: boolean;
  vibeReferenceExpandedIds: string[];
  preciseReferenceExpandedIds: string[];
  i2iSourceImage: {
    storagePath: string;
    width: number;
    height: number;
  };
  i2iEnabled: boolean;
  i2iStrength: number;
  i2iNoise: number;
  mainImageBlurred: boolean;
};

export type PersistedGenerationOptions = Partial<StoredGenerationOptions>;

export type PersistableGenerationState = Omit<
  StoredGenerationOptions,
  "i2iSourceImage"
> & {
  i2iSourceImage:
    | (StoredGenerationOptions["i2iSourceImage"] & { uri?: string })
    | null;
};

const PERSISTED_OPTION_KEYS = [
  "prompt",
  "negativePrompt",
  "qualityToggle",
  "ucPreset",
  "characterPrompts",
  "characterPromptExpandedIds",
  "characterPositionEnabled",
  "model",
  "resolution",
  "customResolutions",
  "steps",
  "promptGuidance",
  "promptGuidanceRescale",
  "noiseSchedule",
  "sampler",
  "seedLocked",
  "batchCount",
  "varietyPlus",
  "normalizeVibeStrengths",
  "vibeReferenceExpandedIds",
  "preciseReferenceExpandedIds",
  "i2iSourceImage",
  "i2iEnabled",
  "i2iStrength",
  "i2iNoise",
  "mainImageBlurred",
] as const satisfies readonly (keyof PersistableGenerationState)[];

export function selectPersistedOptions(
  state: PersistableGenerationState,
): PersistedGenerationOptions {
  return {
    prompt: state.prompt,
    negativePrompt: state.negativePrompt,
    qualityToggle: state.qualityToggle,
    ucPreset: state.ucPreset,
    characterPrompts: state.characterPrompts,
    characterPromptExpandedIds: state.characterPromptExpandedIds,
    characterPositionEnabled: state.characterPositionEnabled,
    model: state.model,
    resolution: state.resolution,
    customResolutions: state.customResolutions,
    steps: state.steps,
    promptGuidance: state.promptGuidance,
    promptGuidanceRescale: state.promptGuidanceRescale,
    noiseSchedule: state.noiseSchedule,
    sampler: state.sampler,
    ...(state.seedLocked ? { seed: state.seed } : {}),
    seedLocked: state.seedLocked,
    batchCount: state.batchCount,
    varietyPlus: state.varietyPlus,
    normalizeVibeStrengths: state.normalizeVibeStrengths,
    vibeReferenceExpandedIds: state.vibeReferenceExpandedIds,
    preciseReferenceExpandedIds: state.preciseReferenceExpandedIds,
    ...(state.i2iSourceImage
      ? {
          i2iSourceImage: {
            storagePath: state.i2iSourceImage.storagePath,
            width: state.i2iSourceImage.width,
            height: state.i2iSourceImage.height,
          },
        }
      : {}),
    i2iEnabled: state.i2iEnabled,
    i2iStrength: state.i2iStrength,
    i2iNoise: state.i2iNoise,
    mainImageBlurred: state.mainImageBlurred,
  };
}

function hasPersistedOptionsChanged(
  state: PersistableGenerationState,
  previousState: PersistableGenerationState,
): boolean {
  if (
    PERSISTED_OPTION_KEYS.some(
      (key) => state[key] !== previousState[key],
    )
  ) {
    return true;
  }

  return (
    (state.seedLocked || previousState.seedLocked) &&
    state.seed !== previousState.seed
  );
}

export function createGenerationOptionsPersistence({
  initialJson,
  write,
  debounceMs = GENERATION_OPTIONS_PERSIST_DEBOUNCE_MS,
}: {
  initialJson: string | null;
  write: (json: string) => void;
  debounceMs?: number;
}) {
  let lastJson = initialJson;
  let pendingState: PersistableGenerationState | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (!pendingState) return;

    const json = JSON.stringify(selectPersistedOptions(pendingState));
    pendingState = null;
    if (json === lastJson) return;

    lastJson = json;
    write(json);
  };

  const handleStateChange = (
    state: PersistableGenerationState,
    previousState: PersistableGenerationState,
  ) => {
    if (!hasPersistedOptionsChanged(state, previousState)) return;

    pendingState = state;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(flush, debounceMs);
  };

  return { flush, handleStateChange };
}
