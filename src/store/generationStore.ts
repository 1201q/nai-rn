import { useEffect } from "react";
import { AppState } from "react-native";
import { create } from "zustand";
import notifee, { EventType } from "react-native-notify-kit";

import { generateRandomSeed } from "../constants/generation";
import {
  DEFAULT_MODEL,
  getDefaultModelSettings,
  getEffortModels,
  getModelCapabilities,
  type ModelSettings,
} from "../constants/models";
import { estimateAnlasCost } from "../lib/anlasCost";
import {
  CANCEL_ACTION_ID,
  stopGenerationService,
} from "../lib/foregroundService";
import {
  deleteGenerations as deleteStoredGenerations,
  listGenerationIds,
  listGenerationPage,
} from "../lib/generationHistory";
import { mergeGenerationHistoryRecords } from "../lib/generationHistoryPage";
import { buildMetadataImportPatch } from "../lib/metadataImport";
import { getNovelAiAnlasBalance, shouldUseAutoSmea } from "../lib/novelai";
import {
  MAX_PRECISE_REFERENCES,
  listPreciseReferences,
} from "../lib/preciseReferences";
import { getNovelAiToken, saveNovelAiToken } from "../lib/secureToken";
import { storage } from "../lib/storage";
import {
  MAX_VIBE_REFERENCES,
  canUseCachedVibeEncoding,
  listVibeReferences,
} from "../lib/vibeReferences";
import { toErrorMessage } from "./generationErrorMessage";
import { loadPersistedOptions } from "./generationOptionsHydration";
import {
  createGenerationOptionsPersistence,
  GENERATION_OPTIONS_STORAGE_KEY,
} from "./generationOptionsPersistence";
import {
  createGenerationQueueActions,
  isGenerationQueueActive,
} from "./generationQueue";
import { createGenerationReferenceActions } from "./generationReferenceActions";
import type { GenerationState } from "./generationStoreTypes";

export type { CharacterPrompt } from "../types/generation";
export type {
  AnlasRefreshResult,
  GenerationStartResult,
  GenerationStartRejectionReason,
} from "./generationStoreTypes";

let tokenRevision = 0;
let anlasRequestId = 0;

