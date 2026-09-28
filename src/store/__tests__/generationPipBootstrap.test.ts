import { renderHook } from "@testing-library/react-native";
import { act } from "react";

import { generationImagePipeline } from "../../../modules/generation-image-pipeline";
import { setFallbackPredictiveBack, type PredictiveBackHandlers } from "../../native/predictiveBack";
import { useGenerationBootstrap, useGenerationStore } from "../generationStore";

jest.mock("../../../modules/generation-image-pipeline", () => ({
  generationImagePipeline: {
    isPipSupported: jest.fn(() => true),
    setPipState: jest.fn(),
    enterPip: jest.fn(),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));
jest.mock("../../native/predictiveBack", () => ({ setFallbackPredictiveBack: jest.fn() }));
jest.mock("react-native-notify-kit", () => ({
  __esModule: true,
  default: { onForegroundEvent: jest.fn(() => jest.fn()) },
  EventType: { ACTION_PRESS: 1 },
}));
jest.mock("../../lib/storage", () => ({
  storage: { getString: jest.fn(() => undefined), set: jest.fn() },
}));
jest.mock("../../lib/foregroundService", () => ({
  CANCEL_ACTION_ID: "cancel",
  stopGenerationService: jest.fn(),
}));
jest.mock("../../lib/secureToken", () => ({
  getNovelAiToken: jest.fn(() => Promise.resolve(null)),
}));
jest.mock("../../lib/generationHistory", () => ({
  listGenerationPage: jest.fn(() => new Promise(() => {})),
}));
jest.mock("../../lib/i2iReference", () => ({}));
jest.mock("expo-file-system", () => ({ File: jest.fn() }));
jest.mock("../../lib/vibeReferences", () => ({
  listVibeReferences: jest.fn(() => new Promise(() => {})),
}));
jest.mock("../../lib/preciseReferences", () => ({
  listPreciseReferences: jest.fn(() => new Promise(() => {})),
}));

const native = jest.mocked(generationImagePipeline!);
const initialState = useGenerationStore.getState();

beforeEach(() => {
  jest.clearAllMocks();
  useGenerationStore.setState({
    isLoading: false, isFloatingOpen: false, autoPipEnabled: true, backPipEnabled: true,
    requestQueueCancel: jest.fn(),
  });
});
afterEach(() => {
  jest.restoreAllMocks();
  useGenerationStore.setState(initialState, true);
});

function pipActionListener() {
  const call = native.addListener.mock.calls.find(([name]) => name === "pipAction");
  return call![1] as (event: { action: "cancel" }) => void;
}

test("syncs auto-enter with generation and floating state", async () => {
  await renderHook(() => useGenerationBootstrap());
  expect(native.setPipState).toHaveBeenLastCalledWith(false, false);

  await act(() => useGenerationStore.setState({ isLoading: true }));
  expect(native.setPipState).toHaveBeenLastCalledWith(true, true);

  // 큐가 끝나도 플로팅이 열려 있으면 최종 이미지를 PiP로 볼 수 있다.
  await act(() => useGenerationStore.setState({ isFloatingOpen: true, isLoading: false }));
  expect(native.setPipState).toHaveBeenLastCalledWith(true, false);

  await act(() => useGenerationStore.setState({ autoPipEnabled: false }));
  expect(native.setPipState).toHaveBeenLastCalledWith(false, false);
});

test("cancels the queue from the PiP action only while generating", async () => {
  await renderHook(() => useGenerationBootstrap());
  const cancel = useGenerationStore.getState().requestQueueCancel;

  pipActionListener()({ action: "cancel" });
  expect(cancel).not.toHaveBeenCalled();

  useGenerationStore.setState({ isLoading: true });
  pipActionListener()({ action: "cancel" });
  expect(cancel).toHaveBeenCalledTimes(1);
});

function lastFallback() {
  return jest.mocked(setFallbackPredictiveBack).mock.calls.at(-1)![0] as PredictiveBackHandlers | null;
}

test("claims root back for PiP only when there is an image to show", async () => {
  const hook = await renderHook(() => useGenerationBootstrap());
  expect(lastFallback()).toBeNull();

  await act(() => useGenerationStore.setState({ isLoading: true }));
  lastFallback()!.onCommit!();
  expect(native.enterPip).toHaveBeenCalledTimes(1);

  await act(() => useGenerationStore.setState({ backPipEnabled: false }));
  expect(lastFallback()).toBeNull();

  native.isPipSupported.mockReturnValueOnce(false);
  await act(() => useGenerationStore.setState({ backPipEnabled: true }));
  expect(lastFallback()).toBeNull();

  // 큐 종료 후에도 플로팅이 열려 있으면 뒤로가기로 PiP.
  await act(() => useGenerationStore.setState({ isLoading: false, isFloatingOpen: true }));
  expect(lastFallback()).not.toBeNull();

  await hook.unmount();
  expect(lastFallback()).toBeNull();
});
