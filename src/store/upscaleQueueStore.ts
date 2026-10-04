import { File } from "expo-file-system";
import { create } from "zustand";

import {
  acquireGenerationWakeLock,
  releaseGenerationWakeLock,
} from "../../modules/generation-wake-lock";
import {
  imageUpscaler,
  type UpscaleFormat,
  type UpscaleModel,
  type UpscaleResult,
} from "../../modules/image-upscaler";
import {
  startUpscaleService,
  stopUpscaleService,
  updateUpscaleProgress,
} from "../lib/foregroundService";
import {
  requestGallerySavePermission,
  saveImageToGallery,
} from "../lib/gallery";

export type UpscaleSettings = {
  model: UpscaleModel;
  scale: number;
  noise: number;
  tileSize: number;
  format: UpscaleFormat;
};

export type UpscaleQueueItem = {
  id: string;
  uri: string;
  width: number;
  height: number;
  status: "pending" | "running" | "done" | "failed";
  // 갤러리에 저장한 뒤의 결과 정보. 임시 파일은 지우므로 uri는 남기지 않는다.
  result?: Omit<UpscaleResult, "uri">;
  error?: string;
};

type UpscaleStartResult = "started" | "no-module" | "no-permission";

type UpscaleQueueState = {
  items: UpscaleQueueItem[];
  running: boolean;
  stopRequested: boolean;
  addImages: (images: { uri: string; width: number; height: number }[]) => void;
  removeItem: (id: string) => void;
  clear: () => void;
  // 대기 / 실패 항목을 순서대로 처리하고 결과를 갤러리에 저장한다.
  start: (settings: UpscaleSettings) => Promise<UpscaleStartResult>;
  // 처리 중인 장이 끝나면 멈춘다.
  requestStop: () => void;
  // foreground service 태스크에서 호출하는 실제 큐 루프 (백그라운드 실행 보장).
  runQueueTask: () => Promise<void>;
};

let nextItemId = 0;
let pendingSettings: UpscaleSettings | null = null;
let queueRunning = false;

export const useUpscaleQueueStore = create<UpscaleQueueState>((set, get) => {
  function updateItem(id: string, patch: Partial<UpscaleQueueItem>) {
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    }));
  }

  return {
    items: [],
    running: false,
    stopRequested: false,

    addImages: (images) =>
      set((state) => ({
        items: [
          ...state.items,
          ...images.map((image) => ({
            ...image,
            id: `upscale_${nextItemId++}`,
            status: "pending" as const,
          })),
        ],
      })),

    removeItem: (id) =>
      set((state) => ({
        items: state.items.filter(
          (item) => item.id !== id || item.status === "running",
        ),
      })),

    clear: () => {
      if (!get().running) set({ items: [] });
    },

    start: async (settings) => {
      if (get().running) return "started";
      if (!imageUpscaler) return "no-module";
      if (!(await requestGallerySavePermission())) return "no-permission";

      pendingSettings = settings;
      set((state) => ({
        running: true,
        stopRequested: false,
        items: state.items.map((item) =>
          item.status === "failed"
            ? { ...item, status: "pending", error: undefined }
            : item,
        ),
      }));

      const total = get().items.filter(
        (item) => item.status === "pending",
      ).length;
      const serviceStarted = await startUpscaleService(total);
      if (!serviceStarted) void get().runQueueTask();
      return "started";
    },

    requestStop: () => {
      if (get().running) set({ stopRequested: true });
    },

    runQueueTask: async () => {
      const settings = pendingSettings;
      if (queueRunning || !settings || !imageUpscaler) return;
      pendingSettings = null;
      queueRunning = true;

      const total = get().items.filter(
        (item) => item.status === "pending",
      ).length;
      let done = 0;

      try {
        await acquireGenerationWakeLock();

        while (!get().stopRequested) {
          const item = get().items.find((entry) => entry.status === "pending");
          if (!item) break;

          updateItem(item.id, { status: "running" });
          try {
            const { uri, ...result } = await imageUpscaler.upscale(
              item.uri,
              settings.model,
              settings.scale,
              settings.noise,
              settings.tileSize,
              settings.format,
            );
            try {
              await saveImageToGallery(uri);
            } finally {
              new File(uri).delete();
            }
            updateItem(item.id, { status: "done", result });
          } catch (error: unknown) {
            updateItem(item.id, {
              status: "failed",
              error: error instanceof Error ? error.message : String(error),
            });
          }
          done += 1;
          void updateUpscaleProgress(done, total);
        }
      } finally {
        queueRunning = false;
        await releaseGenerationWakeLock();
        await stopUpscaleService();
        set({ running: false, stopRequested: false });
      }
    },
  };
});
