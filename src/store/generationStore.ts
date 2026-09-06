import { useEffect } from "react";
import { AppState } from "react-native";
import { File } from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import { create } from "zustand";

import {
  deleteGenerations as deleteStoredGenerations,
  type GenerationRecord,
  listGenerationIds,
  listGenerationPage,
  saveGenerationImageBase64,
} from "../lib/generationHistory";
import {
  mergeGenerationHistoryRecords,
  type GenerationHistoryCursor,
} from "../lib/generationHistoryPage";
import notifee, { EventType } from "react-native-notify-kit";

import {
  CANCEL_ACTION_ID,
  startGenerationService,
  stopGenerationService,
  updateGenerationProgress,
} from "../lib/foregroundService";
import {
  acquireGenerationWakeLock,
  releaseGenerationWakeLock,
  waitForGenerationInterval,
} from "../../modules/generation-wake-lock";
import {
  type GenerateNovelAiCharacterPrompt,
  type NovelAiAnlasBalance,
  encodeNovelAiVibe,
  generateNovelAiImageStream,
  getNovelAiAnlasBalance,
} from "../lib/novelai";
import { resolveActiveCharacterPrompts } from "../lib/imagePromptCaptions";
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
  beginGenerationPerformanceImage,
  countGenerationPerformance,
  endGenerationPerformanceImage,
  measureGenerationAsync,
  measureGenerationSync,
} from "../lib/generationPerformance";
import {
  buildMetadataImportPatch,
  type MetadataImportSelection,
} from "../lib/metadataImport";
import type { ParsedNaiMetadata } from "../lib/naiMetadata";
import {
  isUcPresetIndex,
  type UcPresetIndex,
} from "../lib/naiPresets";
import { createMutationVersionTracker } from "../lib/referenceMutation";
import {
  createGenerationOptionsPersistence,
  type PersistedGenerationOptions,
} from "./generationOptionsPersistence";
import {
  MAX_VIBE_REFERENCES,
  addVibeReferenceFromImage,
  canUseCachedVibeEncoding,
  deleteVibeReference as deleteStoredVibeReference,
  listVibeReferences,
  readEncodedVibeReferenceBase64,
  readVibeReferenceImageBase64,
  replaceVibeReferenceImage,
  saveEncodedVibeReference,
  updateVibeReferenceSettings,
  updateVibeReferencesEnabled,
  type VibeReference,
  type VibeReferenceImageInput,
} from "../lib/vibeReferences";
import {
  MAX_PRECISE_REFERENCES,
  addPreciseReferenceFromImage,
  deletePreciseReference as deleteStoredPreciseReference,
  listPreciseReferences,
  readPreciseReferenceProcessedBase64,
  replacePreciseReferenceImage,
  updatePreciseReferenceSettings,
  updatePreciseReferencesEnabled,
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
const BATCH_REQUEST_INTERVAL_MS = 500;
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

export type GenerationStartRejectionReason =
  | "busy"
  | "validation"
  | "preparation"
  | "cancelled";

// started는 전처리 완료와 큐 handoff를 뜻하며 이미지 생성 완료를 뜻하지 않는다.
export type GenerationStartResult =
  | { status: "started" }
  | {
      status: "rejected";
      reason: GenerationStartRejectionReason;
    };

export type AnlasRefreshResult =
  | { status: "success"; balance: NovelAiAnlasBalance }
  | { status: "invalid-token" }
  | { status: "unavailable" }
  | { status: "skipped"; reason: "missing-token" | "stale-request" };

const GENERATION_STARTED: GenerationStartResult = { status: "started" };

function rejectGenerationStart(
  reason: GenerationStartRejectionReason,
): GenerationStartResult {
  return { status: "rejected", reason };
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
  applyMetadataImport: (
    parsed: ParsedNaiMetadata,
    selection: MetadataImportSelection,
  ) => void;
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
  setVibeReferencesEnabled: (enabled: boolean) => void;
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
  setPreciseReferencesEnabled: (enabled: boolean) => void;
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
  mainImageBlurred: boolean;
  setMainImageBlurred: (v: boolean) => void;
  // 토큰
  storedToken: string | null;
  saveToken: (token: string) => Promise<void>;

  // Anlas 잔액
  anlasBalance: NovelAiAnlasBalance | null;
  refreshAnlas: () => Promise<AnlasRefreshResult>;

  // 생성 결과
  currentGeneration: GenerationRecord | null;
  generationHistory: GenerationRecord[];
  generationHistoryIds: string[] | null;
  generationHistoryRevision: number;
  loadGenerationHistoryIds: () => Promise<string[]>;
  generationHistoryCursor: GenerationHistoryCursor | null;
  generationHistoryHasMore: boolean;
  generationHistoryInitialized: boolean;
  generationHistoryLoadingMore: boolean;
  loadMoreGenerationHistory: () => Promise<void>;
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
  ) => Promise<GenerationStartResult>;
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
// 전처리부터 runQueueTask가 소유권을 얻기 전까지 새 요청을 차단한다.
let queueStarting = false;
let queueRunning = false;
let activeQueuePreparationAbortController: AbortController | null = null;
let activeQueueAbortController: AbortController | null = null;
const vibeSettingsVersions = createMutationVersionTracker();
const preciseSettingsVersions = createMutationVersionTracker();

async function waitForNextBatchRequest(signal: AbortSignal): Promise<boolean> {
  if (signal.aborted) return Promise.resolve(false);

  let onAbort: (() => void) | undefined;
  const abortPromise = new Promise<boolean>((resolve) => {
    onAbort = () => resolve(false);
    signal.addEventListener("abort", onAbort, { once: true });
  });

  try {
    return await Promise.race([
      waitForGenerationInterval(BATCH_REQUEST_INTERVAL_MS).then(
        () => !signal.aborted,
      ),
      abortPromise,
    ]);
  } finally {
    if (onAbort) {
      signal.removeEventListener("abort", onAbort);
    }
  }
}

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
    if (isBoolean(parsed.mainImageBlurred)) {
      next.mainImageBlurred = parsed.mainImageBlurred;
    }
    return next;
  } catch {
    return {};
  }
}

