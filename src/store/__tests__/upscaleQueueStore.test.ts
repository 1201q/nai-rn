import { imageUpscaler } from "../../../modules/image-upscaler";
import { saveImageToGallery } from "../../lib/gallery";
import { DEFAULT_UPSCALE_SETTINGS } from "../../screens/upscale/upscaleOptions";
import { useUpscaleQueueStore } from "../upscaleQueueStore";

jest.mock("expo-file-system", () => ({
  Paths: { cache: "file:///cache" },
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
  })),
}));
jest.mock("../../../modules/image-upscaler", () => ({
  imageUpscaler: {
    upscale: jest.fn(),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
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

beforeEach(() => {
  jest.clearAllMocks();
  useUpscaleQueueStore.setState({
    items: [],
    running: false,
    stopRequested: false,
  });
  jest.mocked(imageUpscaler!.upscale).mockResolvedValue({
    uri: "file:///output.jpg",
    width: 200,
    height: 200,
    bytes: 100,
    elapsedMs: 20,
    usedGpu: true,
    tileSize: 100,
    cpuThreads: 0,
    cpuPolicy: 0,
  });
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
    expect(saveImageToGallery).toHaveBeenCalledWith("file:///output.jpg");
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
