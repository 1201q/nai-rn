import { AppState } from "react-native";
import { create } from "zustand";

import {
  acquireGenerationWakeLock,
  releaseGenerationWakeLock,
} from "../../modules/generation-wake-lock";
import {
  imageUpscaler,
  type UpscaleAdvancedOptions,
  type UpscaleFormat,
  type UpscaleModel,
  type UpscaleResult,
  type UpscaleTile,
} from "../../modules/image-upscaler";
import {
  startUpscaleService,
  stopUpscaleService,
  updateUpscaleProgress,
} from "../lib/foregroundService";
import { requestGallerySavePermission } from "../lib/gallery";
import { saveUpscaledImage } from "../lib/upscaleStorage";
import {
  loadUpscaleResults,
  persistUpscaleResults,
  pruneUpscaleResults,
  removeUpscaleResult,
  retainUpscaleResult,
} from "../lib/upscaleResults";

export type UpscaleSettings = UpscaleAdvancedOptions & {
  model: UpscaleModel;
  scale: number;
  noise: number;
  tileSize: number;
  format: UpscaleFormat;
  jpgQuality: number;
  webpQuality: number;
  autoSave: boolean;
  keepOriginalFilename: boolean;
  albumName: string;
};

export type UpscaleQueueItem = {
  id: string;
  uri: string;
  width: number;
  height: number;
  originalFilename?: string | null;
  status: "pending" | "running" | "done" | "failed";
  result?: Omit<UpscaleResult, "uri"> & { uri?: string };
  output?: Pick<
    UpscaleSettings,
    "format" | "keepOriginalFilename" | "albumName"
  >;
  saved?: boolean;
  saving?: boolean;
  saveError?: string;
  error?: string;
};

type UpscaleStartResult = "started" | "no-module" | "no-permission";

export type UpscalePreview = {
  requestId: string;
  phase: "preparing" | "upscaling" | "saving" | "complete";
  uri: string | null;
  sequence: number;
  tile: UpscaleTile | null;
  updatedAt: number;
  failed: boolean;
};
export type UpscaleSaveSummary = {
  saved: number;
  failed: number;
  denied: boolean;
};

type UpscaleQueueState = {
  items: UpscaleQueueItem[];
  running: boolean;
  stopRequested: boolean;
  // 처리 중인 장의 진행률 (0~1)
  progress: number;
  // 시작 시 확정한 배치. 실행 도중 추가된 항목은 포함하지 않는다.
  activeBatchIds: string[];
  batchCompleted: number;
  currentItemId: string | null;
  preview: UpscalePreview | null;
  previewVisible: boolean;
  persistenceError: string | null;
  setPreviewVisible: (visible: boolean) => void;
  saveItems: (ids: string[]) => Promise<UpscaleSaveSummary>;
  addImages: (
    images: {
      uri: string;
      width: number;
      height: number;
      originalFilename?: string | null;
    }[],
  ) => void;
  removeItem: (id: string) => void;
  clear: () => void;
  // 시작 시점의 대기 / 실패 항목만 순서대로 처리하고 갤러리에 저장한다.
  start: (settings: UpscaleSettings) => Promise<UpscaleStartResult>;
  // 처리 중인 장을 취소하고 멈춘다. 취소된 장은 대기로 돌아간다.
  requestStop: () => void;
  // foreground service 태스크에서 호출하는 실제 큐 루프 (백그라운드 실행 보장).
  runQueueTask: () => Promise<void>;
};

let nextItemId = 0;
let nextRequestId = 0;
let pendingSettings: UpscaleSettings | null = null;
let queueRunning = false;
let startPending = false;

