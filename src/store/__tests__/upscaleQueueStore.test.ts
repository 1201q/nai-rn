import { storage } from "../../lib/storage";
import { AppState, type AppStateStatus } from "react-native";
import {
  imageUpscaler,
  type UpscaleResult,
} from "../../../modules/image-upscaler";
import {
  requestGallerySavePermission,
  saveImageToGallery,
} from "../../lib/gallery";
import { DEFAULT_UPSCALE_SETTINGS } from "../../screens/upscale/upscaleOptions";
import { useUpscaleQueueStore } from "../upscaleQueueStore";

const mockNativeListeners = new Map<string, (event: any) => void>();

jest.mock("../../lib/storage", () => ({
  storage: { getString: jest.fn(), set: jest.fn() },
}));
jest.mock("expo-file-system", () => ({
  Paths: { cache: "file:///cache", document: "file:///documents" },
  Directory: jest.fn((root: string, name: string) => ({
    uri: `${root}/${name}`,
    create: jest.fn(),
    delete: jest.fn(),
  })),
  File: jest.fn((root: string | { uri: string }, filename?: string) => ({
    uri: filename
      ? `${typeof root === "string" ? root : root.uri}/${filename}`
      : root,
    delete: jest.fn(),
    copy: jest.fn(),
    move: jest.fn(),
    exists: true,
  })),
}));
jest.mock("../../../modules/image-upscaler", () => ({
  imageUpscaler: {
    upscale: jest.fn(),
    addListener: jest.fn((name, listener) => {
      mockNativeListeners.set(name, listener);
      return { remove: jest.fn() };
    }),
    cancel: jest.fn(),
  },
}));
jest.mock("../../../modules/generation-wake-lock", () => ({
  acquireGenerationWakeLock: jest.fn(),
  releaseGenerationWakeLock: jest.fn(),
}));
jest.mock("../../lib/foregroundService", () => ({
  startUpscaleService: jest.fn(async () => true),
  stopUpscaleService: jest.fn(),
  updateUpscaleProgress: jest.fn(),
}));
jest.mock("../../lib/gallery", () => ({
  requestGallerySavePermission: jest.fn(async () => true),
  saveImageToGallery: jest.fn(),
}));

const defaultResult: UpscaleResult = {
  uri: "file:///output.jpg",
  width: 200,
  height: 200,
  bytes: 100,
  elapsedMs: 20,
  usedGpu: true,
  tileSize: 100,
  cpuThreads: 0,
  cpuPolicy: 0,
};

beforeEach(() => {
  jest.clearAllMocks();
  jest
    .spyOn(AppState, "addEventListener")
    .mockReturnValue({ remove: jest.fn() });
  mockNativeListeners.clear();
  delete imageUpscaler!.prepare;
  delete imageUpscaler!.setPreviewEnabled;
  delete imageUpscaler!.releasePreviews;
  jest.mocked(requestGallerySavePermission).mockResolvedValue(true);
  jest.mocked(saveImageToGallery).mockResolvedValue();
  useUpscaleQueueStore.setState({
    items: [],
    running: false,
    stopRequested: false,
    activeBatchIds: [],
    batchCompleted: 0,
    currentItemId: null,
    progress: 0,
    persistenceError: null,
    preview: null,
    previewVisible: false,
  });
  jest.mocked(imageUpscaler!.upscale).mockResolvedValue(defaultResult);
});

test("saves a queued image with its source name and album without changing the selected output extension", async () => {
  const store = useUpscaleQueueStore.getState();
  store.addImages([
    {
      uri: "file:///input.png",
      width: 100,
      height: 100,
      originalFilename: "my-drawing.png",
    },
  ]);
  await store.start({
    ...DEFAULT_UPSCALE_SETTINGS,
    format: "webp",
    keepOriginalFilename: true,
    albumName: "Upscaled",
  });
  await store.runQueueTask();
  expect(saveImageToGallery).toHaveBeenCalledWith(
    expect.stringMatching(/\/my-drawing\.webp$/),
    "Upscaled",
  );
  expect(useUpscaleQueueStore.getState().items[0]).toMatchObject({
    originalFilename: "my-drawing.png",
    status: "done",
  });
});

