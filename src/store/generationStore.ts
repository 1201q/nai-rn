import { useEffect } from "react";
import { AppState } from "react-native";
import { File } from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import { create } from "zustand";

import {
  deleteGenerations as deleteStoredGenerations,
  type GenerationRecord,
  initGenerationHistoryStorage,
  listGenerations,
  saveGenerationImageBase64,
} from "../lib/generationHistory";
import notifee, { EventType } from "react-native-notify-kit";

import {
  CANCEL_ACTION_ID,
  startGenerationService,
  stopGenerationService,
  updateGenerationProgress,
} from "../lib/foregroundService";
import {
  type GenerateNovelAiCharacterPrompt,
  type NovelAiAnlasBalance,
  encodeNovelAiVibe,
  generateNovelAiImageStream,
  getNovelAiAnlasBalance,
} from "../lib/novelai";
import { getNovelAiToken, saveNovelAiToken } from "../lib/secureToken";
import { isBoolean, isNumber, isString } from "../lib/guards";
import {
  deleteStoredI2IReference,
  resolveStoredI2IReference,
  saveI2IReferenceImage,
  type I2IReferenceImageInput,
} from "../lib/i2iReference";
import { storage } from "../lib/storage";
import {
  isUcPresetIndex,
  type UcPresetIndex,
} from "../lib/naiPresets";
import {
  MAX_VIBE_REFERENCES,
  addVibeReferenceFromImage,
  canUseCachedVibeEncoding,
  deleteVibeReference as deleteStoredVibeReference,
  initVibeReferenceStorage,
  listVibeReferences,
  readEncodedVibeReferenceBase64,
  readVibeReferenceImageBase64,
  replaceVibeReferenceImage,
  saveEncodedVibeReference,
  updateVibeReferenceSettings,
  type VibeReference,
  type VibeReferenceImageInput,
} from "../lib/vibeReferences";
import {
  MAX_PRECISE_REFERENCES,
  addPreciseReferenceFromImage,
  deletePreciseReference as deleteStoredPreciseReference,
  initPreciseReferenceStorage,
  listPreciseReferences,
  readPreciseReferenceProcessedBase64,
  replacePreciseReferenceImage,
  updatePreciseReferenceSettings,
  type PreciseReference,
  type PreciseReferenceImageInput,
  type PreciseReferenceType,
} from "../lib/preciseReferences";
import {
  DEFAULT_NAI_RESOLUTION,
  MAX_CHARACTER_PROMPTS,
  NAI_RESOLUTIONS,
  type NaiResolution,
  type NoiseSchedule,
} from "../constants/generation";

const GENERATION_OPTIONS_STORAGE_KEY = "nai_generation_options_v1";
const STREAMING_PREVIEW_THROTTLE_MS = 350;
// 알림 step 갱신 throttle (네이티브 displayNotification 호출 상한)
const NOTIF_PROGRESS_THROTTLE_MS = 800;
const DEFAULT_I2I_STRENGTH = 0.7;
const DEFAULT_I2I_NOISE = 0;

export type CharacterPrompt = {
  id: string;
  name?: string;
  prompt: string;
  negativePrompt: string;
  enabled: boolean;
  position: { x: number; y: number };
};

type I2ISourceImage = {
  uri: string;
  storagePath: string;
  width: number;
  height: number;
};

type I2ISourceImageInput = Omit<I2ISourceImage, "storagePath"> &
  Pick<I2IReferenceImageInput, "fileName" | "mimeType">;

export type CustomResolution = {
  id: string;
  width: number;
  height: number;
};

type PersistedGenerationOptions = Partial<{
  prompt: string;
  negativePrompt: string;
  qualityToggle: boolean;
  ucPreset: UcPresetIndex;
  characterPrompts: CharacterPrompt[];
  characterPromptExpandedIds: string[];
  characterPositionEnabled: boolean;
  model: string;
  resolution: NaiResolution;
  customResolutions: CustomResolution[];
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
  i2iSourceImage: Pick<
    I2ISourceImage,
    "storagePath" | "width" | "height"
  >;
  i2iEnabled: boolean;
  i2iStrength: number;
  i2iNoise: number;
}>;

function generateRandomSeed(): number {
  return Math.floor(Math.random() * 4_294_967_295);
}

function roundI2IDimensionTo64(value: number): number {
  return Math.max(64, Math.round(value / 64) * 64);
}

// NAI i2i 픽셀 상한. 초과 시 비율 유지 축소 (hard max 1536x2048보다 보수적).
const NAI_I2I_MAX_PIXELS = 1216 * 1216;

export function getI2IEffectiveResolution(sourceImage: I2ISourceImage) {
  let width = sourceImage.width;
  let height = sourceImage.height;
  if (width * height > NAI_I2I_MAX_PIXELS) {
    const scale = Math.sqrt(NAI_I2I_MAX_PIXELS / (width * height));
    width *= scale;
    height *= scale;
  }
  return {
    width: roundI2IDimensionTo64(width),
    height: roundI2IDimensionTo64(height),
  };
}

function isNoiseSchedule(value: unknown): value is NoiseSchedule {
  return (
    value === "native" ||
    value === "karras" ||
    value === "exponential" ||
    value === "polyexponential"
  );
}

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

function isVibeSupportedModel(model: string): boolean {
  return model.startsWith("nai-diffusion-4");
}

function isPreciseReferenceSupportedModel(model: string): boolean {
  return (
    model === "nai-diffusion-4-5-full" || model === "nai-diffusion-4-5-curated"
  );
}

function replaceVibeInList(
  references: VibeReference[],
  nextReference: VibeReference,
) {
  return references.map((item) =>
    item.id === nextReference.id ? nextReference : item,
  );
}

