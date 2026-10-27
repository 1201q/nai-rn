import {
  isNoiseSchedule,
  resolutionFromDimensions,
  type NaiResolution,
} from "../constants/generation";
import {
  MAX_STORED_CHARACTER_PROMPTS,
  type ModelSettings,
} from "../constants/models";
import { isBoolean, isNumber, isString } from "../lib/guards";
import { resolveStoredI2IReference } from "../lib/i2iReference";
import { isQualityPreset, isUcPresetIndex } from "../lib/naiPresets";
import { storage } from "../lib/storage";
import type { CharacterPrompt, I2ISourceImage } from "../types/generation";
import {
  GENERATION_OPTIONS_STORAGE_KEY,
  HISTORY_GRID_COLUMN_OPTIONS,
  HISTORY_LIST_ENGINES,
  type PersistedGenerationOptions,
} from "./generationOptionsPersistence";
import type { GenerationState } from "./generationStoreTypes";

function resolveStoredI2ISourceImage(value: unknown): I2ISourceImage | null {
  if (!value || typeof value !== "object") return null;
  const image = value as Partial<I2ISourceImage>;
  if (
    !isString(image.storagePath) ||
    !isNumber(image.width) ||
    !isNumber(image.height) ||
    image.width <= 0 ||
    image.height <= 0
  ) {
    return null;
  }

  return resolveStoredI2IReference({
    storagePath: image.storagePath,
    width: image.width,
    height: image.height,
  });
}

function resolveStoredResolution(value: unknown): NaiResolution | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<NaiResolution>;
  if (!isNumber(candidate.width) || !isNumber(candidate.height)) {
    return null;
  }

  return resolutionFromDimensions(candidate.width, candidate.height);
}

function resolveStoredSettingsByModel(
  value: unknown,
): Record<string, ModelSettings> {
  if (!value || typeof value !== "object") return {};
  const result: Record<string, ModelSettings> = {};
  for (const [model, item] of Object.entries(value)) {
    const candidate = item as Partial<ModelSettings> | null;
    const resolution = resolveStoredResolution(candidate?.resolution);
    if (
      resolution &&
      isNumber(candidate?.steps) &&
      isNumber(candidate?.promptGuidance) &&
      isNumber(candidate?.promptGuidanceRescale) &&
      isString(candidate?.sampler) &&
      isNoiseSchedule(candidate?.noiseSchedule) &&
      isBoolean(candidate?.varietyPlus)
    ) {
      result[model] = {
        resolution,
        steps: candidate.steps,
        promptGuidance: candidate.promptGuidance,
        promptGuidanceRescale: candidate.promptGuidanceRescale,
        sampler: candidate.sampler,
        noiseSchedule: candidate.noiseSchedule,
        varietyPlus: candidate.varietyPlus,
      };
    }
  }
  return result;
}

function resolveStoredCharacterPrompts(value: unknown): CharacterPrompt[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.slice(0, MAX_STORED_CHARACTER_PROMPTS).flatMap((item, index) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const candidate = item as Partial<CharacterPrompt>;
    const position =
      candidate.position &&
      isNumber(candidate.position.x) &&
      isNumber(candidate.position.y)
        ? {
            x: Math.max(0, Math.min(1, candidate.position.x)),
            y: Math.max(0, Math.min(1, candidate.position.y)),
          }
        : { x: 0.5, y: 0.5 };

    return [
      {
        id: isString(candidate.id) ? candidate.id : `stored-character-${index}`,
        ...(isString(candidate.name) ? { name: candidate.name } : {}),
        prompt: isString(candidate.prompt) ? candidate.prompt : "",
        negativePrompt: isString(candidate.negativePrompt)
          ? candidate.negativePrompt
          : "",
        enabled: isBoolean(candidate.enabled) ? candidate.enabled : true,
        position,
      },
    ];
  });
}