test("passes CPU settings to native and retains actual execution information", async () => {
  jest.mocked(imageUpscaler!.upscale).mockResolvedValue({
    uri: "file:///cpu.png",
    width: 200,
    height: 200,
    bytes: 100,
    elapsedMs: 100,
    usedGpu: false,
    tileSize: 400,
    cpuThreads: 2,
    cpuPolicy: 2,
  });
  const store = useUpscaleQueueStore.getState();
  store.addImages([{ uri: "file:///input.png", width: 100, height: 100 }]);
  await store.start({
    ...DEFAULT_UPSCALE_SETTINGS,
    useGpu: false,
    cpuThreads: 8,
    cpuPolicy: 2,
  });
  await store.runQueueTask();
  expect(imageUpscaler!.upscale).toHaveBeenCalledWith(
    "file:///input.png",
    "realcugan-se",
    2,
    -1,
    0,
    "png",
    95,
    {
      ttaMode: false,
      syncGap: 3,
      limitGpuPerformance: false,
      useGpu: false,
      cpuThreads: 8,
      cpuPolicy: 2,
    },
  );
  expect(useUpscaleQueueStore.getState().items[0].result).toMatchObject({
    usedGpu: false,
    cpuThreads: 2,
    cpuPolicy: 2,
  });
});

test.each([
  ["jpg", 71],
  ["webp", 83],
  ["png", 71],
] as const)(
  "passes the selected %s quality to the native encoder and saves the result",
  async (format, quality) => {
    const store = useUpscaleQueueStore.getState();
    store.addImages([{ uri: "file:///input.png", width: 100, height: 100 }]);
    await store.start({
      ...DEFAULT_UPSCALE_SETTINGS,
      format,
      jpgQuality: 71,
      webpQuality: 83,
    });
    await store.runQueueTask();
    expect(imageUpscaler!.upscale).toHaveBeenCalledWith(
      "file:///input.png",
      "realcugan-se",
      2,
      -1,
      0,
      format,
      quality,
      {
        ttaMode: false,
        syncGap: 3,
        limitGpuPerformance: false,
        useGpu: true,
        cpuThreads: 0,
        cpuPolicy: 0,
      },
    );
    expect(saveImageToGallery).toHaveBeenCalledWith(
      expect.stringContaining("file:///documents/upscale-results/upscale_"),
    );
    expect(useUpscaleQueueStore.getState().items[0].status).toBe("done");
    expect(useUpscaleQueueStore.getState().running).toBe(false);
  },
);

test.each([0, 1, 2, 3] as const)(
  "passes TTA and Sync Gap %s to the native engine",
  async (syncGap) => {
    const store = useUpscaleQueueStore.getState();
    store.addImages([{ uri: "file:///input.png", width: 100, height: 100 }]);
    await store.start({ ...DEFAULT_UPSCALE_SETTINGS, ttaMode: true, syncGap });
    await store.runQueueTask();
    expect(imageUpscaler!.upscale).toHaveBeenCalledWith(
      "file:///input.png",
      "realcugan-se",
      2,
      -1,
      0,
      "png",
      95,
      {
        ttaMode: true,
        syncGap,
        limitGpuPerformance: false,
        useGpu: true,
        cpuThreads: 0,
        cpuPolicy: 0,
      },
    );
  },
);

test.each([0, 400])(
  "passes GPU limiting and the original tile %s to native and keeps the applied tile result",
  async (tileSize) => {
    const store = useUpscaleQueueStore.getState();
    store.addImages([{ uri: "file:///input.png", width: 100, height: 100 }]);
    await store.start({
      ...DEFAULT_UPSCALE_SETTINGS,
      tileSize,
      limitGpuPerformance: true,
    });
    await store.runQueueTask();
    expect(imageUpscaler!.upscale).toHaveBeenCalledWith(
      "file:///input.png",
      "realcugan-se",
      2,
      -1,
      tileSize,
      "png",
      95,
      {
        ttaMode: false,
        syncGap: 3,
        limitGpuPerformance: true,
        useGpu: true,
        cpuThreads: 0,
        cpuPolicy: 0,
      },
    );
    expect(useUpscaleQueueStore.getState().items[0].result?.tileSize).toBe(100);
  },
);

function inputs(...names: string[]) {
  return names.map((name) => ({
    uri: `file:///${name}.png`,
    width: 100,
    height: 100,
  }));
}

