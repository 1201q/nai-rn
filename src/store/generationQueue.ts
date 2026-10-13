import { AppState } from "react-native";

import {
  acquireGenerationWakeLock,
  releaseGenerationWakeLock,
  waitForGenerationInterval,
} from "../../modules/generation-wake-lock";
import {
  generateRandomSeed,
  MAX_GENERATION_PIXELS,
} from "../constants/generation";
import { getModelCapabilities } from "../constants/models";
import {
  startGenerationService,
  stopGenerationService,
  updateGenerationProgress,
} from "../lib/foregroundService";
import { generateAndSaveImage } from "../lib/generationImagePipeline";
import { resolveActiveCharacterPrompts } from "../lib/imagePromptCaptions";
import { renderI2IRequestImageBase64 } from "../lib/i2iReference";
import {
  encodeNovelAiVibe,
  NovelAiRequestError,
  type GenerateNovelAiImageInput,
} from "../lib/novelai";
import {
  MAX_PRECISE_REFERENCES,
  readPreciseReferenceProcessedBase64,
  type PreciseReferenceType,
} from "../lib/preciseReferences";
import {
  describePromptChunkErrors,
  resolvePromptChunks,
} from "../lib/promptChunks";
import {
  MAX_VIBE_REFERENCES,
  canUseCachedVibeEncoding,
  readEncodedVibeReferenceBase64,
  readVibeReferenceImageBase64,
  saveEncodedVibeReference,
  type VibeReference,
} from "../lib/vibeReferences";
import { toErrorMessage } from "./generationErrorMessage";
import {
  PRECISE_UNSUPPORTED_MESSAGE,
  REFERENCE_CONFLICT_MESSAGE,
} from "./generationReferenceActions";
import type {
  GenerationState,
  GenerationStartRejectionReason,
  GenerationStartResult,
  StoreGet,
  StoreSet,
} from "./generationStoreTypes";
import { usePromptChunkStore } from "./promptChunkStore";

const STREAMING_PREVIEW_THROTTLE_MS = 350;
// 알림 step 갱신 throttle (네이티브 displayNotification 호출 상한)
const NOTIF_PROGRESS_THROTTLE_MS = 800;
const BATCH_REQUEST_INTERVAL_MS = 500;
const GENERATION_STARTED: GenerationStartResult = { status: "started" };

function rejectGenerationStart(
  reason: GenerationStartRejectionReason,
): GenerationStartResult {
  return { status: "rejected", reason };
}

type QueuePromptFields =
  "token" | "prompt" | "negativePrompt" | "characterPrompts";

type QueueParams = Required<
  Pick<GenerateNovelAiImageInput, QueuePromptFields>
> & {
  opts: Omit<GenerateNovelAiImageInput, QueuePromptFields | "seed">;
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

const IDLE_QUEUE_STATE = {
  isLoading: false,
  queueTotal: 0,
  queueIndex: 0,
  queueSteps: 0,
  queueCancelRequested: false,
  streamingPreviewUri: null,
  streamingStep: null,
  streamingGenerationId: null,
} satisfies Pick<
  GenerationState,
  | "isLoading"
  | "queueTotal"
  | "queueIndex"
  | "queueSteps"
  | "queueCancelRequested"
  | "streamingPreviewUri"
  | "streamingStep"
  | "streamingGenerationId"
>;

export function isGenerationQueueActive() {
  return queueStarting || queueRunning;
}

async function waitForNextBatchRequest(
  signal: AbortSignal,
  delayMs = BATCH_REQUEST_INTERVAL_MS,
): Promise<boolean> {
  if (signal.aborted) return Promise.resolve(false);

  let onAbort: (() => void) | undefined;
  const abortPromise = new Promise<boolean>((resolve) => {
    onAbort = () => resolve(false);
    signal.addEventListener("abort", onAbort, { once: true });
  });

  try {
    return await Promise.race([
      waitForGenerationInterval(delayMs).then(() => !signal.aborted),
      abortPromise,
    ]);
  } finally {
    if (onAbort) {
      signal.removeEventListener("abort", onAbort);
    }
  }
}

// 429(동시 생성 제한)는 서버가 생성 전에 거절한 것이라 차감 없이 다시 시도할 수 있다.
// 5xx는 차감 후 실패했을 수 있어 재시도하지 않는다.
const RATE_LIMIT_RETRY_DELAYS_MS = [3000, 6000, 9000];

async function retryOnRateLimit<T>(
  request: () => Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await request();
    } catch (error: unknown) {
      const delayMs = RATE_LIMIT_RETRY_DELAYS_MS[attempt];
      if (
        !(error instanceof NovelAiRequestError) ||
        error.status !== 429 ||
        delayMs === undefined ||
        !(await waitForNextBatchRequest(signal, delayMs))
      ) {
        throw error;
      }
    }
  }
}

