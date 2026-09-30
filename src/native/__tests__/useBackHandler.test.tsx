import { renderHook } from "@testing-library/react-native";
import { BackHandler, Platform } from "react-native";

import {
  usePredictiveBackHandler,
  type PredictiveBackHandlers,
} from "../predictiveBack";
import { useBackHandler } from "../useBackHandler";

let mockPredictiveSupported = false;

jest.mock("../predictiveBack", () => ({
  get PREDICTIVE_BACK_SUPPORTED() {
    return mockPredictiveSupported;
  },
  usePredictiveBackHandler: jest.fn(),
}));

const originalPlatform = Platform.OS;
const listeners: Array<() => boolean | null | undefined> = [];

function pressHardwareBack() {
  for (const listener of [...listeners].reverse()) {
    if (listener()) return true;
  }
  return false;
}

function lastPredictiveHandlers() {
  return jest.mocked(usePredictiveBackHandler).mock.calls.at(-1)! as [
    boolean,
    PredictiveBackHandlers,
  ];
}

beforeEach(() => {
  jest.clearAllMocks();
  Platform.OS = "android";
  mockPredictiveSupported = false;
  listeners.length = 0;
  jest
    .spyOn(BackHandler, "addEventListener")
    .mockImplementation((_event, handler) => {
      const listener = handler as () => boolean | null | undefined;
      listeners.push(listener);
      return {
        remove: () => {
          const index = listeners.indexOf(listener);
          if (index !== -1) listeners.splice(index, 1);
        },
      };
    });
});

afterEach(() => {
  jest.restoreAllMocks();
  Platform.OS = originalPlatform;
});

test("routes predictive back events and commit to the handlers", async () => {
  const handlers = {
    onBack: jest.fn(),
    onStart: jest.fn(),
    onProgress: jest.fn(),
    onCancel: jest.fn(),
  };
  await renderHook(() => useBackHandler(true, handlers));
  const [enabled, predictive] = lastPredictiveHandlers();
  const event = { progress: 0.5, swipeEdge: 0, touchX: 1, touchY: 2 };

  expect(enabled).toBe(true);
  predictive.onStart!(event);
  predictive.onProgress!(event);
  predictive.onCancel!();
  predictive.onCommit!();
  expect(handlers.onStart).toHaveBeenCalledWith(event);
  expect(handlers.onProgress).toHaveBeenCalledWith(event);
  expect(handlers.onCancel).toHaveBeenCalledTimes(1);
  expect(handlers.onBack).toHaveBeenCalledTimes(1);
});

test("falls back to hardware back only while enabled without the native module", async () => {
  const onBack = jest.fn();
  const hook = await renderHook(
    ({ enabled }: { enabled: boolean }) => useBackHandler(enabled, { onBack }),
    { initialProps: { enabled: false } },
  );
  expect(pressHardwareBack()).toBe(false);

  await hook.rerender({ enabled: true });
  expect(pressHardwareBack()).toBe(true);
  expect(onBack).toHaveBeenCalledTimes(1);

  await hook.rerender({ enabled: false });
  expect(pressHardwareBack()).toBe(false);
  expect(onBack).toHaveBeenCalledTimes(1);
});

test("calls the latest onBack without re-registering the listener", async () => {
  const first = jest.fn();
  const second = jest.fn();
  const hook = await renderHook(
    ({ onBack }: { onBack: () => void }) => useBackHandler(true, { onBack }),
    { initialProps: { onBack: first } },
  );
  await hook.rerender({ onBack: second });

  expect(BackHandler.addEventListener).toHaveBeenCalledTimes(1);
  pressHardwareBack();
  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledTimes(1);
});

test.each([
  ["the native module is available", "android", true],
  ["the platform is not Android", "ios", false],
] as const)(
  "skips hardware back when %s",
  async (_label, platform, supported) => {
    Platform.OS = platform;
    mockPredictiveSupported = supported;
    await renderHook(() => useBackHandler(true, { onBack: jest.fn() }));

    expect(BackHandler.addEventListener).not.toHaveBeenCalled();
  },
);