test("fixes the three-image batch at start and leaves later additions for another explicit start", async () => {
  const store = useUpscaleQueueStore.getState();
  store.addImages(inputs("first", "second", "third"));
  await store.start(DEFAULT_UPSCALE_SETTINGS);
  const batchIds = [...useUpscaleQueueStore.getState().activeBatchIds];
  store.addImages(inputs("before-service"));
  const result = defaultResult;
  jest.mocked(imageUpscaler!.upscale).mockImplementationOnce(async () => {
    expect(useUpscaleQueueStore.getState().currentItemId).toBe(batchIds[0]);
    store.addImages(inputs("during-upscale"));
    // An active batch item cannot disappear while the total is fixed.
    store.removeItem(batchIds[1]);
    return result;
  });
  await store.runQueueTask();
  expect(imageUpscaler!.upscale).toHaveBeenCalledTimes(3);
  expect(useUpscaleQueueStore.getState()).toMatchObject({
    running: false,
    batchCompleted: 3,
    activeBatchIds: [],
  });
  expect(
    useUpscaleQueueStore.getState().items.map((item) => item.status),
  ).toEqual(["done", "done", "done", "pending", "pending"]);
  await store.runQueueTask();
  expect(imageUpscaler!.upscale).toHaveBeenCalledTimes(3);
  await store.start(DEFAULT_UPSCALE_SETTINGS);
  await store.runQueueTask();
  expect(imageUpscaler!.upscale).toHaveBeenCalledTimes(5);
  expect(useUpscaleQueueStore.getState().batchCompleted).toBe(2);
});

test("keeps images added during the permission prompt out of the batch and prevents duplicate starts", async () => {
  const store = useUpscaleQueueStore.getState();
  let grant!: (value: boolean) => void;
  jest.mocked(requestGallerySavePermission).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        grant = resolve;
      }),
  );
  store.addImages(inputs("first"));
  const starting = store.start(DEFAULT_UPSCALE_SETTINGS);
  store.addImages(inputs("later"));
  await store.start(DEFAULT_UPSCALE_SETTINGS);
  expect(requestGallerySavePermission).toHaveBeenCalledTimes(1);
  grant(true);
  await starting;
  await store.runQueueTask();
  expect(imageUpscaler!.upscale).toHaveBeenCalledTimes(1);
  expect(useUpscaleQueueStore.getState().items[1].status).toBe("pending");
});

test("returns cancelled batch items to the planned queue without starting later images", async () => {
  const store = useUpscaleQueueStore.getState();
  let cancel!: (error: Error) => void;
  let entered!: () => void;
  const nativeStarted = new Promise<void>((resolve) => {
    entered = resolve;
  });
  jest.mocked(imageUpscaler!.upscale).mockImplementationOnce(() => {
    entered();
    return new Promise((_resolve, reject) => {
      cancel = reject;
    });
  });
  store.addImages(inputs("first", "second", "third"));
  await store.start(DEFAULT_UPSCALE_SETTINGS);
  const running = store.runQueueTask();
  await nativeStarted;
  store.addImages(inputs("later"));
  store.requestStop();
  cancel(new Error("UPSCALE_CANCELLED"));
  await running;
  expect(imageUpscaler!.cancel).toHaveBeenCalledTimes(1);
  expect(
    useUpscaleQueueStore
      .getState()
      .items.every((item) => item.status === "pending"),
  ).toBe(true);
  expect(useUpscaleQueueStore.getState().activeBatchIds).toEqual([]);
  expect(useUpscaleQueueStore.getState().running).toBe(false);
  await store.start(DEFAULT_UPSCALE_SETTINGS);
  await store.runQueueTask();
  expect(imageUpscaler!.upscale).toHaveBeenCalledTimes(5);
});

test("auto-save off retains the result without asking for gallery permission", async () => {
  jest.mocked(requestGallerySavePermission).mockResolvedValue(false);
  const store = useUpscaleQueueStore.getState();
  store.addImages(inputs("manual"));
  await store.start({ ...DEFAULT_UPSCALE_SETTINGS, autoSave: false });
  await store.runQueueTask();
  expect(requestGallerySavePermission).not.toHaveBeenCalled();
  expect(saveImageToGallery).not.toHaveBeenCalled();
  expect(useUpscaleQueueStore.getState().items[0]).toMatchObject({
    status: "done",
    saved: false,
    result: { uri: expect.stringContaining("/upscale-results/") },
  });
});

