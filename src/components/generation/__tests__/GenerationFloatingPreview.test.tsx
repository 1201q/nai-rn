import { fireEvent, render } from "@testing-library/react-native";
import { Platform } from "react-native";
import { router } from "expo-router";

import { GenerationFloatingPreview } from "../GenerationFloatingPreview";
import { getCanvasImageRect, reportPipSourceRect } from "../../../lib/pipLayout";

jest.mock("../../../../modules/generation-image-pipeline", () => ({
  ...jest.requireActual("../../../../modules/generation-image-pipeline"),
  generationImagePipeline: { retainPreviews: jest.fn() },
  releaseNativePreviews: jest.fn(),
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("expo-image", () => {
  const { View } = require("react-native") as typeof import("react-native");
  return { Image: (props: object) => <View {...props} testID="floating-image" /> };
});
jest.mock("expo-router", () => ({
  router: { canDismiss: jest.fn(() => false), dismissAll: jest.fn() },
}));
jest.mock("react-native-gesture-handler", () => {
  function gesture() {
    return {
      minDistance: jest.fn().mockReturnThis(),
      onBegin: jest.fn().mockReturnThis(),
      onUpdate: jest.fn().mockReturnThis(),
      onEnd: jest.fn().mockReturnThis(),
    };
  }
  return {
    Gesture: { Pan: gesture, Tap: gesture, Race: jest.fn() },
    GestureDetector: ({ children }: { children: React.ReactNode }) => children,
  };
});
jest.mock("react-native-reanimated", () => {
  const React = require("react") as typeof import("react");
  const { Easing, View } = require("react-native") as typeof import("react-native");
  // 애니메이션은 즉시 끝난 것으로 처리한다.
  const animate = (value: number, _config?: object, done?: (finished: boolean) => void) => {
    done?.(true);
    return value;
  };
  return {
    __esModule: true,
    default: { View },
    Easing,
    runOnJS: (fn: (...args: unknown[]) => unknown) => fn,
    useSharedValue: <T,>(value: T) => React.useRef({ value }).current,
    useAnimatedStyle: (factory: () => object) => factory(),
    withTiming: animate,
    withSpring: animate,
  };
});
jest.mock("../../../hooks/usePipBackScale", () => ({ usePipBackScale: () => ({ value: 1 }) }));
jest.mock("../../../hooks/useGenerationChromeMetrics", () => ({
  useGenerationChromeMetrics: () => ({ topInset: 24, promptCollapsedHeight: 128 }),
}));
jest.mock("../../../lib/pipLayout", () => ({
  getCanvasImageRect: jest.fn(() => null),
  reportPipSourceRect: jest.fn(),
}));
jest.mock("../../../lib/generationHistory", () => ({
  resolveGenerationImageUri: ({ imagePath }: { imagePath: string }) => `file:///${imagePath}`,
}));
const mockState = {
  isFloatingOpen: true,
  isLoading: true,
  streamingPreviewUri: "file:///cache/nai-stream-previews/gen_test/0.jpg" as string | null,
  queueIndex: 1,
  resolution: { width: 800, height: 1200 },
  generationHistory: [] as { imagePath: string; width: number; height: number }[],
  setFloatingOpen: jest.fn(),
  requestQueueCancel: jest.fn(),
};
jest.mock("../../../store/generationStore", () => ({
  useGenerationStore: (selector: (state: object) => unknown) => selector(mockState),
}));

const originalOS = Platform.OS;
beforeEach(() => {
  jest.clearAllMocks();
  Platform.OS = "android";
  Object.assign(mockState, {
    isFloatingOpen: true,
    isLoading: true,
    streamingPreviewUri: "file:///cache/nai-stream-previews/gen_test/0.jpg",
    queueIndex: 1,
    generationHistory: [],
  });
});
afterEach(() => { Platform.OS = originalOS; });

test("renders nothing while closed or outside Android", async () => {
  mockState.isFloatingOpen = false;
  const closed = await render(<GenerationFloatingPreview />);
  expect(closed.toJSON()).toBeNull();
  await closed.unmount();

  mockState.isFloatingOpen = true;
  Platform.OS = "ios";
  const ios = await render(<GenerationFloatingPreview />);
  expect(ios.toJSON()).toBeNull();
});

test("shows the streaming preview and cancels the queue while generating", async () => {
  const screen = await render(<GenerationFloatingPreview />);
  expect(screen.getByTestId("floating-image").props.source).toEqual({
    uri: "file:///cache/nai-stream-previews/gen_test/0.jpg",
  });

  await fireEvent.press(screen.getByRole("button", { name: "생성 취소" }));
  expect(mockState.requestQueueCancel).toHaveBeenCalled();
  expect(mockState.setFloatingOpen).not.toHaveBeenCalled();
});

test("reports its corner as the PiP source rect", async () => {
  await render(<GenerationFloatingPreview />);
  // 기본 위치는 오른쪽 아래. 800x1200 -> 최대 높이 200에 맞춰 133x200.
  expect(reportPipSourceRect).toHaveBeenLastCalledWith(expect.objectContaining({
    y: expect.any(Number), height: 200,
  }));
  const rect = jest.mocked(reportPipSourceRect).mock.calls.at(-1)![0];
  expect(rect.width).toBeCloseTo(133.33, 1);
  expect(rect.x).toBeGreaterThan(rect.width);
});

test("keeps the final image after the queue ends until closed", async () => {
  mockState.isLoading = false;
  mockState.streamingPreviewUri = null;
  mockState.generationHistory = [{ imagePath: "final.png", width: 800, height: 1200 }];
  const screen = await render(<GenerationFloatingPreview />);
  expect(screen.getByTestId("floating-image").props.source).toEqual({ uri: "file:///final.png" });
  expect(screen.queryByRole("button", { name: "생성 취소" })).toBeNull();

  await fireEvent.press(screen.getByRole("button", { name: "PiP 닫기" }));
  expect(mockState.setFloatingOpen).toHaveBeenCalledWith(false);
});

test("returns to the canvas from another screen", async () => {
  jest.mocked(router.canDismiss).mockReturnValueOnce(true);
  jest.mocked(getCanvasImageRect).mockReturnValue({ x: 0, y: 100, width: 400, height: 600 });
  const screen = await render(<GenerationFloatingPreview />);

  await fireEvent(screen.getByRole("button", { name: "캔버스로 돌아가기" }), "accessibilityTap");

  expect(router.dismissAll).toHaveBeenCalled();
  expect(mockState.setFloatingOpen).toHaveBeenCalledWith(false);
});