function replacePreciseInList(
  references: PreciseReference[],
  nextReference: PreciseReference,
) {
  return references.map((item) =>
    item.id === nextReference.id ? nextReference : item,
  );
}

function resolveStoredResolution(value: unknown): NaiResolution | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<NaiResolution>;
  if (!isNumber(candidate.width) || !isNumber(candidate.height)) {
    return null;
  }

  for (const group of NAI_RESOLUTIONS) {
    const preset = group.options.find(
      (item) =>
        item.width === candidate.width && item.height === candidate.height,
    );
    if (preset) {
      return preset;
    }
  }

  return {
    label: isString(candidate.label) ? candidate.label : "Custom Resolution",
    width: candidate.width,
    height: candidate.height,
  };
}

function isDefaultResolution(width: number, height: number) {
  return (
    NAI_RESOLUTIONS.find((group) => group.group === "Normal")?.options.some(
      (item) => item.width === width && item.height === height,
    ) ?? false
  );
}

function resolveStoredCustomResolutions(value: unknown): CustomResolution[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];

    const candidate = item as Partial<CustomResolution>;
    if (
      !isNumber(candidate.width) ||
      !isNumber(candidate.height) ||
      candidate.width < 64 ||
      candidate.height < 64
    ) {
      return [];
    }

    const width = Math.round(candidate.width / 64) * 64;
    const height = Math.round(candidate.height / 64) * 64;
    const key = `${width}x${height}`;
    if (seen.has(key) || isDefaultResolution(width, height)) return [];
    seen.add(key);

    return [
      {
        id:
          isString(candidate.id) && candidate.id.trim()
            ? candidate.id
            : `custom-resolution-${width}-${height}-${index}`,
        width,
        height,
      },
    ];
  });
}

