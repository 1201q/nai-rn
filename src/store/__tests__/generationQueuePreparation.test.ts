import * as ImageManipulator from "expo-image-manipulator";
import { waitFor } from "@testing-library/react-native";

import {
  startGenerationService,
  stopGenerationService,
} from "../../lib/foregroundService";
import { saveGenerationImageBase64 } from "../../lib/generationHistory";
import {
  encodeNovelAiVibe,
  generateNovelAiImageStream,
} from "../../lib/novelai";
import { readPreciseReferenceProcessedBase64 } from "../../lib/preciseReferences";
import {
  canUseCachedVibeEncoding,
  readVibeReferenceImageBase64,
  saveEncodedVibeReference,
} from "../../lib/vibeReferences";
import { useGenerationStore } from "../generationStore";
import {
  acquireGenerationWakeLock,
  releaseGenerationWakeLock,
  waitForGenerationInterval,
} from "../../../modules/generation-wake-lock";

jest.mock("expo-image-manipulator", () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { PNG: "png" },
}));

jest.mock("expo-file-system", () => ({
  File: jest.fn().mockImplementation(() => ({
    base64: jest.fn().mockResolvedValue("i2i-base64"),
  })),
}));

jest.mock("react-native-notify-kit", () => ({
  __esModule: true,
  default: {
    onForegroundEvent: jest.fn(() => jest.fn()),
  },
  EventType: { ACTION_PRESS: 1 },
}));

jest.mock("../../lib/storage", () => ({
  storage: {
    getString: jest.fn(() => undefined),
    set: jest.fn(),
  },
}));

jest.mock("../../lib/generationHistory", () => ({
  deleteGenerations: jest.fn(),
  listGenerationPage: jest.fn(),
  saveGenerationImageBase64: jest.fn(),
}));

jest.mock("../../lib/foregroundService", () => ({
  CANCEL_ACTION_ID: "cancel",
  startGenerationService: jest.fn(),
  stopGenerationService: jest.fn(),
  updateGenerationProgress: jest.fn(),
}));

jest.mock("../../../modules/generation-wake-lock", () => ({
  acquireGenerationWakeLock: jest.fn(),
  releaseGenerationWakeLock: jest.fn(),
  waitForGenerationInterval: jest.fn(),
}));

jest.mock("../../lib/novelai", () => ({
  encodeNovelAiVibe: jest.fn(),
  generateNovelAiImageStream: jest.fn(),
  getNovelAiAnlasBalance: jest.fn(),
}));

jest.mock("../../lib/secureToken", () => ({
  getNovelAiToken: jest.fn(),
  saveNovelAiToken: jest.fn(),
}));

jest.mock("../../lib/i2iReference", () => ({
  deleteStoredI2IReference: jest.fn(),
  resolveStoredI2IReference: jest.fn(),
  saveI2IReferenceImage: jest.fn(),
}));

jest.mock("../../lib/vibeReferences", () => ({
  MAX_VIBE_REFERENCES: 16,
  addVibeReferenceFromImage: jest.fn(),
  canUseCachedVibeEncoding: jest.fn(),
  deleteVibeReference: jest.fn(),
  listVibeReferences: jest.fn(),
  readEncodedVibeReferenceBase64: jest.fn(),
  readVibeReferenceImageBase64: jest.fn(),
  replaceVibeReferenceImage: jest.fn(),
  saveEncodedVibeReference: jest.fn(),
  updateVibeReferenceSettings: jest.fn(),
  updateVibeReferencesEnabled: jest.fn(),
}));

jest.mock("../../lib/preciseReferences", () => ({
  MAX_PRECISE_REFERENCES: 16,
  addPreciseReferenceFromImage: jest.fn(),
  deletePreciseReference: jest.fn(),
  listPreciseReferences: jest.fn(),
  readPreciseReferenceProcessedBase64: jest.fn(),
  replacePreciseReferenceImage: jest.fn(),
  updatePreciseReferenceSettings: jest.fn(),
  updatePreciseReferencesEnabled: jest.fn(),
}));

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