export function createGenerationQueueActions(
  set: StoreSet,
  get: StoreGet,
): Pick<
  GenerationState,
  "requestQueueCancel" | "generateImage" | "runQueueTask"
> {
  return {
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
      // Prompt Chunk 참조는 여기서 한 번만 펼친다. 큐에는 펼친 문자열만 들어가므로
      // 배치 도중 chunk를 고쳐도 진행 중인 요청은 바뀌지 않는다.
      const { chunks } = usePromptChunkStore.getState();
      const chunkErrors: string[] = [];
      const expandChunks = (text: string) => {
        const resolution = resolvePromptChunks(text, chunks);
        const error = describePromptChunkErrors(resolution);
        if (error) chunkErrors.push(error);
        return resolution.text.trim();
      };
      // 고정 설정이 있는 모델(Effort Medium)은 저장된 값 대신 고정값으로 생성하고 사용자 UC를 보내지 않는다.
      // 저장된 값은 그대로 두어 High로 돌아가면 다시 쓰인다.
      const fixedSettings = getModelCapabilities(s.model).fixedSettings;
      const steps = fixedSettings?.steps ?? s.steps;
      const effPrompt = expandChunks(overrides?.prompt ?? s.prompt);
      const effNegativePrompt = fixedSettings
        ? ""
        : expandChunks(overrides?.negativePrompt ?? s.negativePrompt);
      const effCharacterPrompts = resolveActiveCharacterPrompts(
        s.characterPrompts,
        s.model,
      ).map((item) => ({
        ...item,
        prompt: expandChunks(item.prompt),
        negativePrompt: fixedSettings ? "" : expandChunks(item.negativePrompt),
      }));
      if (chunkErrors.length > 0) {
        set({
          message: `Prompt Chunk 참조를 확인하세요. ${[...new Set(chunkErrors)].join(" / ")}`,
        });
        return rejectGenerationStart("validation");
      }

      if (s.resolution.width * s.resolution.height > MAX_GENERATION_PIXELS) {
        set({
          message: `해상도가 너무 큽니다. 전체 픽셀 수는 ${MAX_GENERATION_PIXELS.toLocaleString()} 이하여야 합니다 (현재 ${s.resolution.width}×${s.resolution.height}).`,
        });
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
        set(IDLE_QUEUE_STATE);
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
        isViewingActiveGeneration: true,
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
      const width = s.resolution.width;
      const height = s.resolution.height;
      let i2iImageBase64: string | undefined;
      if (s.i2iEnabled && s.i2iSourceImage) {
        try {
          // NAI는 소스 이미지 크기 == width/height를 요구. 공식 웹처럼 해상도 설정 크기로 늘리고 흰 배경에 합친다.
          i2iImageBase64 = await renderI2IRequestImageBase64(
            s.i2iSourceImage.uri,
            width,
            height,
          );
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
          message: REFERENCE_CONFLICT_MESSAGE,
        });
        finishPreparation();
        return rejectGenerationStart("validation");
      }

      if (activeVibes.length > 0) {
        if (!getModelCapabilities(s.model).vibeTransfer) {
          set({
            message: "Vibe Transfer는 현재 모델에서 사용할 수 없습니다.",
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
            const canUseCachedEncoding = canUseCachedVibeEncoding(
              vibe,
              s.model,
            );

            if (canUseCachedEncoding) {
              encodedImages.push(
                await readEncodedVibeReferenceBase64(vibe, s.model),
              );
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
              s.model,
            );
            if (stopIfPreparationCancelled()) {
              return rejectGenerationStart("cancelled");
            }
            encodedImages.push(encodedBase64);

            const updatedReference = await saveEncodedVibeReference(
              vibe.id,
              encodedBase64,
              vibe.informationExtracted,
              s.model,
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
                  encodings: updated.encodings,
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
              message: toErrorMessage(
                error,
                "Vibe 이미지를 인코딩하지 못했습니다.",
              ),
            });
          }
          finishPreparation();
          return rejectGenerationStart(
            wasCancelled ? "cancelled" : "preparation",
          );
        }
      }

      if (activePreciseReferences.length > 0) {
        if (!getModelCapabilities(s.model).preciseReference) {
          set({
            message: PRECISE_UNSUPPORTED_MESSAGE,
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
              message: toErrorMessage(
                error,
                "Precise Reference 이미지를 읽지 못했습니다.",
              ),
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
        characterPrompts: effCharacterPrompts,
        opts: {
          model: s.model,
          width,
          height,
          steps: s.steps,
          promptGuidance: s.promptGuidance,
          promptGuidanceRescale: s.promptGuidanceRescale,
          noiseSchedule: s.noiseSchedule,
          sampler: s.sampler,
          imageFormat: s.imageFormat,
          varietyPlus: s.varietyPlus,
          qualityPreset: s.qualityPreset,
          transparentBackground: s.transparentBackground,
          ucPreset: s.ucPreset,
          characterPositionEnabled: s.characterPositionEnabled,
          ...fixedSettings,
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
        queueSteps: steps,
        streamingPreviewUri: null,
        streamingStep: null,
        streamingGenerationId: null,
      });
      handoffPreparation();

      // Android: foreground service 시작 → 등록 태스크가 runQueueTask 구동
      // (등록 태스크 안에서 돌아야 백그라운드 실행 보장). 서비스 시작 실패(권한 거부 등)
      // 또는 비-Android면 직접 구동(포그라운드 한정).
      const serviceStarted = await startGenerationService(total, steps);
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
          const generation = await retryOnRateLimit(
            () =>
              generateAndSaveImage(
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

                    // 프리뷰 파일이 없는 중간 이벤트도 진행률은 갱신한다.
                    if (AppState.currentState !== "active" || !event.imageUri) {
                      set({ streamingStep: event.step });
                      return;
                    }
                    const now = Date.now();
                    if (
                      now - lastPreviewUpdateAt <
                        STREAMING_PREVIEW_THROTTLE_MS &&
                      get().streamingPreviewUri
                    ) {
                      return;
                    }

                    lastPreviewUpdateAt = now;
                    set({
                      streamingPreviewUri: event.imageUri,
                      streamingStep: event.step,
                      streamingGenerationId: event.generationId,
                    });
                    return;
                  }

                  if (event.type === "final") {
                    set({
                      streamingPreviewUri: event.imageUri,
                      streamingGenerationId: event.generationId,
                    });
                    return;
                  }

                  return;
                },
                abortController.signal,
              ),
            abortController.signal,
          );

          set((state) => ({
            currentGeneration: state.isViewingActiveGeneration
              ? generation
              : state.currentGeneration,
            generationHistory: [generation, ...state.generationHistory],
            generationHistoryIds: state.generationHistoryIds
              ? [
                  generation.id,
                  ...state.generationHistoryIds.filter(
                    (id) => id !== generation.id,
                  ),
                ]
              : null,
            generationHistoryRevision: state.generationHistoryRevision + 1,
            streamingPreviewUri: null,
            streamingStep: null,
            streamingGenerationId: null,
          }));
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
        if (!wasCancelled) {
          set({
            message: toErrorMessage(error),
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
        set(IDLE_QUEUE_STATE);
      }
    },
  };
}
