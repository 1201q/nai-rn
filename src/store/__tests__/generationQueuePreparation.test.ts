import * as ImageManipulator from "expo-image-manipulator";

import { startGenerationService } from "../../lib/foregroundService";
import { encodeNovelAiVibe } from "../../lib/novelai";
import { readPreciseReferenceProcessedBase64 } from "../../lib/preciseReferences";
import {
  canUseCachedVibeEncoding,
  readVibeReferenceImageBase64,
  saveEncodedVibeReference,
} from "../../lib/vibeReferences";
import { useGenerationStore } from "../generationStore";

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
const mockEncodeNovelAiVibe = jest.mocked(encodeNovelAiVibe);
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
    await Promise.all([firstRequest, secondRequest]);

    expect(loadingDuringPreparation).toBe(true);
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

    await useGenerationStore.getState().generateImage();

    expect(useGenerationStore.getState().isLoading).toBe(false);
    expect(useGenerationStore.getState().message).toBe(
      "I2I 이미지를 읽지 못했습니다.",
    );

    useGenerationStore.setState({ i2iEnabled: false });
    await useGenerationStore.getState().generateImage();

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
    await request;

    expect(mockEncodeNovelAiVibe).toHaveBeenCalledTimes(1);
    expect(mockSaveEncodedVibeReference).not.toHaveBeenCalled();
    expect(mockStartGenerationService).not.toHaveBeenCalled();
    expect(useGenerationStore.getState().isLoading).toBe(false);
    expect(useGenerationStore.getState().queueCancelRequested).toBe(false);
  });
});