const initialState = useGenerationStore.getInitialState();
const mockManipulateAsync = jest.mocked(ImageManipulator.manipulateAsync);
const mockStartGenerationService = jest.mocked(startGenerationService);
const mockStopGenerationService = jest.mocked(stopGenerationService);
const mockSaveGenerationImageBase64 = jest.mocked(
  saveGenerationImageBase64,
);
const mockEncodeNovelAiVibe = jest.mocked(encodeNovelAiVibe);
const mockGenerateNovelAiImageStream = jest.mocked(
  generateNovelAiImageStream,
);
const mockAcquireGenerationWakeLock = jest.mocked(
  acquireGenerationWakeLock,
);
const mockReleaseGenerationWakeLock = jest.mocked(
  releaseGenerationWakeLock,
);
const mockWaitForGenerationInterval = jest.mocked(
  waitForGenerationInterval,
);
const mockCanUseCachedVibeEncoding = jest.mocked(canUseCachedVibeEncoding);
const mockReadVibeReferenceImageBase64 = jest.mocked(
  readVibeReferenceImageBase64,
);
const mockSaveEncodedVibeReference = jest.mocked(saveEncodedVibeReference);
const mockReadPreciseReferenceProcessedBase64 = jest.mocked(
  readPreciseReferenceProcessedBase64,
);

function setReadyState() {
  useGenerationStore.setState(
    {
      ...initialState,
      storedToken: "token",
      prompt: "prompt",
      negativePrompt: "",
      isLoading: false,
      queueCancelRequested: false,
      vibeReferences: [],
      preciseReferences: [],
      i2iEnabled: false,
      i2iSourceImage: null,
    },
    true,
  );
}

async function cleanPendingQueue() {
  if (!useGenerationStore.getState().isLoading) return;
  useGenerationStore.getState().requestQueueCancel();
  await useGenerationStore.getState().runQueueTask();
}