test("a gallery failure keeps the completed result and retries saving without running inference again", async () => {
  const store = useUpscaleQueueStore.getState();
  store.addImages(inputs("retry"));
  jest
    .mocked(saveImageToGallery)
    .mockRejectedValueOnce(new Error("gallery unavailable"));
  await store.start(DEFAULT_UPSCALE_SETTINGS);
  await store.runQueueTask();
  const item = useUpscaleQueueStore.getState().items[0];
  expect(item).toMatchObject({
    status: "done",
    saved: false,
    saving: false,
    saveError: "gallery unavailable",
  });
  expect(await store.saveItems([item.id])).toEqual({
    saved: 1,
    failed: 0,
    denied: false,
  });
  expect(imageUpscaler!.upscale).toHaveBeenCalledTimes(1);
  expect(useUpscaleQueueStore.getState().items[0]).toMatchObject({
    saved: true,
    saveError: undefined,
  });
  expect(await store.saveItems([item.id])).toEqual({
    saved: 0,
    failed: 0,
    denied: false,
  });
  expect(saveImageToGallery).toHaveBeenCalledTimes(2);
});

test("manual selected saves claim results before permission and block duplicate saves and deletion", async () => {
  const store = useUpscaleQueueStore.getState();
  store.addImages(inputs("first", "second"));
  await store.start({ ...DEFAULT_UPSCALE_SETTINGS, autoSave: false });
  await store.runQueueTask();
  const [first, second] = useUpscaleQueueStore.getState().items;
  let grant!: (value: boolean) => void;
  jest.mocked(requestGallerySavePermission).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        grant = resolve;
      }),
  );
  const saving = store.saveItems([second.id]);
  expect(await store.saveItems([second.id])).toEqual({
    saved: 0,
    failed: 0,
    denied: false,
  });
  store.removeItem(second.id);
  store.clear();
  expect(useUpscaleQueueStore.getState().items).toHaveLength(2);
  grant(true);
  expect(await saving).toEqual({ saved: 1, failed: 0, denied: false });
  expect(saveImageToGallery).toHaveBeenCalledWith(second.result!.uri);
  expect(
    useUpscaleQueueStore.getState().items.find((item) => item.id === first.id)
      ?.saved,
  ).toBe(false);
});

test("denied manual saving preserves results for a later permission retry", async () => {
  const store = useUpscaleQueueStore.getState();
  store.addImages(inputs("denied"));
  await store.start({ ...DEFAULT_UPSCALE_SETTINGS, autoSave: false });
  await store.runQueueTask();
  const id = useUpscaleQueueStore.getState().items[0].id;
  jest.mocked(requestGallerySavePermission).mockResolvedValueOnce(false);
  expect(await store.saveItems([id])).toEqual({
    saved: 0,
    failed: 1,
    denied: true,
  });
  expect(useUpscaleQueueStore.getState().items[0]).toMatchObject({
    status: "done",
    saved: false,
    saving: false,
  });
  expect(await store.saveItems([id])).toEqual({
    saved: 1,
    failed: 0,
    denied: false,
  });
});

test("auto-save permission failure leaves the queue idle", async () => {
  const store = useUpscaleQueueStore.getState();
  store.addImages(inputs("permission"));
  jest.mocked(requestGallerySavePermission).mockResolvedValueOnce(false);
  expect(await store.start(DEFAULT_UPSCALE_SETTINGS)).toBe("no-permission");
  expect(useUpscaleQueueStore.getState().running).toBe(false);
  expect(imageUpscaler!.upscale).not.toHaveBeenCalled();
});

test("the auto-save preference is fixed when the batch starts", async () => {
  const settings = { ...DEFAULT_UPSCALE_SETTINGS, autoSave: false };
  const store = useUpscaleQueueStore.getState();
  store.addImages(inputs("snapshot"));
  await store.start(settings);
  settings.autoSave = true;
  await store.runQueueTask();
  expect(saveImageToGallery).not.toHaveBeenCalled();
});