// 모델을 바꿀 때 현재 모델의 생성 설정(ModelSettings)을 기억해 두고, 새 모델의 값을 꺼낸다.
// 처음 쓰는 모델은 모델별 기본값으로 시작한다.
function switchModelSettings(
  state: Pick<
    GenerationState,
    "model" | keyof ModelSettings | "settingsByModel"
  >,
  nextModel: string,
) {
  const settingsByModel = {
    ...state.settingsByModel,
    [state.model]: {
      resolution: state.resolution,
      steps: state.steps,
      promptGuidance: state.promptGuidance,
      promptGuidanceRescale: state.promptGuidanceRescale,
      sampler: state.sampler,
      noiseSchedule: state.noiseSchedule,
      varietyPlus: state.varietyPlus,
    },
  };
  const effortModels = getEffortModels(nextModel);
  return {
    settingsByModel,
    ...(settingsByModel[nextModel] ?? getDefaultModelSettings(nextModel)),
    // 공식 웹과 동일: Effort만 바꾸면 steps, sampler, schedule, rescale 외의 설정은 그대로 가져간다.
    ...(effortModels && effortModels === getEffortModels(state.model)
      ? {
          resolution: state.resolution,
          promptGuidance: state.promptGuidance,
          varietyPlus: state.varietyPlus,
        }
      : {}),
  };
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
  qualityPreset: "standard",
  setQualityPreset: (v) => set({ qualityPreset: v }),
  transparentBackground: false,
  setTransparentBackground: (v) => set({ transparentBackground: v }),
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
    set((state) => {
      const character = state.characterPrompts.find((item) => item.id === id);
      if (
        !character ||
        (character.position.x === clampedX && character.position.y === clampedY)
      ) {
        return state;
      }
      return {
        characterPrompts: state.characterPrompts.map((item) =>
          item.id === id
            ? { ...item, position: { x: clampedX, y: clampedY } }
            : item,
        ),
      };
    });
  },

  model: DEFAULT_MODEL,
  setModel: (v) =>
    set((state) =>
      v === state.model
        ? state
        : { model: v, ...switchModelSettings(state, v) },
    ),
  ...getDefaultModelSettings(DEFAULT_MODEL),
  setResolution: (v) => set({ resolution: v }),
  setSteps: (v) => set({ steps: v }),
  setPromptGuidance: (v) => set({ promptGuidance: v }),
  settingsByModel: {},
  setPromptGuidanceRescale: (v) => set({ promptGuidanceRescale: v }),
  setNoiseSchedule: (v) => set({ noiseSchedule: v }),
  setSampler: (v) => set({ sampler: v }),
  seed: generateRandomSeed(),
  setSeed: (v) => set({ seed: v }),
  seedLocked: false,
  setSeedLocked: (v) => set({ seedLocked: v }),
  batchCount: 1,
  setBatchCount: (v) => set({ batchCount: v }),
  imageFormat: "png",
  setImageFormat: (v) => set({ imageFormat: v }),
  imageSaveDirectory: null,
  setImageSaveDirectory: (v) => set({ imageSaveDirectory: v }),
  setVarietyPlus: (v) => set({ varietyPlus: v }),
  applyMetadataImport: (parsed, selection) =>
    set((state) => {
      const patch = buildMetadataImportPatch(state, parsed, selection);
      if (patch.model === undefined || patch.model === state.model) {
        return patch;
      }
      // 이전 모델의 값은 기억해 두고, 이미지에 없는 설정은 새 모델의 값을 쓴다.
      return { ...switchModelSettings(state, patch.model), ...patch };
    }),
  ...createGenerationReferenceActions(set, get),
  mainImageBlurred: false,
  setMainImageBlurred: (v) => set({ mainImageBlurred: v }),
  mainImageLocked: false,
  setMainImageLocked: (v) => set({ mainImageLocked: v }),
  closeSheetsOnGenerate: true,
  setCloseSheetsOnGenerate: (v) => set({ closeSheetsOnGenerate: v }),
  predictiveBackPreview: true,
  setPredictiveBackPreview: (v) => set({ predictiveBackPreview: v }),
  sliderHandleOnly: false,
  setSliderHandleOnly: (v) => set({ sliderHandleOnly: v }),
  historyGridColumns: 3,
  setHistoryGridColumns: (v) => set({ historyGridColumns: v }),
  historyListEngine: "flat",
  setHistoryListEngine: (v) => set({ historyListEngine: v }),
  // 저장된 옵션을 기본값 위에 덮어쓰기 (데이터 필드만, 메서드 미영향).
  ...loadPersistedOptions(),

  storedToken: null,
  saveToken: async (token) => {
    await saveNovelAiToken(token);
    tokenRevision += 1;
    anlasRequestId += 1;
    set({ storedToken: token, anlasBalance: null });
  },

  anlasBalance: null,
  refreshAnlas: async () => {
    const requestId = ++anlasRequestId;
    const token = get().storedToken;
    if (!token) {
      set({ anlasBalance: null });
      return { status: "skipped", reason: "missing-token" };
    }

    try {
      const balance = await getNovelAiAnlasBalance(token);

      if (requestId !== anlasRequestId || get().storedToken !== token) {
        return { status: "skipped", reason: "stale-request" };
      }

      set({ anlasBalance: balance });
      return { status: "success", balance };
    } catch (error: unknown) {
      if (requestId !== anlasRequestId || get().storedToken !== token) {
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
        message: toErrorMessage(error),
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
        generationHistoryIds:
          state.generationHistoryIds?.filter((id) => !deletedIds.has(id)) ??
          null,
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
  isViewingActiveGeneration: false,
  selectGeneration: (record) =>
    set({ currentGeneration: record, isViewingActiveGeneration: false }),
  viewActiveGeneration: () => set({ isViewingActiveGeneration: true }),

  isLoading: false,
  message: null,
  setMessage: (v) => set({ message: v }),

  queueTotal: 0,
  queueIndex: 0,
  queueSteps: 0,
  queueCancelRequested: false,
  ...createGenerationQueueActions(set, get),
}));