// 부팅 시 MMKV에서 저장된 옵션을 동기 읽기 → store 초기 state로 즉시 복원.
// 손상/구버전 데이터 방어를 위해 필드별 타입 검증 후 통과한 값만 반환.
export function loadPersistedOptions(): Partial<GenerationState> {
  const stored = storage.getString(GENERATION_OPTIONS_STORAGE_KEY);
  if (!stored) return {};

  try {
    const parsed = JSON.parse(stored) as PersistedGenerationOptions;
    const next: Partial<GenerationState> = {};
    if (isString(parsed.prompt)) next.prompt = parsed.prompt;
    if (isString(parsed.negativePrompt)) {
      next.negativePrompt = parsed.negativePrompt;
    }
    if (isQualityPreset(parsed.qualityPreset)) {
      next.qualityPreset = parsed.qualityPreset;
    } else if (isBoolean(parsed.qualityToggle)) {
      // 이전 버전의 저장값 (Light 도입 전)
      next.qualityPreset = parsed.qualityToggle ? "standard" : "none";
    }
    if (isBoolean(parsed.transparentBackground)) {
      next.transparentBackground = parsed.transparentBackground;
    }
    if (isUcPresetIndex(parsed.ucPreset)) next.ucPreset = parsed.ucPreset;
    next.characterPrompts = resolveStoredCharacterPrompts(
      parsed.characterPrompts,
    );
    if (Array.isArray(parsed.characterPromptExpandedIds)) {
      next.characterPromptExpandedIds =
        parsed.characterPromptExpandedIds.filter(isString);
    }
    if (isBoolean(parsed.characterPositionEnabled)) {
      next.characterPositionEnabled = parsed.characterPositionEnabled;
    }
    if (isString(parsed.model)) next.model = parsed.model;

    const storedResolution = resolveStoredResolution(parsed.resolution);
    if (storedResolution) next.resolution = storedResolution;

    if (isNumber(parsed.steps)) next.steps = parsed.steps;
    if (isNumber(parsed.promptGuidance)) {
      next.promptGuidance = parsed.promptGuidance;
    }
    next.settingsByModel = resolveStoredSettingsByModel(parsed.settingsByModel);
    if (isNumber(parsed.promptGuidanceRescale)) {
      next.promptGuidanceRescale = parsed.promptGuidanceRescale;
    }
    if (isNoiseSchedule(parsed.noiseSchedule)) {
      next.noiseSchedule = parsed.noiseSchedule;
    }
    if (isString(parsed.sampler)) next.sampler = parsed.sampler;
    if (isNumber(parsed.seed)) next.seed = parsed.seed;
    if (isBoolean(parsed.seedLocked)) next.seedLocked = parsed.seedLocked;
    if (isNumber(parsed.batchCount)) next.batchCount = parsed.batchCount;
    if (parsed.imageFormat === "png" || parsed.imageFormat === "webp") {
      next.imageFormat = parsed.imageFormat;
    }
    if (
      parsed.imageSaveDirectory === null ||
      (isString(parsed.imageSaveDirectory) &&
        /^(content|file):\/\//.test(parsed.imageSaveDirectory))
    ) {
      next.imageSaveDirectory = parsed.imageSaveDirectory;
    }
    if (isBoolean(parsed.varietyPlus)) next.varietyPlus = parsed.varietyPlus;
    if (isBoolean(parsed.normalizeVibeStrengths)) {
      next.normalizeVibeStrengths = parsed.normalizeVibeStrengths;
    }
    const storedI2IImage = resolveStoredI2ISourceImage(parsed.i2iSourceImage);
    if (storedI2IImage) {
      next.i2iSourceImage = storedI2IImage;
      next.i2iEnabled = isBoolean(parsed.i2iEnabled) ? parsed.i2iEnabled : true;
    }
    if (isNumber(parsed.i2iStrength)) {
      next.i2iStrength = parsed.i2iStrength;
    }
    if (isNumber(parsed.i2iNoise)) next.i2iNoise = parsed.i2iNoise;
    if (isBoolean(parsed.mainImageBlurred)) {
      next.mainImageBlurred = parsed.mainImageBlurred;
    }
    if (isBoolean(parsed.mainImageLocked)) {
      next.mainImageLocked = parsed.mainImageLocked;
    }
    if (isBoolean(parsed.closeSheetsOnGenerate)) {
      next.closeSheetsOnGenerate = parsed.closeSheetsOnGenerate;
    }
    if (isBoolean(parsed.predictiveBackPreview)) {
      next.predictiveBackPreview = parsed.predictiveBackPreview;
    }
    if (isBoolean(parsed.sliderHandleOnly)) {
      next.sliderHandleOnly = parsed.sliderHandleOnly;
    }
    if (
      isNumber(parsed.historyGridColumns) &&
      HISTORY_GRID_COLUMN_OPTIONS.includes(parsed.historyGridColumns)
    ) {
      next.historyGridColumns = parsed.historyGridColumns;
    }
    const historyListEngine = HISTORY_LIST_ENGINES.find(
      (engine) => engine === parsed.historyListEngine,
    );
    if (historyListEngine) next.historyListEngine = historyListEngine;
    return next;
  } catch {
    return {};
  }
}
