import type { StoreApi } from "zustand";

import type { NaiResolution, NoiseSchedule } from "../constants/generation";
import type { ModelSettings } from "../constants/models";
import type { GenerationRecord } from "../lib/generationHistory";
import type { GenerationHistoryCursor } from "../lib/generationHistoryPage";
import type { I2IReferenceImageInput } from "../lib/i2iReference";
import type { MetadataImportSelection } from "../lib/metadataImport";
import type { ParsedNaiMetadata } from "../lib/naiMetadata";
import type { QualityPreset, UcPresetIndex } from "../lib/naiPresets";
import type { NovelAiAnlasBalance, NovelAiImageFormat } from "../lib/novelai";
import type {
  PreciseReference,
  PreciseReferenceImageInput,
  PreciseReferenceType,
} from "../lib/preciseReferences";
import type {
  VibeReference,
  VibeReferenceImageInput,
} from "../lib/vibeReferences";
import type { CharacterPrompt, I2ISourceImage } from "../types/generation";
import type { HistoryListEngine } from "./generationOptionsPersistence";

type I2ISourceImageInput = Omit<I2ISourceImage, "storagePath"> &
  Pick<I2IReferenceImageInput, "fileName" | "mimeType">;

export type GenerationStartRejectionReason =
  "busy" | "validation" | "preparation" | "cancelled";

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

export type GenerationState = {
  // 프롬프트
  prompt: string;
  setPrompt: (v: string) => void;
  negativePrompt: string;
  setNegativePrompt: (v: string) => void;
  qualityPreset: QualityPreset;
  setQualityPreset: (v: QualityPreset) => void;
  // V5 투명 배경 옵션 (V5가 아니면 요청에 반영되지 않는다)
  transparentBackground: boolean;
  setTransparentBackground: (v: boolean) => void;
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
  steps: number;
  setSteps: (v: number) => void;
  promptGuidance: number;
  setPromptGuidance: (v: number) => void;
  // 현재 모델이 아닌 모델들의 마지막 생성 설정
  settingsByModel: Record<string, ModelSettings>;
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
  imageFormat: NovelAiImageFormat;
  setImageFormat: (v: NovelAiImageFormat) => void;
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
  setVibeReferenceStrength: (id: string, strength: number) => void;
  setVibeReferenceInformationExtracted: (id: string, value: number) => void;
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
  i2iSourceImage: I2ISourceImage | null;
  setI2ISourceImage: (v: I2ISourceImageInput) => Promise<I2ISourceImage | null>;
  i2iEnabled: boolean;
  setI2IEnabled: (v: boolean) => void;
  i2iStrength: number;
  setI2IStrength: (v: number) => void;
  i2iNoise: number;
  setI2INoise: (v: number) => void;
  clearI2I: () => void;
  mainImageBlurred: boolean;
  setMainImageBlurred: (v: boolean) => void;
  mainImageLocked: boolean;
  setMainImageLocked: (v: boolean) => void;
  closeSheetsOnGenerate: boolean;
  setCloseSheetsOnGenerate: (v: boolean) => void;
  predictiveBackPreview: boolean;
  setPredictiveBackPreview: (v: boolean) => void;
  sliderHandleOnly: boolean;
  setSliderHandleOnly: (v: boolean) => void;
  historyGridColumns: number;
  setHistoryGridColumns: (v: number) => void;
  historyListEngine: HistoryListEngine;
  setHistoryListEngine: (v: HistoryListEngine) => void;
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
  isViewingActiveGeneration: boolean;
  selectGeneration: (record: GenerationRecord) => void;
  viewActiveGeneration: () => void;

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

export type StoreSet = StoreApi<GenerationState>["setState"];
export type StoreGet = StoreApi<GenerationState>["getState"];