export const useGenerationStore = create<GenerationState>((set, get) => ({
  prompt:
    "silver-haired mage, under moonlight, arcane magic circle, purple runes, starry night",
  setPrompt: (v) =>
    set((state) => (state.prompt === v ? state : { prompt: v })),
  negativePrompt: "low quality, blurry, watermark, text",
  setNegativePrompt: (v) =>
    set((state) =>
      state.negativePrompt === v ? state : { negativePrompt: v },
    ),
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
  applyMetadataImport: (parsed, selection) =>
    set((state) => buildMetadataImportPatch(state, parsed, selection)),
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
      vibeSettingsVersions.clear(id);
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

    const version = vibeSettingsVersions.start(id);
    set((state) => ({
      vibeReferences: state.vibeReferences.map((item) =>
        item.id === id ? { ...item, enabled } : item,
      ),
    }));
    updateVibeReferenceSettings(id, { enabled })
      .then((reference) => {
        if (!reference || !vibeSettingsVersions.isLatest(id, version)) return;
        set((state) => ({
          vibeReferences: replaceVibeInList(state.vibeReferences, reference),
        }));
      })
      .catch((error: unknown) => {
        if (!vibeSettingsVersions.isLatest(id, version)) return;
        set({
          message: error instanceof Error ? error.message : String(error),
        });
      });
  },
  setVibeReferencesEnabled: (enabled) => {
    const state = get();
    if (enabled && state.preciseReferences.some((item) => item.enabled)) {
      set({
        message: "Precise Reference와 Vibe Transfer는 함께 사용할 수 없습니다.",
      });
      return;
    }

    const ids = state.vibeReferences
      .filter((item) => item.enabled !== enabled)
      .map((item) => item.id);
    if (ids.length === 0) return;

    const idSet = new Set(ids);
    ids.forEach((id) => vibeSettingsVersions.start(id));
    set({
      vibeReferences: state.vibeReferences.map((item) =>
        idSet.has(item.id) ? { ...item, enabled } : item,
      ),
    });
    updateVibeReferencesEnabled(ids, enabled).catch((error: unknown) => {
      set({
        message: error instanceof Error ? error.message : String(error),
      });
    });
  },
  setVibeReferenceStrength: (id, strength) => {
    const version = vibeSettingsVersions.start(id);
    set((state) => ({
      vibeReferences: state.vibeReferences.map((item) =>
        item.id === id ? { ...item, strength } : item,
      ),
    }));
    updateVibeReferenceSettings(id, { strength })
      .then((reference) => {
        if (!reference || !vibeSettingsVersions.isLatest(id, version)) return;
        set((state) => ({
          vibeReferences: replaceVibeInList(state.vibeReferences, reference),
        }));
      })
      .catch((error: unknown) => {
        if (!vibeSettingsVersions.isLatest(id, version)) return;
        set({
          message: error instanceof Error ? error.message : String(error),
        });
      });
  },
  setVibeReferenceInformationExtracted: (id, value) => {
    const version = vibeSettingsVersions.start(id);
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
        if (!reference || !vibeSettingsVersions.isLatest(id, version)) return;
        set((state) => ({
          vibeReferences: replaceVibeInList(state.vibeReferences, reference),
        }));
      })
      .catch((error: unknown) => {
        if (!vibeSettingsVersions.isLatest(id, version)) return;
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
      preciseSettingsVersions.clear(id);
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

    const version = preciseSettingsVersions.start(id);
    set((state) => ({
      preciseReferences: state.preciseReferences.map((item) =>
        item.id === id ? { ...item, enabled } : item,
      ),
    }));
    updatePreciseReferenceSettings(id, { enabled })
      .then((reference) => {
        if (!reference || !preciseSettingsVersions.isLatest(id, version)) {
          return;
        }
        set((state) => ({
          preciseReferences: replacePreciseInList(
            state.preciseReferences,
            reference,
          ),
        }));
      })
      .catch((error: unknown) => {
        if (!preciseSettingsVersions.isLatest(id, version)) return;
        set({
          message: error instanceof Error ? error.message : String(error),
        });
      });
  },
  setPreciseReferencesEnabled: (enabled) => {
    const state = get();
    if (enabled && state.vibeReferences.some((item) => item.enabled)) {
      set({
        message: "Precise Reference와 Vibe Transfer는 함께 사용할 수 없습니다.",
      });
      return;
    }
    if (enabled && !isPreciseReferenceSupportedModel(state.model)) {
      set({
        message: "Precise Reference는 V4.5 모델에서 사용할 수 있습니다.",
      });
      return;
    }

    const ids = state.preciseReferences
      .filter((item) => item.enabled !== enabled)
      .map((item) => item.id);
    if (ids.length === 0) return;

    const idSet = new Set(ids);
    ids.forEach((id) => preciseSettingsVersions.start(id));
    set({
      preciseReferences: state.preciseReferences.map((item) =>
        idSet.has(item.id) ? { ...item, enabled } : item,
      ),
    });
    updatePreciseReferencesEnabled(ids, enabled).catch((error: unknown) => {
      set({
        message: error instanceof Error ? error.message : String(error),
      });
    });
  },
  setPreciseReferenceStrength: (id, strength) => {
    const version = preciseSettingsVersions.start(id);
    set((state) => ({
      preciseReferences: state.preciseReferences.map((item) =>
        item.id === id ? { ...item, strength } : item,
      ),
    }));
    updatePreciseReferenceSettings(id, { strength })
      .then((reference) => {
        if (!reference || !preciseSettingsVersions.isLatest(id, version)) {
          return;
        }
        set((state) => ({
          preciseReferences: replacePreciseInList(
            state.preciseReferences,
            reference,
          ),
        }));
      })
      .catch((error: unknown) => {
        if (!preciseSettingsVersions.isLatest(id, version)) return;
        set({
          message: error instanceof Error ? error.message : String(error),
        });
      });
  },
  setPreciseReferenceFidelity: (id, fidelity) => {
    const version = preciseSettingsVersions.start(id);
    set((state) => ({
      preciseReferences: state.preciseReferences.map((item) =>
        item.id === id ? { ...item, fidelity } : item,
      ),
    }));
    updatePreciseReferenceSettings(id, { fidelity })
      .then((reference) => {
        if (!reference || !preciseSettingsVersions.isLatest(id, version)) {
          return;
        }
        set((state) => ({
          preciseReferences: replacePreciseInList(
            state.preciseReferences,
            reference,
          ),
        }));
      })
      .catch((error: unknown) => {
        if (!preciseSettingsVersions.isLatest(id, version)) return;
        set({
          message: error instanceof Error ? error.message : String(error),
        });
      });
  },
  setPreciseReferenceType: (id, referenceType) => {
    const version = preciseSettingsVersions.start(id);
    set((state) => ({
      preciseReferences: state.preciseReferences.map((item) =>
        item.id === id ? { ...item, referenceType } : item,
      ),
    }));
    updatePreciseReferenceSettings(id, { referenceType })
      .then((reference) => {
        if (!reference || !preciseSettingsVersions.isLatest(id, version)) {
          return;
        }
        set((state) => ({
          preciseReferences: replacePreciseInList(
            state.preciseReferences,
            reference,
          ),
        }));
      })
      .catch((error: unknown) => {
        if (!preciseSettingsVersions.isLatest(id, version)) return;
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
  mainImageBlurred: false,
  setMainImageBlurred: (v) => set({ mainImageBlurred: v }),
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
    set({ storedToken: token, anlasBalance: null });
  },

  anlasBalance: null,
  refreshAnlas: async () => {
    const token = get().storedToken;
    if (!token) {
      set({ anlasBalance: null });
      return { status: "skipped", reason: "missing-token" };
    }

    try {
      const balance = await getNovelAiAnlasBalance(token);

      if (get().storedToken !== token) {
        return { status: "skipped", reason: "stale-request" };
      }

      set({ anlasBalance: balance });
      return { status: "success", balance };
    } catch (error: unknown) {
      if (get().storedToken !== token) {
        return { status: "skipped", reason: "stale-request" };
      }

      if (
        error instanceof Error &&
        "status" in error &&
        (error.status === 401 || error.status === 403)
      ) {
        set({ anlasBalance: null });
        return { status: "invalid-token" };
      }

      return { status: "unavailable" };
    }
  },

  currentGeneration: null,
  generationHistory: [],
  generationHistoryIds: null,
  generationHistoryRevision: 0,
  loadGenerationHistoryIds: async () => {
    // Keep the first query's selection snapshot, even if validation needs a retry.
    let snapshot: string[] | null = null;
    let revision: number;
    let ids: string[];
    do {
      revision = get().generationHistoryRevision;
      ids = await listGenerationIds();
      snapshot ??= ids;
    } while (revision !== get().generationHistoryRevision);
    set({ generationHistoryIds: ids });
    const existingIds = new Set(ids);
    return snapshot.filter((id) => existingIds.has(id));
  },
  generationHistoryCursor: null,
  generationHistoryHasMore: false,
  generationHistoryInitialized: false,
  generationHistoryLoadingMore: false,
  loadMoreGenerationHistory: async () => {
    const state = get();
    if (
      !state.generationHistoryInitialized ||
      state.generationHistoryLoadingMore ||
      !state.generationHistoryHasMore ||
      !state.generationHistoryCursor
    ) {
      return;
    }

    set({ generationHistoryLoadingMore: true });
    try {
      const page = await listGenerationPage(state.generationHistoryCursor);
      if (state.generationHistoryRevision !== get().generationHistoryRevision) {
        set({ generationHistoryLoadingMore: false });
        await get().loadMoreGenerationHistory();
        return;
      }
      set((current) => {
        const generationHistory = mergeGenerationHistoryRecords(
          current.generationHistory,
          page.records,
        );
        return {
          generationHistory,
          generationHistoryCursor: page.nextCursor,
          generationHistoryHasMore: page.hasMore,
          generationHistoryLoadingMore: false,
          currentGeneration:
            current.currentGeneration ?? generationHistory[0] ?? null,
        };
      });
    } catch (error: unknown) {
      set({
        generationHistoryLoadingMore: false,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  },
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

      return {
        generationHistory,
        currentGeneration,
        generationHistoryIds: state.generationHistoryIds?.filter(
          (id) => !deletedIds.has(id),
        ) ?? null,
        generationHistoryRevision: state.generationHistoryRevision + 1,
      };
    });

    const state = get();
    if (
      state.generationHistory.length === 0 &&
      state.generationHistoryHasMore
    ) {
      await state.loadMoreGenerationHistory();
    }
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
  requestQueueCancel: () => {
    set({ queueCancelRequested: true });
    activeQueuePreparationAbortController?.abort();
    activeQueueAbortController?.abort();
  },

  generateImage: async (onSuccess, overrides) => {
    const s = get();
    if (s.isLoading || queueStarting || queueRunning) {
      return rejectGenerationStart("busy");
    }
    if (!s.storedToken) {
      set({ message: "저장된 NovelAI 토큰이 없습니다." });
      return rejectGenerationStart("validation");
    }

    // 디바운스 동기화 전에 전송될 수 있으므로, 호출 측이 최신 텍스트를 직접 넘길 수 있게 함.
    const effPrompt = (overrides?.prompt ?? s.prompt).trim();
    const effNegativePrompt = (
      overrides?.negativePrompt ?? s.negativePrompt
    ).trim();

    if (!effPrompt) {
      set({ message: "프롬프트를 입력해주세요." });
      return rejectGenerationStart("validation");
    }

    // 첫 await 전에 준비 상태를 획득해 I2I/Reference 전처리도 단일 요청으로 보장한다.
    queueStarting = true;
    const preparationAbortController = new AbortController();
    activeQueuePreparationAbortController = preparationAbortController;
    const preparationCancelled = () =>
      preparationAbortController.signal.aborted ||
      activeQueuePreparationAbortController !== preparationAbortController ||
      get().queueCancelRequested;
    const finishPreparation = () => {
      if (
        activeQueuePreparationAbortController !== preparationAbortController
      ) {
        return;
      }
      activeQueuePreparationAbortController = null;
      queueStarting = false;
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
    };
    const stopIfPreparationCancelled = () => {
      if (!preparationCancelled()) return false;
      finishPreparation();
      return true;
    };
    const handoffPreparation = () => {
      if (
        activeQueuePreparationAbortController !== preparationAbortController
      ) {
        return;
      }
      activeQueuePreparationAbortController = null;
      // foreground service handoff 중에도 잠금을 유지하고 runQueueTask에서 해제한다.
    };

    set({
      isLoading: true,
      message: null,
      queueTotal: 0,
      queueIndex: 0,
      queueSteps: 0,
      queueCancelRequested: false,
      streamingPreviewUri: null,
      streamingStep: null,
      streamingGenerationId: null,
    });

    // 큐 시작 시 옵션 1회 캡처 (중간 옵션 변경이 큐에 안 섞이도록). 시드만 매 장 advance.
    const total = Math.min(100, Math.max(1, s.batchCount));
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
        if (stopIfPreparationCancelled()) {
          return rejectGenerationStart("cancelled");
        }
        i2iImageBase64 = await new File(resized.uri).base64();
        if (stopIfPreparationCancelled()) {
          return rejectGenerationStart("cancelled");
        }
      } catch {
        const wasCancelled = preparationCancelled();
        if (!wasCancelled) {
          set({ message: "I2I 이미지를 읽지 못했습니다." });
        }
        finishPreparation();
        return rejectGenerationStart(
          wasCancelled ? "cancelled" : "preparation",
        );
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
      finishPreparation();
      return rejectGenerationStart("validation");
    }

    if (activeVibes.length > 0) {
      if (!isVibeSupportedModel(s.model)) {
        set({
          message: "Vibe Transfer는 V4 이상 모델에서 사용할 수 있습니다.",
        });
        finishPreparation();
        return rejectGenerationStart("validation");
      }

      set({
        isLoading: true,
        message: null,
        streamingPreviewUri: null,
        streamingStep: null,
        streamingGenerationId: null,
      });

      try {
        const encodedImages: string[] = [];
        const updatedReferences: VibeReference[] = [];

        for (const vibe of activeVibes) {
          if (stopIfPreparationCancelled()) {
            return rejectGenerationStart("cancelled");
          }
          const canUseCachedEncoding = canUseCachedVibeEncoding(vibe);

          if (canUseCachedEncoding) {
            encodedImages.push(await readEncodedVibeReferenceBase64(vibe));
            if (stopIfPreparationCancelled()) {
              return rejectGenerationStart("cancelled");
            }
            continue;
          }

          const imageBase64 = await readVibeReferenceImageBase64(vibe);
          if (stopIfPreparationCancelled()) {
            return rejectGenerationStart("cancelled");
          }
          const encodedBase64 = await encodeNovelAiVibe(
            s.storedToken,
            imageBase64,
            vibe.informationExtracted,
          );
          if (stopIfPreparationCancelled()) {
            return rejectGenerationStart("cancelled");
          }
          encodedImages.push(encodedBase64);

          const updatedReference = await saveEncodedVibeReference(
            vibe.id,
            encodedBase64,
            vibe.informationExtracted,
          );
          if (stopIfPreparationCancelled()) {
            return rejectGenerationStart("cancelled");
          }
          if (updatedReference) {
            updatedReferences.push(updatedReference);
          }
        }

        if (updatedReferences.length > 0) {
          const updatedById = new Map(
            updatedReferences.map((item) => [item.id, item]),
          );
          set((state) => ({
            vibeReferences: state.vibeReferences.map((item) => {
              const updated = updatedById.get(item.id);
              if (
                !updated ||
                updated.informationExtracted !== item.informationExtracted
              ) {
                return item;
              }
              return {
                ...item,
                encodedPath: updated.encodedPath,
                encodedInformationExtracted:
                  updated.encodedInformationExtracted,
                updatedAt: Math.max(item.updatedAt, updated.updatedAt),
              };
            }),
          }));
        }

        vibeEncodedImages = encodedImages;
        vibeInformationExtracted = activeVibes.map(
          (item) => item.informationExtracted,
        );
        vibeStrengths = activeVibes.map((item) => item.strength);
      } catch (error: unknown) {
        const wasCancelled = preparationCancelled();
        if (!wasCancelled) {
          set({
            message:
              error instanceof Error
                ? error.message
                : "Vibe 이미지를 인코딩하지 못했습니다.",
          });
        }
        finishPreparation();
        return rejectGenerationStart(
          wasCancelled ? "cancelled" : "preparation",
        );
      }
    }

    if (activePreciseReferences.length > 0) {
      if (!isPreciseReferenceSupportedModel(s.model)) {
        set({
          message: "Precise Reference는 V4.5 모델에서 사용할 수 있습니다.",
        });
        finishPreparation();
        return rejectGenerationStart("validation");
      }

      try {
        preciseReferenceImages = await Promise.all(
          activePreciseReferences.map(readPreciseReferenceProcessedBase64),
        );
        if (stopIfPreparationCancelled()) {
          return rejectGenerationStart("cancelled");
        }
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
        const wasCancelled = preparationCancelled();
        if (!wasCancelled) {
          set({
            message:
              error instanceof Error
                ? error.message
                : "Precise Reference 이미지를 읽지 못했습니다.",
          });
        }
        finishPreparation();
        return rejectGenerationStart(
          wasCancelled ? "cancelled" : "preparation",
        );
      }
    }

    if (stopIfPreparationCancelled()) {
      return rejectGenerationStart("cancelled");
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
      streamingPreviewUri: null,
      streamingStep: null,
      streamingGenerationId: null,
    });
    handoffPreparation();

    // Android: foreground service 시작 → 등록 태스크가 runQueueTask 구동
    // (등록 태스크 안에서 돌아야 백그라운드 실행 보장). 서비스 시작 실패(권한 거부 등)
    // 또는 비-Android면 직접 구동(포그라운드 한정).
    const serviceStarted = await startGenerationService(total, s.steps);
    if (!serviceStarted) {
      void get().runQueueTask();
    }
    return GENERATION_STARTED;
  },

  runQueueTask: async () => {
    if (queueRunning) return;
    const params = pendingQueue;
    if (!params) return;
    queueStarting = false;
    queueRunning = true;
    const abortController = new AbortController();
    activeQueueAbortController = abortController;

    const { token, prompt, negativePrompt, characterPrompts, opts, total } =
      params;
    const steps = opts.steps;
    const totalSteps = total * steps;
    // 큐 전체에 걸친 알림 throttle 타임스탬프 (이미지 경계에서도 유지).
    let lastNotifAt = 0;

    try {
      await acquireGenerationWakeLock();

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
        beginGenerationPerformanceImage({
          index: i,
          total,
          width: opts.width,
          height: opts.height,
          steps,
          model: opts.model,
          blurred: get().mainImageBlurred,
          i2i: Boolean(opts.i2iImageBase64),
          vibeCount: opts.vibeEncodedImages?.length ?? 0,
          preciseCount: opts.preciseReferenceImages?.length ?? 0,
        });
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
              countGenerationPerformance("preview.intermediate_updates");
              measureGenerationSync("preview.store_update", () => set({
                streamingPreviewUri: `data:image/jpeg;base64,${event.imageBase64}`,
                streamingStep: event.step,
                streamingGenerationId: event.generationId,
              }));
              return;
            }

            if (event.type === "final") {
              countGenerationPerformance("preview.final_updates");
              measureGenerationSync("preview.final_store_update", () => set({
                streamingPreviewUri: `data:image/png;base64,${event.imageBase64}`,
                streamingGenerationId: event.generationId,
              }));
              return;
            }

            return;
          },
          abortController.signal,
        );

        const generation = await measureGenerationAsync("save.elapsed", () => saveGenerationImageBase64({
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
        }));

        set((state) => ({
          currentGeneration: generation,
          generationHistory: [generation, ...state.generationHistory],
          generationHistoryIds: state.generationHistoryIds
            ? [
                generation.id,
                ...state.generationHistoryIds.filter((id) => id !== generation.id),
              ]
            : null,
          generationHistoryRevision: state.generationHistoryRevision + 1,
          streamingPreviewUri: null,
          streamingStep: null,
          streamingGenerationId: null,
        }));
        endGenerationPerformanceImage("success");
        get().refreshAnlas();

        if (
          i < total &&
          !(await waitForNextBatchRequest(abortController.signal))
        ) {
          break;
        }
      }
      if (!get().queueCancelRequested) {
        params.onSuccess?.();
      }
    } catch (error: unknown) {
      // 한 장 실패 시 큐 중단. 부분 완료분은 history 유지.
      const wasCancelled =
        get().queueCancelRequested || abortController.signal.aborted;
      endGenerationPerformanceImage(wasCancelled ? "cancelled" : "error");
      if (!wasCancelled) {
        set({
          message: error instanceof Error ? error.message : String(error),
        });
      }
    } finally {
      pendingQueue = null;
      queueStarting = false;
      queueRunning = false;
      if (activeQueueAbortController === abortController) {
        activeQueueAbortController = null;
      }
      await releaseGenerationWakeLock();
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
    if (!queueStarting && !queueRunning) {
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

    listGenerationPage()
      .then((page) => {
        setState((state) => {
          const generationHistory = mergeGenerationHistoryRecords(
            state.generationHistory,
            page.records,
          );
          return {
            generationHistory,
            generationHistoryCursor: page.nextCursor,
            generationHistoryHasMore: page.hasMore,
            generationHistoryInitialized: true,
            currentGeneration:
              state.currentGeneration ?? generationHistory[0] ?? null,
          };
        });
      })
      .catch((error: unknown) => {
        setState({
          generationHistoryInitialized: true,
          message: error instanceof Error ? error.message : String(error),
        });
      });

    listVibeReferences()
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

    listPreciseReferences()
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

  // persist: 저장 대상 옵션 변경을 합쳐 마지막 상태만 write
  useEffect(() => {
    const persistence = createGenerationOptionsPersistence({
      initialJson:
        storage.getString(GENERATION_OPTIONS_STORAGE_KEY) ?? null,
      write: (json) => {
        storage.set(GENERATION_OPTIONS_STORAGE_KEY, json);
      },
    });
    const unsubscribe = useGenerationStore.subscribe(
      persistence.handleStateChange,
    );
    const appStateSubscription = AppState.addEventListener(
      "change",
      (nextState) => {
        if (nextState !== "active") persistence.flush();
      },
    );

    return () => {
      unsubscribe();
      appStateSubscription.remove();
      persistence.flush();
    };
  }, []);
}
