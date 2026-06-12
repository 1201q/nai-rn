import { useEffect } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { File } from "expo-file-system";
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
  generateNovelAiImageStream,
  getNovelAiAnlasBalance,
} from "../lib/novelai";
import { getNovelAiToken, saveNovelAiToken } from "../lib/secureToken";
import { isBoolean, isNumber, isString } from "../lib/guards";
import {
  DEFAULT_NAI_RESOLUTION,
  MAX_CHARACTER_PROMPTS,
  NAI_RESOLUTIONS,
  type NaiResolution,
  type NoiseSchedule,
} from "../constants/generation";

const GENERATION_OPTIONS_STORAGE_KEY = "nai_generation_options_v1";
const STREAMING_PREVIEW_THROTTLE_MS = 350;
const DEFAULT_I2I_STRENGTH = 0.7;
const DEFAULT_I2I_NOISE = 0;

export type CharacterPrompt = {
  id: string;
  prompt: string;
  negativePrompt: string;
  enabled: boolean;
};

export type I2ISourceImage = {
  uri: string;
  width: number;
  height: number;
};

type PersistedGenerationOptions = Partial<{
  prompt: string;
  negativePrompt: string;
  characterPrompts: CharacterPrompt[];
  model: string;
  resolution: NaiResolution;
  steps: number;
  promptGuidance: number;
  promptGuidanceRescale: number;
  noiseSchedule: NoiseSchedule;
  sampler: string;
  seed: number;
  seedLocked: boolean;
  outputCount: number;
  batchCount: number;
  varietyPlus: boolean;
  optionTabIndex: number;
}>;

function generateRandomSeed(): number {
  return Math.floor(Math.random() * 4_294_967_295);
}

export function roundI2IDimensionTo64(value: number): number {
  return Math.max(64, Math.round(value / 64) * 64);
}