function resolveStoredCharacterPrompts(value: unknown): CharacterPrompt[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.slice(0, MAX_CHARACTER_PROMPTS).flatMap((item, index) => {
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

function resolveActiveCharacterPrompts(
  characterPrompts: CharacterPrompt[],
): GenerateNovelAiCharacterPrompt[] {
  return characterPrompts.flatMap((item) => {
    if (!item.enabled) {
      return [];
    }

    const prompt = item.prompt.trim();
    const negativePrompt = item.negativePrompt.trim();
    if (!prompt && !negativePrompt) {
      return [];
    }

    return [{ prompt, negativePrompt, position: item.position }];
  });
}

type GenerationState = {
  // 프롬프트
  prompt: string;
  setPrompt: (v: string) => void;
  negativePrompt: string;
  setNegativePrompt: (v: string) => void;
  qualityToggle: boolean;
  setQualityToggle: (v: boolean) => void;
  ucPreset: UcPresetIndex;
  setUcPreset: (v: UcPresetIndex) => void;
  characterPrompts: CharacterPrompt[];
  setCharacterPrompts: (v: CharacterPrompt[]) => void;
  characterPromptExpandedIds: string[];
  setCharacterPromptExpandedIds: (v: string[]) => void;
  characterPositionEnabled: boolean;
  setCharacterPositionEnabled: (v: boolean) => void;
  setCharacterPromptPosition: (id: string, x: number, y: number) => void;

  // 옵션
  model: string;
  setModel: (v: string) => void;
  resolution: NaiResolution;
  setResolution: (v: NaiResolution) => void;
  customResolutions: CustomResolution[];
  setCustomResolutions: (v: CustomResolution[]) => void;
  steps: number;
  setSteps: (v: number) => void;
  promptGuidance: number;
  setPromptGuidance: (v: number) => void;
  promptGuidanceRescale: number;
  setPromptGuidanceRescale: (v: number) => void;
  noiseSchedule: NoiseSchedule;
  setNoiseSchedule: (v: NoiseSchedule) => void;
  sampler: string;
  setSampler: (v: string) => void;
  seed: number;
  setSeed: (v: number) => void;
  seedLocked: boolean;
  setSeedLocked: (v: boolean) => void;
  batchCount: number;
  setBatchCount: (v: number) => void;
  varietyPlus: boolean;
  setVarietyPlus: (v: boolean) => void;
  vibeReferences: VibeReference[];
  normalizeVibeStrengths: boolean;
  setNormalizeVibeStrengths: (v: boolean) => void;
  addVibeReference: (
    input: VibeReferenceImageInput,
  ) => Promise<VibeReference | null>;
  replaceVibeReference: (
    id: string,
    input: VibeReferenceImageInput,
  ) => Promise<VibeReference | null>;
  removeVibeReference: (id: string) => Promise<void>;
  setVibeReferenceEnabled: (id: string, enabled: boolean) => void;
  setVibeReferenceStrength: (id: string, strength: number) => void;
  setVibeReferenceInformationExtracted: (id: string, value: number) => void;
  vibeReferenceExpandedIds: string[];
  setVibeReferenceExpandedIds: (v: string[]) => void;
  preciseReferences: PreciseReference[];
  addPreciseReference: (
    input: PreciseReferenceImageInput,
  ) => Promise<PreciseReference | null>;
  replacePreciseReference: (
    id: string,
    input: PreciseReferenceImageInput,
  ) => Promise<PreciseReference | null>;
  removePreciseReference: (id: string) => Promise<void>;
  setPreciseReferenceEnabled: (id: string, enabled: boolean) => void;
  setPreciseReferenceStrength: (id: string, strength: number) => void;
  setPreciseReferenceFidelity: (id: string, fidelity: number) => void;
  setPreciseReferenceType: (
    id: string,
    referenceType: PreciseReferenceType,
  ) => void;
  preciseReferenceExpandedIds: string[];
  setPreciseReferenceExpandedIds: (v: string[]) => void;
  i2iSourceImage: I2ISourceImage | null;
  setI2ISourceImage: (
    v: I2ISourceImageInput,
  ) => Promise<I2ISourceImage | null>;
  i2iEnabled: boolean;
  setI2IEnabled: (v: boolean) => void;
  i2iStrength: number;
  setI2IStrength: (v: number) => void;
  i2iNoise: number;
  setI2INoise: (v: number) => void;
  clearI2I: () => void;
  // 토큰
  storedToken: string | null;
  saveToken: (token: string) => Promise<void>;

  // Anlas 잔액
  anlasBalance: NovelAiAnlasBalance | null;
  refreshAnlas: () => Promise<void>;

  // 생성 결과
  currentGeneration: GenerationRecord | null;
  generationHistory: GenerationRecord[];
  deleteGenerations: (ids: string[]) => Promise<void>;
  streamingPreviewUri: string | null;
  streamingStep: number | null;
  streamingGenerationId: number | null;

  // 생성 상태
  isLoading: boolean;
  message: string | null;
  setMessage: (v: string | null) => void;
  // 연속 생성 큐
  queueTotal: number;
  queueIndex: number;
  queueSteps: number;
  queueCancelRequested: boolean;
  requestQueueCancel: () => void;
  generateImage: (
    onSuccess?: () => void,
    overrides?: { prompt?: string; negativePrompt?: string },
  ) => Promise<void>;
  // foreground service 태스크에서 호출하는 실제 큐 루프 (백그라운드 실행 보장).
  runQueueTask: () => Promise<void>;
};

type QueueParams = {
  token: string;
  prompt: string;
  negativePrompt: string;
  characterPrompts: GenerateNovelAiCharacterPrompt[];
  opts: {
    model: string;
    width: number;
    height: number;
    steps: number;
    promptGuidance: number;
    promptGuidanceRescale: number;
    noiseSchedule: NoiseSchedule;
    sampler: string;
    varietyPlus: boolean;
    qualityToggle: boolean;
    ucPreset: UcPresetIndex;
    characterPositionEnabled: boolean;
    vibeEncodedImages?: string[];
    vibeInformationExtracted?: number[];
    vibeStrengths?: number[];
    normalizeVibeStrengths?: boolean;
    preciseReferenceImages?: string[];
    preciseReferenceStrengths?: number[];
    preciseReferenceFidelities?: number[];
    preciseReferenceTypes?: PreciseReferenceType[];
    i2iImageBase64?: string;
    i2iStrength?: number;
    i2iNoise?: number;
  };
  total: number;
  onSuccess?: () => void;
};

// 큐 파라미터/실행 플래그는 store state 밖 모듈 스코프에 보관
// (foreground service 태스크가 트리거와 별개로 읽어야 하므로).
let pendingQueue: QueueParams | null = null;
let queueRunning = false;

// 부팅 시 MMKV에서 저장된 옵션을 동기 읽기 → store 초기 state로 즉시 복원.
// 손상/구버전 데이터 방어를 위해 필드별 타입 검증 후 통과한 값만 반환.
function loadPersistedOptions(): Partial<GenerationState> {
  const stored = storage.getString(GENERATION_OPTIONS_STORAGE_KEY);
  if (!stored) return {};

  try {
    const parsed = JSON.parse(stored) as PersistedGenerationOptions;
    const next: Partial<GenerationState> = {};
    if (isString(parsed.prompt)) next.prompt = parsed.prompt;
    if (isString(parsed.negativePrompt)) {
      next.negativePrompt = parsed.negativePrompt;
    }
    if (isBoolean(parsed.qualityToggle)) {
      next.qualityToggle = parsed.qualityToggle;
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

    const customResolutions = resolveStoredCustomResolutions(
      parsed.customResolutions,
    );
    if (
      storedResolution &&
      !isDefaultResolution(storedResolution.width, storedResolution.height) &&
      !customResolutions.some(
        (item) =>
          item.width === storedResolution.width &&
          item.height === storedResolution.height,
      )
    ) {
      customResolutions.unshift({
        id: `custom-resolution-${storedResolution.width}-${storedResolution.height}-legacy`,
        width: storedResolution.width,
        height: storedResolution.height,
      });
    }
    next.customResolutions = customResolutions;

    if (isNumber(parsed.steps)) next.steps = parsed.steps;
    if (isNumber(parsed.promptGuidance)) {
      next.promptGuidance = parsed.promptGuidance;
    }
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
    if (isBoolean(parsed.varietyPlus)) next.varietyPlus = parsed.varietyPlus;
    if (isBoolean(parsed.normalizeVibeStrengths)) {
      next.normalizeVibeStrengths = parsed.normalizeVibeStrengths;
    }
    if (Array.isArray(parsed.vibeReferenceExpandedIds)) {
      next.vibeReferenceExpandedIds =
        parsed.vibeReferenceExpandedIds.filter(isString);
    }
    if (Array.isArray(parsed.preciseReferenceExpandedIds)) {
      next.preciseReferenceExpandedIds =
        parsed.preciseReferenceExpandedIds.filter(isString);
    }
    const storedI2IImage = resolveStoredI2ISourceImage(parsed.i2iSourceImage);
    if (storedI2IImage) {
      next.i2iSourceImage = storedI2IImage;
      next.i2iEnabled = isBoolean(parsed.i2iEnabled)
        ? parsed.i2iEnabled
        : true;
    }
    if (isNumber(parsed.i2iStrength)) {
      next.i2iStrength = parsed.i2iStrength;
    }
    if (isNumber(parsed.i2iNoise)) next.i2iNoise = parsed.i2iNoise;
    return next;
  } catch {
    return {};
  }
}

export const useGenerationStore = create<GenerationState>((set, get) => ({
  prompt:
    "silver-haired mage, under moonlight, arcane magic circle, purple runes, starry night",
  setPrompt: (v) => set({ prompt: v }),
  negativePrompt: "low quality, blurry, watermark, text",
  setNegativePrompt: (v) => set({ negativePrompt: v }),
  qualityToggle: true,
  setQualityToggle: (v) => set({ qualityToggle: v }),
  ucPreset: 0,
  setUcPreset: (v) => set({ ucPreset: v }),
  characterPrompts: [],
  setCharacterPrompts: (v) => set({ characterPrompts: v }),
  characterPromptExpandedIds: [],
  setCharacterPromptExpandedIds: (v) => set({ characterPromptExpandedIds: v }),
  characterPositionEnabled: false,
  setCharacterPositionEnabled: (v) => set({ characterPositionEnabled: v }),
  setCharacterPromptPosition: (id, x, y) => {
    const clampedX = Math.max(0, Math.min(1, x));
    const clampedY = Math.max(0, Math.min(1, y));
    set((state) => ({
      characterPrompts: state.characterPrompts.map((item) =>
        item.id === id
          ? { ...item, position: { x: clampedX, y: clampedY } }
          : item,
      ),
    }));
  },

  model: "nai-diffusion-4-5-full",
  setModel: (v) => set({ model: v }),
  resolution: DEFAULT_NAI_RESOLUTION,
  setResolution: (v) => set({ resolution: v }),
  customResolutions: [],
  setCustomResolutions: (v) => set({ customResolutions: v }),
  steps: 28,
  setSteps: (v) => set({ steps: v }),
  promptGuidance: 5,
  setPromptGuidance: (v) => set({ promptGuidance: v }),
  promptGuidanceRescale: 0,
  setPromptGuidanceRescale: (v) => set({ promptGuidanceRescale: v }),
  noiseSchedule: "karras",
  setNoiseSchedule: (v) => set({ noiseSchedule: v }),
  sampler: "k_euler_ancestral",
  setSampler: (v) => set({ sampler: v }),
  seed: generateRandomSeed(),
  setSeed: (v) => set({ seed: v }),
  seedLocked: false,
  setSeedLocked: (v) => set({ seedLocked: v }),
  batchCount: 1,
  setBatchCount: (v) => set({ batchCount: v }),
  varietyPlus: false,
  setVarietyPlus: (v) => set({ varietyPlus: v }),
  vibeReferences: [],
  vibeReferenceExpandedIds: [],
  setVibeReferenceExpandedIds: (v) => set({ vibeReferenceExpandedIds: v }),
  normalizeVibeStrengths: true,
  setNormalizeVibeStrengths: (v) => set({ normalizeVibeStrengths: v }),
  addVibeReference: async (input) => {
    if (get().preciseReferences.some((item) => item.enabled)) {
      set({
        message: "Precise Reference와 Vibe Transfer는 함께 사용할 수 없습니다.",
      });
      return null;
    }

    try {
      const reference = await addVibeReferenceFromImage(input);
      set((state) => ({
        vibeReferences: [...state.vibeReferences, reference],
      }));
      return reference;
    } catch (error: unknown) {
      set({
        message:
          error instanceof Error
            ? error.message
            : "Vibe 이미지를 추가하지 못했습니다.",
      });
      return null;
    }
  },
  replaceVibeReference: async (id, input) => {
    try {
      const reference = await replaceVibeReferenceImage(id, input);
      if (!reference) return null;
      set((state) => ({
        vibeReferences: replaceVibeInList(state.vibeReferences, reference),
      }));
      return reference;
    } catch (error: unknown) {
      set({
        message:
          error instanceof Error
            ? error.message
            : "Vibe 이미지를 교체하지 못했습니다.",
      });
      return null;
    }
  },
  removeVibeReference: async (id) => {
    try {
      await deleteStoredVibeReference(id);
      set((state) => ({
        vibeReferences: state.vibeReferences.filter((item) => item.id !== id),
        vibeReferenceExpandedIds: state.vibeReferenceExpandedIds.filter(
          (value) => value !== id,
        ),
      }));
    } catch (error: unknown) {
      set({
        message:
          error instanceof Error
            ? error.message
            : "Vibe 이미지를 삭제하지 못했습니다.",
      });
    }
  },
  setVibeReferenceEnabled: (id, enabled) => {
    if (enabled && get().preciseReferences.some((item) => item.enabled)) {
      set({
        message: "Precise Reference와 Vibe Transfer는 함께 사용할 수 없습니다.",
      });
      return;
    }

    set((state) => ({
      vibeReferences: state.vibeReferences.map((item) =>
        item.id === id ? { ...item, enabled } : item,
      ),
    }));
    updateVibeReferenceSettings(id, { enabled })
      .then((reference) => {
        if (!reference) return;
        set((state) => ({
          vibeReferences: replaceVibeInList(state.vibeReferences, reference),
        }));
      })
      .catch((error: unknown) => {
        set({
          message: error instanceof Error ? error.message : String(error),
        });
      });
  },
  setVibeReferenceStrength: (id, strength) => {
    set((state) => ({
      vibeReferences: state.vibeReferences.map((item) =>
        item.id === id ? { ...item, strength } : item,
      ),
    }));
    updateVibeReferenceSettings(id, { strength })
      .then((reference) => {
        if (!reference) return;
        set((state) => ({
          vibeReferences: replaceVibeInList(state.vibeReferences, reference),
        }));
      })
      .catch((error: unknown) => {
        set({
          message: error instanceof Error ? error.message : String(error),
        });
      });
  },
  setVibeReferenceInformationExtracted: (id, value) => {
    set((state) => ({
      vibeReferences: state.vibeReferences.map((item) =>
        item.id === id
          ? {
              ...item,
              informationExtracted: value,
              encodedPath: null,
              encodedInformationExtracted: null,
            }
          : item,
      ),
    }));
    updateVibeReferenceSettings(id, { informationExtracted: value })
      .then((reference) => {
        if (!reference) return;
        set((state) => ({
          vibeReferences: replaceVibeInList(state.vibeReferences, reference),
        }));
      })
      .catch((error: unknown) => {
        set({
          message: error instanceof Error ? error.message : String(error),
        });
      });
  },
  preciseReferences: [],
  preciseReferenceExpandedIds: [],
  setPreciseReferenceExpandedIds: (v) =>
    set({ preciseReferenceExpandedIds: v }),
  addPreciseReference: async (input) => {
    if (get().vibeReferences.some((item) => item.enabled)) {
      set({
        message: "Precise Reference와 Vibe Transfer는 함께 사용할 수 없습니다.",
      });
      return null;
    }

    try {
      const reference = await addPreciseReferenceFromImage(input);
      set((state) => ({
        preciseReferences: [...state.preciseReferences, reference],
      }));
      return reference;
    } catch (error: unknown) {
      set({
        message:
          error instanceof Error
            ? error.message
            : "Precise Reference 이미지를 추가하지 못했습니다.",
      });
      return null;
    }
  },
  replacePreciseReference: async (id, input) => {
    try {
      const reference = await replacePreciseReferenceImage(id, input);
      if (!reference) return null;
      set((state) => ({
        preciseReferences: replacePreciseInList(
          state.preciseReferences,
          reference,
        ),
      }));
      return reference;
    } catch (error: unknown) {
      set({
        message:
          error instanceof Error
            ? error.message
            : "Precise Reference 이미지를 교체하지 못했습니다.",
      });
      return null;
    }
  },
  removePreciseReference: async (id) => {
    try {
      await deleteStoredPreciseReference(id);
      set((state) => ({
        preciseReferences: state.preciseReferences.filter(
          (item) => item.id !== id,
        ),
        preciseReferenceExpandedIds: state.preciseReferenceExpandedIds.filter(
          (value) => value !== id,
        ),
      }));
    } catch (error: unknown) {
      set({
        message:
          error instanceof Error
            ? error.message
            : "Precise Reference 이미지를 삭제하지 못했습니다.",
      });
    }
  },
  setPreciseReferenceEnabled: (id, enabled) => {
    if (enabled && get().vibeReferences.some((item) => item.enabled)) {
      set({
        message: "Precise Reference와 Vibe Transfer는 함께 사용할 수 없습니다.",
      });
      return;
    }

    if (enabled && !isPreciseReferenceSupportedModel(get().model)) {
      set({
        message: "Precise Reference는 V4.5 모델에서 사용할 수 있습니다.",
      });
      return;
    }

    set((state) => ({
      preciseReferences: state.preciseReferences.map((item) =>
        item.id === id ? { ...item, enabled } : item,
      ),
    }));
    updatePreciseReferenceSettings(id, { enabled })
      .then((reference) => {
        if (!reference) return;
        set((state) => ({
          preciseReferences: replacePreciseInList(
            state.preciseReferences,
            reference,
          ),
        }));
      })
      .catch((error: unknown) => {
        set({
          message: error instanceof Error ? error.message : String(error),
        });
      });
  },
  setPreciseReferenceStrength: (id, strength) => {
    set((state) => ({
      preciseReferences: state.preciseReferences.map((item) =>
        item.id === id ? { ...item, strength } : item,
      ),
    }));
    updatePreciseReferenceSettings(id, { strength })
      .then((reference) => {
        if (!reference) return;
        set((state) => ({
          preciseReferences: replacePreciseInList(
            state.preciseReferences,
            reference,
          ),
        }));
      })
      .catch((error: unknown) => {
        set({
          message: error instanceof Error ? error.message : String(error),
        });
      });
  },
  setPreciseReferenceFidelity: (id, fidelity) => {
    set((state) => ({
      preciseReferences: state.preciseReferences.map((item) =>
        item.id === id ? { ...item, fidelity } : item,
      ),
    }));
    updatePreciseReferenceSettings(id, { fidelity })
      .then((reference) => {
        if (!reference) return;
        set((state) => ({
          preciseReferences: replacePreciseInList(
            state.preciseReferences,
            reference,
          ),
        }));
      })
      .catch((error: unknown) => {
        set({
          message: error instanceof Error ? error.message : String(error),
        });
      });
  },
  setPreciseReferenceType: (id, referenceType) => {
    set((state) => ({
      preciseReferences: state.preciseReferences.map((item) =>
        item.id === id ? { ...item, referenceType } : item,
      ),
    }));
    updatePreciseReferenceSettings(id, { referenceType })
      .then((reference) => {
        if (!reference) return;
        set((state) => ({
          preciseReferences: replacePreciseInList(
            state.preciseReferences,
            reference,
          ),
        }));
      })
      .catch((error: unknown) => {
        set({
          message: error instanceof Error ? error.message : String(error),
        });
      });
  },
  i2iSourceImage: null,
  setI2ISourceImage: async (v) => {
    const previousPath = get().i2iSourceImage?.storagePath;
    try {
      const storedImage = await saveI2IReferenceImage(v);
      set({ i2iSourceImage: storedImage, i2iEnabled: true });
      if (previousPath !== storedImage.storagePath) {
        deleteStoredI2IReference(previousPath);
      }
      return storedImage;
    } catch (error: unknown) {
      set({
        message:
          error instanceof Error
            ? error.message
            : "I2I 이미지를 저장하지 못했습니다.",
      });
      return null;
    }
  },
  i2iEnabled: false,
  setI2IEnabled: (v) =>
    set((state) => ({ i2iEnabled: v && Boolean(state.i2iSourceImage) })),
  i2iStrength: DEFAULT_I2I_STRENGTH,
  setI2IStrength: (v) => set({ i2iStrength: v }),
  i2iNoise: DEFAULT_I2I_NOISE,
  setI2INoise: (v) => set({ i2iNoise: v }),
  clearI2I: () => {
    const storagePath = get().i2iSourceImage?.storagePath;
    set({
      i2iSourceImage: null,
      i2iEnabled: false,
      i2iStrength: DEFAULT_I2I_STRENGTH,
      i2iNoise: DEFAULT_I2I_NOISE,
    });
    deleteStoredI2IReference(storagePath);
  },
  // 저장된 옵션을 기본값 위에 덮어쓰기 (데이터 필드만, 메서드 미영향).
  ...loadPersistedOptions(),

  storedToken: null,
  saveToken: async (token) => {
    await saveNovelAiToken(token);
    set({ storedToken: token });
  },

  anlasBalance: null,
  refreshAnlas: async () => {
    const token = get().storedToken;
    if (!token) return;
    try {
      const balance = await getNovelAiAnlasBalance(token);
      set({ anlasBalance: balance });
    } catch {
      // 칩은 기존 값 유지, 조용히 실패
    }
  },

  currentGeneration: null,
  generationHistory: [],
  deleteGenerations: async (ids) => {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) return;

    await deleteStoredGenerations(uniqueIds);
    const deletedIds = new Set(uniqueIds);
    set((state) => {
      const generationHistory = state.generationHistory.filter(
        (item) => !deletedIds.has(item.id),
      );
      const currentGeneration =
        state.currentGeneration && deletedIds.has(state.currentGeneration.id)
          ? (generationHistory[0] ?? null)
          : state.currentGeneration;

      return { generationHistory, currentGeneration };
    });
  },
  streamingPreviewUri: null,
  streamingStep: null,
  streamingGenerationId: null,

  isLoading: false,
  message: null,
  setMessage: (v) => set({ message: v }),

  queueTotal: 0,
  queueIndex: 0,
  queueSteps: 0,
  queueCancelRequested: false,
  requestQueueCancel: () => set({ queueCancelRequested: true }),

  generateImage: async (onSuccess, overrides) => {
    const s = get();
    if (s.isLoading || queueRunning) return;
    if (!s.storedToken) {
      set({ message: "저장된 NovelAI 토큰이 없습니다." });
      return;
    }

    // 디바운스 동기화 전에 전송될 수 있으므로, 호출 측이 최신 텍스트를 직접 넘길 수 있게 함.
    const effPrompt = (overrides?.prompt ?? s.prompt).trim();
    const effNegativePrompt = (
      overrides?.negativePrompt ?? s.negativePrompt
    ).trim();

    if (!effPrompt) {
      set({ message: "프롬프트를 입력해주세요." });
      return;
    }

    // 큐 시작 시 옵션 1회 캡처 (중간 옵션 변경이 큐에 안 섞이도록). 시드만 매 장 advance.
    const total = Math.min(20, Math.max(1, s.batchCount));
    let width = s.resolution.width;
    let height = s.resolution.height;
    let i2iImageBase64: string | undefined;
    if (s.i2iEnabled && s.i2iSourceImage) {
      try {
        const effectiveResolution = getI2IEffectiveResolution(s.i2iSourceImage);
        width = effectiveResolution.width;
        height = effectiveResolution.height;
        // NAI는 소스 이미지 크기 == width/height를 요구. 원본을 유효 해상도로 리사이즈.
        const resized = await ImageManipulator.manipulateAsync(
          s.i2iSourceImage.uri,
          [{ resize: { width, height } }],
          { format: ImageManipulator.SaveFormat.PNG },
        );
        i2iImageBase64 = await new File(resized.uri).base64();
      } catch {
        set({ message: "I2I 이미지를 읽지 못했습니다." });
        return;
      }
    }

    const activeVibes = s.vibeReferences
      .filter((item) => item.enabled)
      .slice(0, MAX_VIBE_REFERENCES);
    const activePreciseReferences = s.preciseReferences
      .filter((item) => item.enabled)
      .slice(0, MAX_PRECISE_REFERENCES);
    let vibeEncodedImages: string[] | undefined;
    let vibeInformationExtracted: number[] | undefined;
    let vibeStrengths: number[] | undefined;
    let preciseReferenceImages: string[] | undefined;
    let preciseReferenceStrengths: number[] | undefined;
    let preciseReferenceFidelities: number[] | undefined;
    let preciseReferenceTypes: PreciseReferenceType[] | undefined;

    if (activeVibes.length > 0 && activePreciseReferences.length > 0) {
      set({
        message: "Precise Reference와 Vibe Transfer는 함께 사용할 수 없습니다.",
      });
      return;
    }

    if (activeVibes.length > 0) {
      if (!isVibeSupportedModel(s.model)) {
        set({
          message: "Vibe Transfer는 V4 이상 모델에서 사용할 수 있습니다.",
        });
        return;
      }

      set({
        isLoading: true,
        message: "Vibe 이미지를 인코딩하는 중입니다.",
        streamingPreviewUri: null,
        streamingStep: null,
        streamingGenerationId: null,
      });

      try {
        const encodedImages: string[] = [];
        const updatedReferences: VibeReference[] = [];

        for (const vibe of activeVibes) {
          const canUseCachedEncoding = canUseCachedVibeEncoding(vibe);

          if (canUseCachedEncoding) {
            encodedImages.push(await readEncodedVibeReferenceBase64(vibe));
            continue;
          }

          const imageBase64 = await readVibeReferenceImageBase64(vibe);
          const encodedBase64 = await encodeNovelAiVibe(
            s.storedToken,
            imageBase64,
            vibe.informationExtracted,
          );
          encodedImages.push(encodedBase64);

          const updatedReference = await saveEncodedVibeReference(
            vibe.id,
            encodedBase64,
            vibe.informationExtracted,
          );
          if (updatedReference) {
            updatedReferences.push(updatedReference);
          }
        }

        if (updatedReferences.length > 0) {
          const updatedById = new Map(
            updatedReferences.map((item) => [item.id, item]),
          );
          set((state) => ({
            vibeReferences: state.vibeReferences.map(
              (item) => updatedById.get(item.id) ?? item,
            ),
          }));
        }

        vibeEncodedImages = encodedImages;
        vibeInformationExtracted = activeVibes.map(
          (item) => item.informationExtracted,
        );
        vibeStrengths = activeVibes.map((item) => item.strength);
      } catch (error: unknown) {
        set({
          isLoading: false,
          message:
            error instanceof Error
              ? error.message
              : "Vibe 이미지를 인코딩하지 못했습니다.",
        });
        return;
      }
    }

    if (activePreciseReferences.length > 0) {
      if (!isPreciseReferenceSupportedModel(s.model)) {
        set({
          message: "Precise Reference는 V4.5 모델에서 사용할 수 있습니다.",
        });
        return;
      }

      try {
        preciseReferenceImages = await Promise.all(
          activePreciseReferences.map(readPreciseReferenceProcessedBase64),
        );
        preciseReferenceStrengths = activePreciseReferences.map(
          (item) => item.strength,
        );
        preciseReferenceFidelities = activePreciseReferences.map(
          (item) => item.fidelity,
        );
        preciseReferenceTypes = activePreciseReferences.map(
          (item) => item.referenceType,
        );
      } catch (error: unknown) {
        set({
          message:
            error instanceof Error
              ? error.message
              : "Precise Reference 이미지를 읽지 못했습니다.",
        });
        return;
      }
    }

    pendingQueue = {
      token: s.storedToken,
      prompt: effPrompt,
      negativePrompt: effNegativePrompt,
      characterPrompts: resolveActiveCharacterPrompts(s.characterPrompts),
      opts: {
        model: s.model,
        width,
        height,
        steps: s.steps,
        promptGuidance: s.promptGuidance,
        promptGuidanceRescale: s.promptGuidanceRescale,
        noiseSchedule: s.noiseSchedule,
        sampler: s.sampler,
        varietyPlus: s.varietyPlus,
        qualityToggle: s.qualityToggle,
        ucPreset: s.ucPreset,
        characterPositionEnabled: s.characterPositionEnabled,
        ...(vibeEncodedImages
          ? {
              vibeEncodedImages,
              vibeInformationExtracted,
              vibeStrengths,
              normalizeVibeStrengths: s.normalizeVibeStrengths,
            }
          : {}),
        ...(preciseReferenceImages
          ? {
              preciseReferenceImages,
              preciseReferenceStrengths,
              preciseReferenceFidelities,
              preciseReferenceTypes,
            }
          : {}),
        ...(i2iImageBase64
          ? {
              i2iImageBase64,
              i2iStrength: s.i2iStrength,
              i2iNoise: s.i2iNoise,
            }
          : {}),
      },
      total,
      onSuccess,
    };

    set({
      isLoading: true,
      message: null,
      queueTotal: total,
      queueIndex: 0,
      queueSteps: s.steps,
      queueCancelRequested: false,
      streamingPreviewUri: null,
      streamingStep: null,
      streamingGenerationId: null,
    });

    // Android: foreground service 시작 → 등록 태스크가 runQueueTask 구동
    // (등록 태스크 안에서 돌아야 백그라운드 실행 보장). 서비스 시작 실패(권한 거부 등)
    // 또는 비-Android면 직접 구동(포그라운드 한정).
    const started = await startGenerationService(total, s.steps);
    if (started) return;
    await get().runQueueTask();
  },

  runQueueTask: async () => {
    if (queueRunning) return;
    const params = pendingQueue;
    if (!params) return;
    queueRunning = true;

    const { token, prompt, negativePrompt, characterPrompts, opts, total } =
      params;
    const steps = opts.steps;
    const totalSteps = total * steps;
    // 큐 전체에 걸친 알림 throttle 타임스탬프 (이미지 경계에서도 유지).
    let lastNotifAt = 0;

    try {
      for (let i = 1; i <= total; i++) {
        if (get().queueCancelRequested) break;

        set({
          queueIndex: i,
          streamingPreviewUri: null,
          streamingStep: null,
          streamingGenerationId: null,
        });
        // 이미지 경계: 직전 장 완료분까지 bar 강제 갱신.
        lastNotifAt = Date.now();
        updateGenerationProgress(i, total, (i - 1) * steps, totalSteps);

        // 이번 장 시드 확정 후, 잠금이 아니면 즉시 다음 시드로 advance (UI에 다음 시드 표시)
        let currentSeed = get().seed;
        if (currentSeed === 0) {
          currentSeed = generateRandomSeed();
        }
        if (!get().seedLocked) {
          set({ seed: generateRandomSeed() });
        }

        let lastPreviewUpdateAt = 0;
        const result = await generateNovelAiImageStream(
          {
            token,
            prompt,
            negativePrompt,
            characterPrompts,
            seed: currentSeed,
            ...opts,
          },
          (event) => {
            if (event.type === "intermediate") {
              // 알림 step % — 가벼움(정수 산술 + 네이티브 호출), fg/bg 모두, throttle.
              const tNow = Date.now();
              if (tNow - lastNotifAt > NOTIF_PROGRESS_THROTTLE_MS) {
                lastNotifAt = tNow;
                const doneSteps = (i - 1) * steps + (event.step ?? 0);
                updateGenerationProgress(i, total, doneSteps, totalSteps);
              }

              // 백그라운드에선 미리보기 base64 디코딩이 메모리 낭비 — 스킵
              if (AppState.currentState !== "active") {
                return;
              }
              const now = Date.now();
              if (
                now - lastPreviewUpdateAt < STREAMING_PREVIEW_THROTTLE_MS &&
                get().streamingPreviewUri
              ) {
                return;
              }

              lastPreviewUpdateAt = now;
              set({
                streamingPreviewUri: `data:image/jpeg;base64,${event.imageBase64}`,
                streamingStep: event.step,
                streamingGenerationId: event.generationId,
              });
              return;
            }

            if (event.type === "final") {
              set({
                streamingPreviewUri: `data:image/png;base64,${event.imageBase64}`,
                streamingGenerationId: event.generationId,
              });
              return;
            }

            return;
          },
        );

        const generation = await saveGenerationImageBase64({
          imageBase64: result.imageBase64,
          prompt,
          negativePrompt,
          model: opts.model,
          width: opts.width,
          height: opts.height,
          steps: opts.steps,
          scale: opts.promptGuidance,
          cfgRescale: opts.promptGuidanceRescale,
          noiseSchedule: opts.noiseSchedule,
          sampler: opts.sampler,
          seed: result.seed,
        });

        set((state) => ({
          currentGeneration: generation,
          generationHistory: [generation, ...state.generationHistory],
          streamingPreviewUri: null,
          streamingStep: null,
          streamingGenerationId: null,
        }));
        get().refreshAnlas();
      }
      params.onSuccess?.();
    } catch (error: unknown) {
      // 한 장 실패 시 큐 중단. 부분 완료분은 history 유지.
      set({
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      pendingQueue = null;
      queueRunning = false;
      await stopGenerationService();
      set({
        isLoading: false,
        queueTotal: 0,
        queueIndex: 0,
        queueSteps: 0,
        queueCancelRequested: false,
        streamingPreviewUri: null,
        streamingStep: null,
        streamingGenerationId: null,
      });
    }
  },
}));

// 전체 생성 진행률 (0~1). 완료 이미지 step + 현재 이미지 step 합산.
export const selectOverallPercent = (s: GenerationState) => {
  if (s.queueTotal === 0 || s.queueSteps === 0) return 0;
  const done = (s.queueIndex - 1) * s.queueSteps + (s.streamingStep ?? 0);
  return Math.min(1, Math.max(0, done / (s.queueTotal * s.queueSteps)));
};

// 초기 로드(옵션/토큰/히스토리) + persist 구독. Provider에서 1회 호출.
export function useGenerationBootstrap() {
  // 앱 포그라운드일 때 알림 "취소" 액션 → 큐 중단
  useEffect(() => {
    const unsubscribe = notifee.onForegroundEvent(({ type, detail }) => {
      if (
        type === EventType.ACTION_PRESS &&
        detail.pressAction?.id === CANCEL_ACTION_ID
      ) {
        useGenerationStore.getState().requestQueueCancel();
      }
    });
    return unsubscribe;
  }, []);

  // 부팅 시 잔존 foreground service 정리 (reload/크래시로 JS 컨텍스트가
  // 큐 도중 죽으면 네이티브 FS 알림이 고아로 남아 취소도 안 됨).
  useEffect(() => {
    if (!queueRunning) {
      useGenerationStore.setState({
        isLoading: false,
        queueTotal: 0,
        queueIndex: 0,
        queueSteps: 0,
        queueCancelRequested: false,
      });
      void stopGenerationService();
    }
  }, []);

  useEffect(() => {
    const { setState } = useGenerationStore;

    // 옵션은 store 생성 시 MMKV에서 동기 복원됨 (loadPersistedOptions).
    // 여기서는 토큰/히스토리/레퍼런스 비동기 로드만 처리.
    getNovelAiToken()
      .then((token) => {
        setState({ storedToken: token });
        if (token) useGenerationStore.getState().refreshAnlas();
      })
      .catch((error: unknown) => {
        setState({
          message: error instanceof Error ? error.message : String(error),
        });
      });

    initGenerationHistoryStorage()
      .then(listGenerations)
      .then((records) => {
        setState((state) => ({
          generationHistory: records,
          currentGeneration: state.currentGeneration ?? records[0] ?? null,
        }));
      })
      .catch((error: unknown) => {
        setState({
          message: error instanceof Error ? error.message : String(error),
        });
      });

    initVibeReferenceStorage()
      .then(listVibeReferences)
      .then((references) => {
        setState((state) => {
          const referenceIds = new Set(references.map((item) => item.id));
          return {
            vibeReferences: references,
            vibeReferenceExpandedIds: state.vibeReferenceExpandedIds.filter(
              (id) => referenceIds.has(id),
            ),
          };
        });
      })
      .catch((error: unknown) => {
        setState({
          message: error instanceof Error ? error.message : String(error),
        });
      });

    initPreciseReferenceStorage()
      .then(listPreciseReferences)
      .then((references) => {
        setState((state) => {
          const referenceIds = new Set(references.map((item) => item.id));
          return {
            preciseReferences: references,
            preciseReferenceExpandedIds:
              state.preciseReferenceExpandedIds.filter((id) =>
                referenceIds.has(id),
              ),
          };
        });
      })
      .catch((error: unknown) => {
        setState({
          message: error instanceof Error ? error.message : String(error),
        });
      });
  }, []);

  // persist: 옵션 슬라이스 변경 시에만 write (이전 effect deps와 동일 집합)
  useEffect(() => {
    let lastJson: string | null = null;

    const unsubscribe = useGenerationStore.subscribe((state) => {
      const nextOptions: PersistedGenerationOptions = {
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
        // 시드는 잠금일 때만 저장 (NAIS2 동일)
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
      };

      const json = JSON.stringify(nextOptions);
      if (json === lastJson) return;
      lastJson = json;

      storage.set(GENERATION_OPTIONS_STORAGE_KEY, json);
    });

    return unsubscribe;
  }, []);
}