test("scopes previews to the current request and gates background frames without stopping inference", async () => {
  const originalState = AppState.currentState;
  AppState.currentState = "active";
  let changeState!: (state: AppStateStatus) => void;
  const appState = jest
    .spyOn(AppState, "addEventListener")
    .mockImplementation((_name, callback) => {
      changeState = callback;
      return { remove: jest.fn() };
    });
  imageUpscaler!.prepare = jest.fn();
  imageUpscaler!.setPreviewEnabled = jest.fn();
  imageUpscaler!.releasePreviews = jest.fn();
  let complete!: (result: UpscaleResult) => void;
  let entered!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  jest.mocked(imageUpscaler!.upscale).mockImplementationOnce(() => {
    entered();
    return new Promise((resolve) => {
      complete = resolve;
    });
  });
  const store = useUpscaleQueueStore.getState();
  try {
    store.setPreviewVisible(true);
    store.addImages(inputs("live"));
    await store.start({ ...DEFAULT_UPSCALE_SETTINGS, autoSave: false });
    const task = store.runQueueTask();
    await started;
    const id = useUpscaleQueueStore.getState().preview!.requestId;
    expect(imageUpscaler!.prepare).toHaveBeenCalledWith(id, true);
    mockNativeListeners.get("progress")!({ requestId: "old", fraction: 0.9 });
    expect(useUpscaleQueueStore.getState().progress).toBe(0);
    mockNativeListeners.get("progress")!({
      requestId: id,
      phase: "upscaling",
      fraction: 0.5,
      tile: { x: 32, y: 0, width: 32, height: 32 },
    });
    mockNativeListeners.get("preview")!({
      requestId: id,
      sequence: 1,
      imageUri: "file:///frame1.jpg",
    });
    expect(useUpscaleQueueStore.getState().preview).toMatchObject({
      uri: "file:///frame1.jpg",
      tile: { x: 32 },
    });
    mockNativeListeners.get("preview")!({
      requestId: id,
      sequence: 0,
      imageUri: "file:///old.jpg",
    });
    expect(useUpscaleQueueStore.getState().preview!.uri).toBe(
      "file:///frame1.jpg",
    );
    AppState.currentState = "background";
    changeState("background");
    expect(imageUpscaler!.setPreviewEnabled).toHaveBeenLastCalledWith(
      id,
      false,
    );
    mockNativeListeners.get("preview")!({
      requestId: id,
      sequence: 2,
      imageUri: "file:///background.jpg",
    });
    expect(useUpscaleQueueStore.getState().preview!.uri).toBe(
      "file:///frame1.jpg",
    );
    expect(useUpscaleQueueStore.getState().running).toBe(true);
    AppState.currentState = "active";
    changeState("active");
    expect(imageUpscaler!.setPreviewEnabled).toHaveBeenLastCalledWith(id, true);
    mockNativeListeners.get("preview")!({ requestId: id, failed: true });
    expect(useUpscaleQueueStore.getState().preview!.failed).toBe(true);
    mockNativeListeners.get("preview")!({
      requestId: id,
      sequence: 3,
      imageUri: "file:///resumed.jpg",
    });
    expect(useUpscaleQueueStore.getState().preview).toMatchObject({
      uri: "file:///resumed.jpg",
      failed: false,
    });
    complete(defaultResult);
    await task;
    expect(useUpscaleQueueStore.getState().items[0].status).toBe("done");
    mockNativeListeners.get("preview")!({
      requestId: id,
      sequence: 4,
      imageUri: "file:///late.jpg",
    });
    expect(useUpscaleQueueStore.getState().preview!.uri).toBe(
      "file:///resumed.jpg",
    );
  } finally {
    appState.mockRestore();
    AppState.currentState = originalState;
  }
});

test("a result-list persistence error preserves inference output and allows manual gallery saving", async () => {
  jest.mocked(storage.set).mockImplementation(() => {
    throw new Error("metadata unavailable");
  });
  try {
    const store = useUpscaleQueueStore.getState();
    store.addImages(inputs("metadata-error"));
    await store.start({ ...DEFAULT_UPSCALE_SETTINGS, autoSave: false });
    await store.runQueueTask();
    const state = useUpscaleQueueStore.getState();
    expect(state.items[0]).toMatchObject({ status: "done", saved: false });
    expect(state.persistenceError).toContain("앱을 닫기 전에");
    expect(await store.saveItems([state.items[0].id])).toEqual({
      saved: 1,
      failed: 0,
      denied: false,
    });
    expect(imageUpscaler!.upscale).toHaveBeenCalledTimes(1);
  } finally {
    jest.mocked(storage.set).mockImplementation(() => {});
  }
});