// 전체 생성 진행률 (0~1). 완료 이미지 step + 현재 이미지 step 합산.
export const selectOverallPercent = (s: GenerationState) => {
  if (s.queueTotal === 0 || s.queueSteps === 0) return 0;
  const done = (s.queueIndex - 1) * s.queueSteps + (s.streamingStep ?? 0);
  return Math.min(1, Math.max(0, done / (s.queueTotal * s.queueSteps)));
};

// 이번 생성의 예상 Anlas 소모량. 구독 정보(잔액·tier)를 아직 모르면 null.
export const selectAnlasCost = (s: GenerationState): number | null => {
  if (!s.anlasBalance) return null;
  const activeVibes = s.vibeReferences
    .filter((item) => item.enabled)
    .slice(0, MAX_VIBE_REFERENCES);
  const isI2I = s.i2iEnabled && s.i2iSourceImage !== null;
  return estimateAnlasCost({
    model: s.model,
    width: s.resolution.width,
    height: s.resolution.height,
    steps: getModelCapabilities(s.model).fixedSettings?.steps ?? s.steps,
    strength: isI2I ? s.i2iStrength : 1,
    smea: shouldUseAutoSmea(
      s.model,
      s.resolution.width,
      s.resolution.height,
      s.sampler,
      isI2I,
    ),
    batchCount: Math.min(100, Math.max(1, s.batchCount)),
    tier: s.anlasBalance.tier,
    expiresAt: s.anlasBalance.expiresAt,
    nowSeconds: Date.now() / 1000,
    usageNegative: s.anlasBalance.usageNegative,
    activeVibeCount: activeVibes.length,
    unencodedVibeCount: activeVibes.filter(
      (item) => !canUseCachedVibeEncoding(item, s.model),
    ).length,
    activePreciseReferenceCount: s.preciseReferences
      .filter((item) => item.enabled)
      .slice(0, MAX_PRECISE_REFERENCES).length,
  });
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
    if (!isGenerationQueueActive()) {
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
    const { getState, setState } = useGenerationStore;
    const initialTokenRevision = tokenRevision;

    // 옵션은 store 생성 시 MMKV에서 동기 복원됨 (loadPersistedOptions).
    // 여기서는 토큰/히스토리/레퍼런스 비동기 로드만 처리.
    getNovelAiToken()
      .then((token) => {
        if (tokenRevision !== initialTokenRevision) return;
        setState({ storedToken: token });
        if (token) useGenerationStore.getState().refreshAnlas();
      })
      .catch((error: unknown) => {
        if (tokenRevision !== initialTokenRevision) return;
        setState({
          message: toErrorMessage(error),
        });
      });

    const loadHistory = async () => {
      let revision: number;
      let page: Awaited<ReturnType<typeof listGenerationPage>>;
      do {
        revision = getState().generationHistoryRevision;
        page = await listGenerationPage();
      } while (revision !== getState().generationHistoryRevision);

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
    };
    loadHistory().catch((error: unknown) => {
      setState({
        generationHistoryInitialized: true,
        message: toErrorMessage(error),
      });
    });

    const loadVibes = async () => {
      let previous: GenerationState["vibeReferences"];
      let references: Awaited<ReturnType<typeof listVibeReferences>>;
      do {
        previous = getState().vibeReferences;
        references = await listVibeReferences();
      } while (previous !== getState().vibeReferences);
      setState({ vibeReferences: references });
    };
    loadVibes().catch((error: unknown) => {
      setState({
        message: toErrorMessage(error),
      });
    });

    const loadPrecise = async () => {
      let previous: GenerationState["preciseReferences"];
      let references: Awaited<ReturnType<typeof listPreciseReferences>>;
      do {
        previous = getState().preciseReferences;
        references = await listPreciseReferences();
      } while (previous !== getState().preciseReferences);
      setState({ preciseReferences: references });
    };
    loadPrecise().catch((error: unknown) => {
      setState({
        message: toErrorMessage(error),
      });
    });
  }, []);

  // persist: 저장 대상 옵션 변경을 합쳐 마지막 상태만 write
  useEffect(() => {
    const persistence = createGenerationOptionsPersistence({
      initialJson: storage.getString(GENERATION_OPTIONS_STORAGE_KEY) ?? null,
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
