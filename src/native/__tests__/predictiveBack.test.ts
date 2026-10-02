import type { PredictiveBackEvent } from "../predictiveBack";

type Listener = (event?: PredictiveBackEvent) => void;

const mockListeners = new Map<string, Listener>();
const mockNativeModule = {
  progressAvailable: true,
  setMode: jest.fn(),
  addListener: jest.fn((eventName: string, listener: Listener) => {
    mockListeners.set(eventName, listener);
    return { remove: jest.fn() };
  }),
};

jest.mock("expo-modules-core", () => ({
  ...jest.requireActual("expo-modules-core"),
  requireOptionalNativeModule: (name: string) =>
    name === "PredictiveBack" ? mockNativeModule : null,
}));

const EVENT: PredictiveBackEvent = {
  progress: 0.4,
  swipeEdge: 0,
  touchX: 10,
  touchY: 20,
};

function loadModule() {
  let loaded!: typeof import("../predictiveBack");
  jest.isolateModules(() => {
    require("react-native").Platform.OS = "android";
    loaded = require("../predictiveBack");
  });
  return loaded;
}

function emit(eventName: string, event?: PredictiveBackEvent) {
  mockListeners.get(eventName)!(event);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockListeners.clear();
});

test("exposes support flags from the native module", () => {
  const predictiveBack = loadModule();
  expect(predictiveBack.PREDICTIVE_BACK_SUPPORTED).toBe(true);
  expect(predictiveBack.PREDICTIVE_BACK_HAS_PROGRESS).toBe(true);
});

test("switches to app mode while an owner holds back and restores system mode", () => {
  const predictiveBack = loadModule();
  predictiveBack.initializePredictiveBack();
  expect(mockNativeModule.setMode).toHaveBeenLastCalledWith("system");

  const token = {};
  predictiveBack.acquirePredictiveBack(token, {});
  expect(mockNativeModule.setMode).toHaveBeenLastCalledWith("app");

  predictiveBack.releasePredictiveBack(token);
  expect(mockNativeModule.setMode).toHaveBeenLastCalledWith("system");
  expect(mockNativeModule.addListener).toHaveBeenCalledTimes(4);
});

test("routes native events to the latest owner and to observers", () => {
  const predictiveBack = loadModule();
  const first = { onCommit: jest.fn() };
  const latest = {
    onStart: jest.fn(),
    onProgress: jest.fn(),
    onCancel: jest.fn(),
    onCommit: jest.fn(),
  };
  const observer = { onProgress: jest.fn(), onCommit: jest.fn() };
  const firstToken = {};
  const latestToken = {};
  predictiveBack.acquirePredictiveBack(firstToken, first);
  predictiveBack.acquirePredictiveBack(latestToken, latest);
  const stopObserving = predictiveBack.observePredictiveBack(observer);

  emit("predictiveBackStart", EVENT);
  emit("predictiveBackProgress", EVENT);
  emit("predictiveBackCancel");
  emit("predictiveBackCommit");
  expect(latest.onStart).toHaveBeenCalledWith(EVENT);
  expect(latest.onProgress).toHaveBeenCalledWith(EVENT);
  expect(latest.onCancel).toHaveBeenCalledTimes(1);
  expect(latest.onCommit).toHaveBeenCalledTimes(1);
  expect(first.onCommit).not.toHaveBeenCalled();
  expect(observer.onProgress).toHaveBeenCalledWith(EVENT);
  expect(observer.onCommit).toHaveBeenCalledTimes(1);

  predictiveBack.releasePredictiveBack(latestToken);
  stopObserving();
  emit("predictiveBackCommit");
  expect(first.onCommit).toHaveBeenCalledTimes(1);
  expect(observer.onCommit).toHaveBeenCalledTimes(1);
});

test("delivers only commits while the preview is turned off", () => {
  const predictiveBack = loadModule();
  const owner = {
    onStart: jest.fn(),
    onProgress: jest.fn(),
    onCancel: jest.fn(),
    onCommit: jest.fn(),
  };
  const observer = { onProgress: jest.fn(), onCommit: jest.fn() };
  predictiveBack.acquirePredictiveBack({}, owner);
  predictiveBack.observePredictiveBack(observer);
  predictiveBack.setPredictiveBackPreviewEnabled(false);

  emit("predictiveBackStart", EVENT);
  emit("predictiveBackProgress", EVENT);
  emit("predictiveBackCancel");
  emit("predictiveBackCommit");
  expect(owner.onStart).not.toHaveBeenCalled();
  expect(owner.onProgress).not.toHaveBeenCalled();
  expect(owner.onCancel).not.toHaveBeenCalled();
  expect(observer.onProgress).not.toHaveBeenCalled();
  expect(owner.onCommit).toHaveBeenCalledTimes(1);
  expect(observer.onCommit).toHaveBeenCalledTimes(1);

  predictiveBack.setPredictiveBackPreviewEnabled(true);
  emit("predictiveBackStart", EVENT);
  expect(owner.onStart).toHaveBeenCalledWith(EVENT);
});

test("re-acquiring moves an owner back to the top", () => {
  const predictiveBack = loadModule();
  const a = { onCommit: jest.fn() };
  const b = { onCommit: jest.fn() };
  const tokenA = {};
  predictiveBack.acquirePredictiveBack(tokenA, a);
  predictiveBack.acquirePredictiveBack({}, b);
  predictiveBack.acquirePredictiveBack(tokenA, a);

  emit("predictiveBackCommit");
  expect(a.onCommit).toHaveBeenCalledTimes(1);
  expect(b.onCommit).not.toHaveBeenCalled();
});