export const useUpscaleQueueStore = create<UpscaleQueueState>((set, get) => {
  const restored = loadUpscaleResults();
  pruneUpscaleResults(restored);
  const persist = () => {
    try {
      persistUpscaleResults(get().items);
      if (get().persistenceError) set({ persistenceError: null });
    } catch {
      set({
        persistenceError:
          "결과 목록을 보관하지 못했습니다. 앱을 닫기 전에 갤러리에 저장하세요.",
      });
    }
  };
  function updateItem(id: string, patch: Partial<UpscaleQueueItem>) {
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    }));
    persist();
  }

  return {
    items: restored,
    running: false,
    stopRequested: false,
    progress: 0,
    activeBatchIds: [],
    batchCompleted: 0,
    currentItemId: null,
    preview: null,
    previewVisible: false,
    persistenceError: null,
    setPreviewVisible: (visible) => {
      set({ previewVisible: visible });
      const id = get().preview?.requestId;
      if (id)
        imageUpscaler?.setPreviewEnabled?.(
          id,
          visible && AppState.currentState === "active",
        );
    },

    addImages: (images) =>
      set((state) => ({
        items: [
          ...state.items,
          ...images.map((image) => ({
            ...image,
            id: `upscale_${Date.now()}_${nextItemId++}`,
            status: "pending" as const,
          })),
        ],
      })),

    removeItem: (id) => {
      const state = get();
      const item = state.items.find((entry) => entry.id === id);
      if (
        !item ||
        item.saving ||
        (state.running && state.activeBatchIds.includes(id))
      )
        return;
      set({
        items: state.items.filter((entry) => entry.id !== id),
        ...(state.currentItemId === id
          ? { currentItemId: null, preview: null }
          : {}),
      });
      persist();
      removeUpscaleResult(item.result?.uri);
    },
    clear: () => {
      const state = get();
      if (state.running || state.items.some((item) => item.saving)) return;
      set({ items: [], currentItemId: null, preview: null });
      persist();
      state.items.forEach((item) => removeUpscaleResult(item.result?.uri));
    },
    saveItems: async (ids) => {
      const targets = get().items.filter(
        (item) =>
          ids.includes(item.id) &&
          item.status === "done" &&
          item.result?.uri &&
          item.output &&
          !item.saved &&
          !item.saving,
      );
      const summary: UpscaleSaveSummary = {
        saved: 0,
        failed: 0,
        denied: false,
      };
      if (targets.length === 0) return summary;
      // Claim every target before the permission prompt to prevent duplicate saves.
      targets.forEach((item) =>
        updateItem(item.id, { saving: true, saveError: undefined }),
      );
      try {
        if (!(await requestGallerySavePermission())) {
          summary.denied = true;
          summary.failed = targets.length;
          targets.forEach((item) =>
            updateItem(item.id, { saveError: "사진 저장 권한이 필요합니다." }),
          );
          return summary;
        }
        for (const item of targets) {
          try {
            await saveUpscaledImage(item.result!.uri!, {
              ...item.output!,
              originalFilename: item.originalFilename,
            });
            updateItem(item.id, { saved: true, saveError: undefined });
            summary.saved++;
          } catch (error) {
            updateItem(item.id, {
              saveError: error instanceof Error ? error.message : String(error),
            });
            summary.failed++;
          }
        }
        return summary;
      } catch (error) {
        summary.failed = targets.length - summary.saved;
        targets.forEach((item) => {
          if (!get().items.find((entry) => entry.id === item.id)?.saved)
            updateItem(item.id, {
              saveError: error instanceof Error ? error.message : String(error),
            });
        });
        return summary;
      } finally {
        targets.forEach((item) => updateItem(item.id, { saving: false }));
      }
    },

    start: async (settings) => {
      if (get().running || startPending) return "started";
      if (!imageUpscaler) return "no-module";
      const candidates = get()
        .items.filter(
          (item) => item.status === "pending" || item.status === "failed",
        )
        .map((item) => item.id);
      if (candidates.length === 0) return "started";
      const snapshot = { ...settings };
      startPending = true;
      try {
        if (snapshot.autoSave && !(await requestGallerySavePermission()))
          return "no-permission";
      } finally {
        startPending = false;
      }
      const activeBatchIds = candidates.filter((id) =>
        get().items.some((item) => item.id === id),
      );
      if (activeBatchIds.length === 0) return "started";
      pendingSettings = snapshot;
      set((state) => ({
        running: true,
        stopRequested: false,
        progress: 0,
        activeBatchIds,
        batchCompleted: 0,
        currentItemId: null,
        items: state.items.map((item) =>
          activeBatchIds.includes(item.id) && item.status === "failed"
            ? { ...item, status: "pending", error: undefined }
            : item,
        ),
      }));

      const serviceStarted = await startUpscaleService(activeBatchIds.length);
      if (!serviceStarted) void get().runQueueTask();
      return "started";
    },

    requestStop: () => {
      if (!get().running) return;
      set({ stopRequested: true });
      imageUpscaler?.cancel();
    },

    runQueueTask: async () => {
      const settings = pendingSettings;
      if (queueRunning || !settings || !imageUpscaler) return;
      pendingSettings = null;
      queueRunning = true;

      const batchIds = new Set(get().activeBatchIds);
      const total = batchIds.size;
      let done = 0;
      const progressSubscription = imageUpscaler.addListener(
        "progress",
        (event) => {
          const preview = get().preview;
          if (
            !preview ||
            (event.requestId && event.requestId !== preview.requestId) ||
            get().items.find((item) => item.id === get().currentItemId)
              ?.status !== "running"
          )
            return;
          set({
            ...(event.fraction !== undefined
              ? { progress: Math.max(0, Math.min(1, event.fraction)) }
              : {}),
            preview: {
              ...preview,
              phase: event.phase ?? "upscaling",
              tile: event.tile ?? null,
              updatedAt: Date.now(),
            },
          });
        },
      );
      const previewSubscription = imageUpscaler.prepare
        ? imageUpscaler.addListener("preview", (event) => {
            const preview = get().preview;
            if (
              !preview ||
              event.requestId !== preview.requestId ||
              get().items.find((item) => item.id === get().currentItemId)
                ?.status !== "running"
            )
              return;
            if (event.failed) set({ preview: { ...preview, failed: true } });
            else if (
              event.imageUri &&
              event.sequence !== undefined &&
              event.sequence > preview.sequence &&
              AppState.currentState === "active"
            ) {
              set({
                preview: {
                  ...preview,
                  uri: event.imageUri,
                  sequence: event.sequence,
                  failed: false,
                  updatedAt: Date.now(),
                },
              });
            }
          })
        : null;
      const appState = AppState.addEventListener("change", (state) => {
        const id = get().preview?.requestId;
        if (id)
          imageUpscaler?.setPreviewEnabled?.(
            id,
            state === "active" && get().previewVisible,
          );
      });

      try {
        await acquireGenerationWakeLock();

        while (!get().stopRequested) {
          const item = get().items.find(
            (entry) => batchIds.has(entry.id) && entry.status === "pending",
          );
          if (!item) break;

          const requestId = item.id + "_run_" + nextRequestId++;
          const previousId = get().preview?.requestId;
          set({
            progress: 0,
            currentItemId: item.id,
            preview: {
              requestId,
              phase: "preparing",
              uri: null,
              sequence: -1,
              tile: null,
              updatedAt: Date.now(),
              failed: false,
            },
          });
          if (previousId && !get().previewVisible)
            imageUpscaler.releasePreviews?.(previousId);
          updateItem(item.id, { status: "running" });
          try {
            let prepared = false;
            try {
              imageUpscaler.prepare?.(
                requestId,
                get().previewVisible && AppState.currentState === "active",
              );
              prepared = !!imageUpscaler.prepare;
            } catch {
              /* The preview is optional. */
            }
            const nativeResult = await imageUpscaler.upscale(
              item.uri,
              settings.model,
              settings.scale,
              settings.noise,
              settings.tileSize,
              settings.format,
              settings.format === "webp"
                ? settings.webpQuality
                : settings.jpgQuality,
              {
                ...(prepared ? { requestId } : {}),
                ttaMode: settings.ttaMode,
                syncGap: settings.syncGap,
                limitGpuPerformance: settings.limitGpuPerformance,
                useGpu: settings.useGpu,
                cpuThreads: settings.cpuThreads,
                cpuPolicy: settings.cpuPolicy,
              },
            );
            const uri = retainUpscaleResult(
              nativeResult.uri,
              item.id,
              settings.format,
            );
            const result = { ...nativeResult, uri };
            const output = {
              format: settings.format,
              keepOriginalFilename: settings.keepOriginalFilename,
              albumName: settings.albumName,
            };
            updateItem(item.id, {
              status: "done",
              result,
              output,
              saved: false,
              saving: settings.autoSave,
              saveError: undefined,
            });
            if (settings.autoSave) {
              try {
                await saveUpscaledImage(uri, {
                  ...output,
                  originalFilename: item.originalFilename,
                });
                updateItem(item.id, { saved: true });
              } catch (error) {
                updateItem(item.id, {
                  saveError:
                    error instanceof Error ? error.message : String(error),
                });
              } finally {
                updateItem(item.id, { saving: false });
              }
            }
            const preview = get().preview;
            if (preview)
              set({ preview: { ...preview, phase: "complete", tile: null } });
          } catch (error: unknown) {
            const message =
              error instanceof Error ? error.message : String(error);
            updateItem(
              item.id,
              message.includes("UPSCALE_CANCELLED")
                ? { status: "pending" }
                : { status: "failed", error: message },
            );
            if (message.includes("UPSCALE_CANCELLED")) break;
          }
          if (!get().previewVisible) imageUpscaler.releasePreviews?.(requestId);
          done += 1;
          set({ batchCompleted: done, progress: 0 });
          void updateUpscaleProgress(done, total);
        }
      } finally {
        progressSubscription.remove();
        previewSubscription?.remove();
        appState.remove();
        if (!get().previewVisible && get().preview)
          imageUpscaler.releasePreviews?.(get().preview!.requestId);
        queueRunning = false;
        try {
          await releaseGenerationWakeLock();
        } finally {
          try {
            await stopUpscaleService();
          } finally {
            set({
              running: false,
              stopRequested: false,
              activeBatchIds: [],
              progress: 0,
            });
          }
        }
      }
    },
  };
});