describe("generation queue preparation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setReadyState();
    mockStartGenerationService.mockResolvedValue(true);
    mockCanUseCachedVibeEncoding.mockReturnValue(false);
    mockReadVibeReferenceImageBase64.mockResolvedValue("vibe-image");
    mockSaveEncodedVibeReference.mockResolvedValue(null);
  });

  afterEach(async () => {
    await cleanPendingQueue();
    useGenerationStore.setState(initialState, true);
  });

  test("blocks a second request while I2I preparation is pending", async () => {
    const manipulation =
      createDeferred<Awaited<ReturnType<typeof ImageManipulator.manipulateAsync>>>();
    mockManipulateAsync.mockReturnValue(manipulation.promise);
    useGenerationStore.setState({
      i2iEnabled: true,
      i2iSourceImage: {
        uri: "file:///source.png",
        storagePath: "source.png",
        width: 1024,
        height: 1024,
      },
    });

    const firstRequest = useGenerationStore.getState().generateImage();
    const secondRequest = useGenerationStore.getState().generateImage();
    const loadingDuringPreparation =
      useGenerationStore.getState().isLoading;

    manipulation.resolve({
      uri: "file:///resized.png",
      width: 1024,
      height: 1024,
    });
    const [firstResult, secondResult] = await Promise.all([
      firstRequest,
      secondRequest,
    ]);

    expect(loadingDuringPreparation).toBe(true);
    expect(firstResult).toEqual({ status: "started" });
    expect(secondResult).toEqual({ status: "rejected", reason: "busy" });
    expect(mockManipulateAsync).toHaveBeenCalledTimes(1);
    expect(mockStartGenerationService).toHaveBeenCalledTimes(1);
  });

  test("blocks a second request while Precise preparation is pending", async () => {
    const preciseRead = createDeferred<string>();
    mockReadPreciseReferenceProcessedBase64.mockReturnValue(
      preciseRead.promise,
    );
    useGenerationStore.setState({
      preciseReferences: [
        {
          id: "precise-1",
          imagePath: "image.jpg",
          thumbnailPath: null,
          processedPath: "processed.jpg",
          enabled: true,
          strength: 0.6,
          fidelity: 0.6,
          referenceType: "character&style",
          sourceWidth: 1024,
          sourceHeight: 1024,
          processedWidth: 1024,
          processedHeight: 1024,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });

    const firstRequest = useGenerationStore.getState().generateImage();
    const secondRequest = useGenerationStore.getState().generateImage();

    preciseRead.resolve("precise-base64");
    await Promise.all([firstRequest, secondRequest]);

    expect(mockReadPreciseReferenceProcessedBase64).toHaveBeenCalledTimes(1);
    expect(mockStartGenerationService).toHaveBeenCalledTimes(1);
  });

  test("releases the preparation lock after an I2I failure", async () => {
    mockManipulateAsync.mockRejectedValueOnce(new Error("resize failed"));
    useGenerationStore.setState({
      i2iEnabled: true,
      i2iSourceImage: {
        uri: "file:///source.png",
        storagePath: "source.png",
        width: 1024,
        height: 1024,
      },
    });

    const failedResult = await useGenerationStore.getState().generateImage();

    expect(failedResult).toEqual({
      status: "rejected",
      reason: "preparation",
    });
    expect(useGenerationStore.getState().isLoading).toBe(false);
    expect(useGenerationStore.getState().message).toBe(
      "I2I 이미지를 읽지 못했습니다.",
    );

    useGenerationStore.setState({ i2iEnabled: false });
    const retryResult = await useGenerationStore.getState().generateImage();

    expect(retryResult).toEqual({ status: "started" });
    expect(mockStartGenerationService).toHaveBeenCalledTimes(1);
  });

  test("does not start a queue after cancelling Vibe preparation", async () => {
    const vibeEncoding = createDeferred<string>();
    mockEncodeNovelAiVibe.mockReturnValue(vibeEncoding.promise);
    useGenerationStore.setState({
      vibeReferences: [
        {
          id: "vibe-1",
          imagePath: "image.jpg",
          thumbnailPath: null,
          encodedPath: null,
          enabled: true,
          strength: 0.6,
          informationExtracted: 0.7,
          encodedInformationExtracted: null,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });

    const request = useGenerationStore.getState().generateImage();
    await Promise.resolve();
    useGenerationStore.getState().requestQueueCancel();
    vibeEncoding.resolve("encoded-vibe");
    const result = await request;

    expect(result).toEqual({ status: "rejected", reason: "cancelled" });
    expect(mockEncodeNovelAiVibe).toHaveBeenCalledTimes(1);
    expect(mockSaveEncodedVibeReference).not.toHaveBeenCalled();
    expect(mockStartGenerationService).not.toHaveBeenCalled();
    expect(useGenerationStore.getState().isLoading).toBe(false);
    expect(useGenerationStore.getState().queueCancelRequested).toBe(false);
  });
});

describe("generation queue execution", () => {
  const generation = {
    id: "generation-1",
    imagePath: "generation.png",
    thumbnailPath: null,
    prompt: "prompt",
    negativePrompt: "",
    model: "nai-diffusion-4-5-full",
    sampler: "k_euler_ancestral",
    noiseSchedule: "karras" as const,
    width: 1024,
    height: 1024,
    steps: 28,
    scale: 5,
    cfgRescale: 0,
    seed: 123,
    createdAt: 1,
    metadataJson: "{}",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    setReadyState();
    mockStartGenerationService.mockResolvedValue(true);
    mockGenerateNovelAiImageStream.mockResolvedValue({
      imageBase64: "generated-image",
      seed: 123,
    });
    mockSaveGenerationImageBase64.mockResolvedValue(generation);
    mockWaitForGenerationInterval.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await cleanPendingQueue();
    useGenerationStore.setState(initialState, true);
  });

  test("hands the queue to the foreground service before execution", async () => {
    const result = await useGenerationStore.getState().generateImage();

    expect(result).toEqual({ status: "started" });
    expect(mockStartGenerationService).toHaveBeenCalledTimes(1);
    expect(mockGenerateNovelAiImageStream).not.toHaveBeenCalled();
    expect(useGenerationStore.getState().isLoading).toBe(true);

    await useGenerationStore.getState().runQueueTask();

    expect(mockGenerateNovelAiImageStream).toHaveBeenCalledTimes(1);
  });

  test("rejects invalid requests without starting a queue", async () => {
    useGenerationStore.setState({ storedToken: null });
    const missingTokenResult =
      await useGenerationStore.getState().generateImage();

    useGenerationStore.setState({ storedToken: "token", prompt: "   " });
    const emptyPromptResult =
      await useGenerationStore.getState().generateImage();

    expect(missingTokenResult).toEqual({
      status: "rejected",
      reason: "validation",
    });
    expect(emptyPromptResult).toEqual({
      status: "rejected",
      reason: "validation",
    });
    expect(mockStartGenerationService).not.toHaveBeenCalled();
    expect(useGenerationStore.getState().isLoading).toBe(false);
  });

  test("cleans queue state and resources after successful execution", async () => {
    const onSuccess = jest.fn();

    await useGenerationStore.getState().generateImage(onSuccess);
    await useGenerationStore.getState().runQueueTask();

    expect(mockSaveGenerationImageBase64).toHaveBeenCalledTimes(1);
    expect(useGenerationStore.getState().currentGeneration).toEqual(generation);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(mockAcquireGenerationWakeLock).toHaveBeenCalledTimes(1);
    expect(mockReleaseGenerationWakeLock).toHaveBeenCalledTimes(1);
    expect(mockStopGenerationService).toHaveBeenCalledTimes(1);
    expect(useGenerationStore.getState()).toMatchObject({
      isLoading: false,
      queueTotal: 0,
      queueIndex: 0,
      queueSteps: 0,
      queueCancelRequested: false,
      streamingPreviewUri: null,
      streamingStep: null,
      streamingGenerationId: null,
    });
  });

  test("releases queue resources after an error and allows retry", async () => {
    const onSuccess = jest.fn();
    mockGenerateNovelAiImageStream.mockRejectedValueOnce(
      new Error("generation failed"),
    );

    await useGenerationStore.getState().generateImage(onSuccess);
    await useGenerationStore.getState().runQueueTask();

    expect(useGenerationStore.getState().message).toBe("generation failed");
    expect(useGenerationStore.getState().isLoading).toBe(false);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(mockReleaseGenerationWakeLock).toHaveBeenCalledTimes(1);
    expect(mockStopGenerationService).toHaveBeenCalledTimes(1);

    await useGenerationStore.getState().generateImage(onSuccess);
    await useGenerationStore.getState().runQueueTask();

    expect(mockGenerateNovelAiImageStream).toHaveBeenCalledTimes(2);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  test("stops a batch after cancellation without calling onSuccess", async () => {
    const onSuccess = jest.fn();
    useGenerationStore.setState({ batchCount: 2 });
    mockWaitForGenerationInterval.mockImplementationOnce(async () => {
      useGenerationStore.getState().requestQueueCancel();
    });

    await useGenerationStore.getState().generateImage(onSuccess);
    await useGenerationStore.getState().runQueueTask();

    expect(mockGenerateNovelAiImageStream).toHaveBeenCalledTimes(1);
    expect(mockSaveGenerationImageBase64).toHaveBeenCalledTimes(1);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(mockReleaseGenerationWakeLock).toHaveBeenCalledTimes(1);
    expect(mockStopGenerationService).toHaveBeenCalledTimes(1);
    expect(useGenerationStore.getState()).toMatchObject({
      isLoading: false,
      queueTotal: 0,
      queueCancelRequested: false,
    });
  });

  test("runs the queue directly when foreground service is unavailable", async () => {
    mockStartGenerationService.mockResolvedValue(false);

    const result = await useGenerationStore.getState().generateImage();

    expect(result).toEqual({ status: "started" });
    await waitFor(() => {
      expect(mockGenerateNovelAiImageStream).toHaveBeenCalledTimes(1);
      expect(mockSaveGenerationImageBase64).toHaveBeenCalledTimes(1);
      expect(useGenerationStore.getState().isLoading).toBe(false);
    });
  });
});