export function getI2IEffectiveResolution(sourceImage: I2ISourceImage) {
  return {
    width: roundI2IDimensionTo64(sourceImage.width),
    height: roundI2IDimensionTo64(sourceImage.height),
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

function resolveStoredCharacterPrompts(value: unknown): CharacterPrompt[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.slice(0, MAX_CHARACTER_PROMPTS).flatMap((item, index) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const candidate = item as Partial<CharacterPrompt>;
    return [
      {
        id: isString(candidate.id)
          ? candidate.id
          : `stored-character-${index}`,
        prompt: isString(candidate.prompt) ? candidate.prompt : "",
        negativePrompt: isString(candidate.negativePrompt)
          ? candidate.negativePrompt
          : "",
        enabled: isBoolean(candidate.enabled) ? candidate.enabled : true,
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

    return [{ prompt, negativePrompt }];
  });
}

export type GenerationState = {
  // 프롬프트
  prompt: string;
  setPrompt: (v: string) => void;
  negativePrompt: string;
  setNegativePrompt: (v: string) => void;
  characterPrompts: CharacterPrompt[];
  setCharacterPrompts: (v: CharacterPrompt[]) => void;

  // 옵션
  model: string;
  setModel: (v: string) => void;
  resolution: NaiResolution;
  setResolution: (v: NaiResolution) => void;
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
  outputCount: number;
  setOutputCount: (v: number) => void;
  batchCount: number;
  setBatchCount: (v: number) => void;
  varietyPlus: boolean;
  setVarietyPlus: (v: boolean) => void;
  i2iSourceImage: I2ISourceImage | null;
  setI2ISourceImage: (v: I2ISourceImage) => void;
  i2iStrength: number;
  setI2IStrength: (v: number) => void;
  i2iNoise: number;
  setI2INoise: (v: number) => void;
  clearI2I: () => void;
  optionTabIndex: number;
  setOptionTabIndex: (v: number) => void;
  hasLoadedOptions: boolean;

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
    nSamples: number;
    varietyPlus: boolean;
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

export const useGenerationStore = create<GenerationState>((set, get) => ({
  prompt:
    "silver-haired mage, under moonlight, arcane magic circle, purple runes, starry night",
  setPrompt: (v) => set({ prompt: v }),
  negativePrompt: "low quality, blurry, watermark, text",
  setNegativePrompt: (v) => set({ negativePrompt: v }),
  characterPrompts: [],
  setCharacterPrompts: (v) => set({ characterPrompts: v }),

  model: "nai-diffusion-4-5-full",
  setModel: (v) => set({ model: v }),
  resolution: DEFAULT_NAI_RESOLUTION,
  setResolution: (v) => set({ resolution: v }),
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
  outputCount: 1,
  setOutputCount: (v) => set({ outputCount: v }),
  batchCount: 1,
  setBatchCount: (v) => set({ batchCount: v }),
  varietyPlus: false,
  setVarietyPlus: (v) => set({ varietyPlus: v }),
  i2iSourceImage: null,
  setI2ISourceImage: (v) => set({ i2iSourceImage: v }),
  i2iStrength: DEFAULT_I2I_STRENGTH,
  setI2IStrength: (v) => set({ i2iStrength: v }),
  i2iNoise: DEFAULT_I2I_NOISE,
  setI2INoise: (v) => set({ i2iNoise: v }),
  clearI2I: () =>
    set({
      i2iSourceImage: null,
      i2iStrength: DEFAULT_I2I_STRENGTH,
      i2iNoise: DEFAULT_I2I_NOISE,
    }),
  optionTabIndex: 0,
  setOptionTabIndex: (v) => set({ optionTabIndex: v }),
  hasLoadedOptions: false,

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
          ? generationHistory[0] ?? null
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
    if (s.i2iSourceImage) {
      try {
        i2iImageBase64 = await new File(s.i2iSourceImage.uri).base64();
        const effectiveResolution = getI2IEffectiveResolution(s.i2iSourceImage);
        width = effectiveResolution.width;
        height = effectiveResolution.height;
      } catch {
        set({ message: "I2I 이미지를 읽지 못했습니다." });
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
        nSamples: s.outputCount,
        varietyPlus: s.varietyPlus,
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
      queueCancelRequested: false,
      streamingPreviewUri: null,
      streamingStep: null,
      streamingGenerationId: null,
    });

    // Android: foreground service 시작 → 등록 태스크가 runQueueTask 구동
    // (등록 태스크 안에서 돌아야 백그라운드 실행 보장). 서비스 시작 실패(권한 거부 등)
    // 또는 비-Android면 직접 구동(포그라운드 한정).
    const started = await startGenerationService(total);
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

    try {
      for (let i = 1; i <= total; i++) {
        if (get().queueCancelRequested) break;

        set({
          queueIndex: i,
          streamingPreviewUri: null,
          streamingStep: null,
          streamingGenerationId: null,
        });
        updateGenerationProgress(i, total);

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
        queueCancelRequested: false,
        streamingPreviewUri: null,
        streamingStep: null,
        streamingGenerationId: null,
      });
    }
  },
}));

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
        queueCancelRequested: false,
      });
      void stopGenerationService();
    }
  }, []);

  useEffect(() => {
    const { setState } = useGenerationStore;

    AsyncStorage.getItem(GENERATION_OPTIONS_STORAGE_KEY)
      .then((storedOptions) => {
        if (!storedOptions) return;

        const parsed = JSON.parse(storedOptions) as PersistedGenerationOptions;
        const next: Partial<GenerationState> = {};
        if (isString(parsed.prompt)) next.prompt = parsed.prompt;
        if (isString(parsed.negativePrompt)) {
          next.negativePrompt = parsed.negativePrompt;
        }
        next.characterPrompts = resolveStoredCharacterPrompts(
          parsed.characterPrompts,
        );
        if (isString(parsed.model)) next.model = parsed.model;

        const storedResolution = resolveStoredResolution(parsed.resolution);
        if (storedResolution) next.resolution = storedResolution;

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
        if (isNumber(parsed.outputCount)) next.outputCount = parsed.outputCount;
        if (isNumber(parsed.batchCount)) next.batchCount = parsed.batchCount;
        if (isBoolean(parsed.varietyPlus)) next.varietyPlus = parsed.varietyPlus;
        if (
          isNumber(parsed.optionTabIndex) &&
          (parsed.optionTabIndex === 0 || parsed.optionTabIndex === 1)
        ) {
          next.optionTabIndex = parsed.optionTabIndex;
        }
        setState(next);
      })
      .catch((error: unknown) => {
        setState({
          message: error instanceof Error ? error.message : String(error),
        });
      })
      .finally(() => setState({ hasLoadedOptions: true }));

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
  }, []);

  // persist: 옵션 슬라이스 변경 시에만 write (이전 effect deps와 동일 집합)
  useEffect(() => {
    let lastJson: string | null = null;

    const unsubscribe = useGenerationStore.subscribe((state) => {
      if (!state.hasLoadedOptions) return;

      const nextOptions: PersistedGenerationOptions = {
        prompt: state.prompt,
        negativePrompt: state.negativePrompt,
        characterPrompts: state.characterPrompts,
        model: state.model,
        resolution: state.resolution,
        steps: state.steps,
        promptGuidance: state.promptGuidance,
        promptGuidanceRescale: state.promptGuidanceRescale,
        noiseSchedule: state.noiseSchedule,
        sampler: state.sampler,
        // 시드는 잠금일 때만 저장 (NAIS2 동일)
        ...(state.seedLocked ? { seed: state.seed } : {}),
        seedLocked: state.seedLocked,
        outputCount: state.outputCount,
        batchCount: state.batchCount,
        varietyPlus: state.varietyPlus,
        optionTabIndex: state.optionTabIndex,
      };

      const json = JSON.stringify(nextOptions);
      if (json === lastJson) return;
      lastJson = json;

      AsyncStorage.setItem(GENERATION_OPTIONS_STORAGE_KEY, json).catch(
        (error: unknown) => {
          useGenerationStore.setState({
            message: error instanceof Error ? error.message : String(error),
          });
        },
      );
    });

    return unsubscribe;
  }, []);
}
