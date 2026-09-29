import { waitFor } from "@testing-library/react-native";

import {
  updatePreciseReferenceSettings,
  type PreciseReference,
} from "../../lib/preciseReferences";
import {
  updateVibeReferenceSettings,
  type VibeReference,
} from "../../lib/vibeReferences";
import { useGenerationStore } from "../generationStore";

jest.mock("react-native-notify-kit", () => ({
  __esModule: true,
  default: { onForegroundEvent: jest.fn(() => jest.fn()) },
  EventType: { ACTION_PRESS: 1 },
}));
jest.mock("../../lib/storage", () => ({
  storage: { getString: jest.fn(() => undefined), set: jest.fn() },
}));
jest.mock("../../lib/generationHistory", () => ({
  deleteGenerations: jest.fn(),
  listGenerationPage: jest.fn(),
  listGenerationIds: jest.fn(),
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
jest.mock("../../lib/secureToken", () => ({
  getNovelAiToken: jest.fn(),
  saveNovelAiToken: jest.fn(),
}));
jest.mock("../../lib/i2iReference", () => ({
  deleteStoredI2IReference: jest.fn(),
  renderI2IRequestImageBase64: jest.fn(),
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
}));
jest.mock("../../lib/preciseReferences", () => ({
  MAX_PRECISE_REFERENCES: 16,
  addPreciseReferenceFromImage: jest.fn(),
  deletePreciseReference: jest.fn(),
  listPreciseReferences: jest.fn(),
  readPreciseReferenceProcessedBase64: jest.fn(),
  replacePreciseReferenceImage: jest.fn(),
  updatePreciseReferenceSettings: jest.fn(),
}));

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

const mockUpdateVibe = jest.mocked(updateVibeReferenceSettings);
const mockUpdatePrecise = jest.mocked(updatePreciseReferenceSettings);
const initialState = useGenerationStore.getInitialState();

const VIBE: VibeReference = {
  id: "vibe",
  imagePath: "vibes/originals/vibe.png",
  thumbnailPath: null,
  enabled: false,
  strength: 0.6,
  informationExtracted: 0.7,
  encodings: [
    {
      model: "nai-diffusion-4-5-full",
      informationExtracted: 0.7,
      path: "vibes/encoded/vibe.bin",
    },
  ],
  createdAt: 1,
  updatedAt: 1,
};

const PRECISE: PreciseReference = {
  id: "precise",
  imagePath: "precise/originals/precise.png",
  thumbnailPath: null,
  processedPath: "precise/processed/precise.jpg",
  enabled: false,
  strength: 0.6,
  fidelity: 0.6,
  referenceType: "character&style",
  sourceWidth: 832,
  sourceHeight: 1216,
  processedWidth: 1024,
  processedHeight: 1536,
  createdAt: 1,
  updatedAt: 1,
};

type SetterCase = {
  name: string;
  list: "vibeReferences" | "preciseReferences";
  persist: jest.Mock;
  call: (value: number) => void;
  value: (next: number) => unknown;
  patch: (next: number) => Record<string, unknown>;
  read: (reference: VibeReference | PreciseReference) => unknown;
};

const state = () => useGenerationStore.getState();

const SETTERS: SetterCase[] = [
  {
    name: "setVibeReferenceEnabled",
    list: "vibeReferences",
    persist: mockUpdateVibe,
    call: (next) => state().setVibeReferenceEnabled("vibe", next > 0),
    value: (next) => next > 0,
    patch: (next) => ({ enabled: next > 0 }),
    read: (reference) => reference.enabled,
  },
  {
    name: "setVibeReferenceStrength",
    list: "vibeReferences",
    persist: mockUpdateVibe,
    call: (next) => state().setVibeReferenceStrength("vibe", next),
    value: (next) => next,
    patch: (next) => ({ strength: next }),
    read: (reference) => reference.strength,
  },
  {
    name: "setVibeReferenceInformationExtracted",
    list: "vibeReferences",
    persist: mockUpdateVibe,
    call: (next) => state().setVibeReferenceInformationExtracted("vibe", next),
    value: (next) => next,
    patch: (next) => ({ informationExtracted: next }),
    read: (reference) => (reference as VibeReference).informationExtracted,
  },
  {
    name: "setPreciseReferenceEnabled",
    list: "preciseReferences",
    persist: mockUpdatePrecise,
    call: (next) => state().setPreciseReferenceEnabled("precise", next > 0),
    value: (next) => next > 0,
    patch: (next) => ({ enabled: next > 0 }),
    read: (reference) => reference.enabled,
  },
  {
    name: "setPreciseReferenceStrength",
    list: "preciseReferences",
    persist: mockUpdatePrecise,
    call: (next) => state().setPreciseReferenceStrength("precise", next),
    value: (next) => next,
    patch: (next) => ({ strength: next }),
    read: (reference) => reference.strength,
  },
  {
    name: "setPreciseReferenceFidelity",
    list: "preciseReferences",
    persist: mockUpdatePrecise,
    call: (next) => state().setPreciseReferenceFidelity("precise", next),
    value: (next) => next,
    patch: (next) => ({ fidelity: next }),
    read: (reference) => (reference as PreciseReference).fidelity,
  },
  {
    name: "setPreciseReferenceType",
    list: "preciseReferences",
    persist: mockUpdatePrecise,
    call: (next) =>
      state().setPreciseReferenceType(
        "precise",
        next > 0 ? "style" : "character",
      ),
    value: (next) => (next > 0 ? "style" : "character"),
    patch: (next) => ({ referenceType: next > 0 ? "style" : "character" }),
    read: (reference) => (reference as PreciseReference).referenceType,
  },
];

function current(list: SetterCase["list"]) {
  return state()[list][0];
}

beforeEach(() => {
  jest.clearAllMocks();
  useGenerationStore.setState(
    {
      ...initialState,
      model: "nai-diffusion-4-5-full",
      vibeReferences: [VIBE],
      preciseReferences: [PRECISE],
      message: null,
    },
    true,
  );
});

describe.each(SETTERS)("$name", (setter) => {
  it("applies the change optimistically and persists the same patch", () => {
    setter.persist.mockReturnValue(new Promise(() => {}));

    setter.call(1);

    expect(setter.read(current(setter.list))).toEqual(setter.value(1));
    expect(setter.persist).toHaveBeenCalledWith(
      setter.list === "vibeReferences" ? "vibe" : "precise",
      setter.patch(1),
    );
  });

  it("replaces the item with the persisted record", async () => {
    const base = setter.list === "vibeReferences" ? VIBE : PRECISE;
    const persisted = { ...base, updatedAt: 99 };
    setter.persist.mockResolvedValue(persisted);

    setter.call(1);

    await waitFor(() => expect(current(setter.list)).toBe(persisted));
  });

  it("ignores a persisted record from a superseded change", async () => {
    const base = setter.list === "vibeReferences" ? VIBE : PRECISE;
    const first = createDeferred<unknown>();
    const second = createDeferred<unknown>();
    setter.persist
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    setter.call(1);
    setter.call(0);
    const latest = { ...base, updatedAt: 2 };
    second.resolve(latest);
    await waitFor(() => expect(current(setter.list)).toBe(latest));

    first.resolve({ ...base, updatedAt: 1_000 });
    await Promise.resolve();
    await Promise.resolve();
    expect(current(setter.list)).toBe(latest);
  });

  it("reports a failure only for the latest change", async () => {
    const first = createDeferred<unknown>();
    const second = createDeferred<unknown>();
    setter.persist
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    setter.call(1);
    setter.call(0);
    first.reject(new Error("stale failure"));
    await Promise.resolve();
    await Promise.resolve();
    expect(state().message).toBeNull();

    second.reject(new Error("latest failure"));
    await waitFor(() => expect(state().message).toBe("latest failure"));
  });

  it("keeps the optimistic value when nothing was persisted", async () => {
    setter.persist.mockResolvedValue(null);

    setter.call(1);
    await Promise.resolve();
    await Promise.resolve();

    expect(setter.read(current(setter.list))).toEqual(setter.value(1));
  });
});

it("clears cached encodings when Information Extracted changes", () => {
  mockUpdateVibe.mockReturnValue(new Promise(() => {}));

  state().setVibeReferenceInformationExtracted("vibe", 0.5);

  expect(current("vibeReferences")).toMatchObject({
    informationExtracted: 0.5,
    encodings: [],
  });
});

it("stringifies non-Error failures", async () => {
  mockUpdateVibe.mockRejectedValue("disk full");

  state().setVibeReferenceStrength("vibe", 0.3);

  await waitFor(() => expect(state().message).toBe("disk full"));
});

it("blocks enabling Vibe while a Precise Reference is enabled", () => {
  useGenerationStore.setState({
    preciseReferences: [{ ...PRECISE, enabled: true }],
  });

  state().setVibeReferenceEnabled("vibe", true);

  expect(state().message).toBe(
    "Precise Reference와 Vibe Transfer는 함께 사용할 수 없습니다.",
  );
  expect(current("vibeReferences").enabled).toBe(false);
  expect(mockUpdateVibe).not.toHaveBeenCalled();
});

it("blocks enabling Precise while a Vibe is enabled", () => {
  useGenerationStore.setState({
    vibeReferences: [{ ...VIBE, enabled: true }],
  });

  state().setPreciseReferenceEnabled("precise", true);

  expect(state().message).toBe(
    "Precise Reference와 Vibe Transfer는 함께 사용할 수 없습니다.",
  );
  expect(current("preciseReferences").enabled).toBe(false);
  expect(mockUpdatePrecise).not.toHaveBeenCalled();
});

it("blocks enabling Precise on models without Precise support", () => {
  useGenerationStore.setState({ model: "nai-diffusion-3" });

  state().setPreciseReferenceEnabled("precise", true);

  expect(state().message).toBe(
    "Precise Reference는 V4.5 모델에서 사용할 수 있습니다.",
  );
  expect(mockUpdatePrecise).not.toHaveBeenCalled();
});

it("allows disabling references regardless of conflicts", () => {
  useGenerationStore.setState({
    model: "nai-diffusion-3",
    vibeReferences: [{ ...VIBE, enabled: true }],
    preciseReferences: [{ ...PRECISE, enabled: true }],
  });
  mockUpdateVibe.mockReturnValue(new Promise(() => {}));
  mockUpdatePrecise.mockReturnValue(new Promise(() => {}));

  state().setVibeReferenceEnabled("vibe", false);
  state().setPreciseReferenceEnabled("precise", false);

  expect(current("vibeReferences").enabled).toBe(false);
  expect(current("preciseReferences").enabled).toBe(false);
});
