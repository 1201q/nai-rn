import { act, fireEvent, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { Image as ExpoImage, type ImageLoadEventData } from "expo-image";

import { GenerationCanvas } from "../GenerationCanvas";
import { generationImagePipeline, releaseNativePreviews } from "../../../../modules/generation-image-pipeline";

jest.mock("../../../../modules/generation-image-pipeline", () => ({
  ...jest.requireActual("../../../../modules/generation-image-pipeline"),
  generationImagePipeline: { retainPreviews: jest.fn() },
  releaseNativePreviews: jest.fn(),
}));

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("expo-image", () => {
  const { View } = require("react-native") as typeof import("react-native");
  return { Image: jest.fn((props: object) => <View {...props} testID="canvas-image" />) };
});
jest.mock("expo-clipboard", () => ({ setImageAsync: jest.fn() }));
jest.mock("expo-file-system", () => ({ File: jest.fn() }));
jest.mock("expo-media-library", () => ({
  Asset: { create: jest.fn() },
  requestPermissionsAsync: jest.fn(),
}));
jest.mock("sonner-native", () => ({ toast: { success: jest.fn() } }));
jest.mock("react-native-gesture-handler", () => {
  function gesture() {
    return {
      enabled: jest.fn().mockReturnThis(),
      maxPointers: jest.fn().mockReturnThis(),
      minDistance: jest.fn().mockReturnThis(),
      onBegin: jest.fn().mockReturnThis(),
      onUpdate: jest.fn().mockReturnThis(),
      onEnd: jest.fn().mockReturnThis(),
      numberOfTaps: jest.fn().mockReturnThis(),
      maxDuration: jest.fn().mockReturnThis(),
    };
  }
  return {
    Gesture: { Pan: gesture, Pinch: gesture, Tap: gesture, Race: jest.fn(), Simultaneous: jest.fn() },
    GestureDetector: ({ children }: { children: React.ReactNode }) => children,
  };
});
jest.mock("react-native-reanimated", () => {
  const React = require("react") as typeof import("react");
  const { Easing, View } = require("react-native") as typeof import("react-native");

  return {
    __esModule: true,
    default: { View },
    Easing,
    Extrapolation: { CLAMP: "clamp" },
    interpolate: () => 1,
    useSharedValue: <T,>(value: T) => React.useRef({ value }).current,
    useAnimatedStyle: (factory: () => object) => factory(),
    withTiming: (value: number) => value,
    cancelAnimation: jest.fn(),
  };
});
jest.mock("../../../lib/generationHistory", () => ({
  resolveGenerationImageUri: ({ imagePath }: { imagePath: string }) => `file:///${imagePath}`,
}));
const mockGenerationState = {
  currentGeneration: null as { imagePath: string; width: number; height: number } | null,
  streamingPreviewUri: null as string | null,
  isLoading: false,
  resolution: { width: 832, height: 1216 },
  mainImageBlurred: false,
  setMainImageBlurred: jest.fn(),
};
jest.mock("../../../store/generationStore", () => ({
  useGenerationStore: (selector: (state: object) => unknown) => selector(mockGenerationState),
}));

beforeEach(() => {
  mockGenerationState.currentGeneration = null;
  mockGenerationState.streamingPreviewUri = null;
  mockGenerationState.isLoading = false;
  jest.clearAllMocks();
});

describe("generation canvas toolbar accessibility", () => {
  test("hides collapsed actions but keeps the expand button accessible", async () => {
    const screen = await render(<GenerationCanvas onOpenMetadata={jest.fn()} />);
    const labels = [
      "이미지 블러 적용", "이미지 다운로드", "이미지 복사", "메타데이터 정보",
    ];
    for (const name of labels) {
      expect(screen.getByRole("button", { name })).toBeTruthy();
    }

    await fireEvent.press(screen.getByRole("button", { name: "이미지 도구 접기" }));

    for (const name of labels) {
      expect(screen.queryByRole("button", { name })).toBeNull();
      expect(screen.getByRole("button", {
        name, includeHiddenElements: true,
      })).toBeTruthy();
    }
    expect(screen.getByRole("button", { name: "이미지 도구 펼치기" }).props.accessibilityState)
      .toMatchObject({ expanded: false });

    await fireEvent.press(screen.getByRole("button", { name: "이미지 도구 펼치기" }));

    for (const name of labels) {
      expect(screen.getByRole("button", { name })).toBeTruthy();
    }
    expect(screen.getByRole("button", { name: "이미지 도구 접기" }).props.accessibilityState)
      .toMatchObject({ expanded: true });
  });
});

describe("generation canvas image loading", () => {
  test("retains a request across preview frames and releases it after source replacement", async () => {
    mockGenerationState.streamingPreviewUri = "file:///cache/nai-stream-previews/gen_test/0.jpg";
    const screen = await render(<GenerationCanvas onOpenMetadata={jest.fn()} />);
    expect(screen.getByTestId("canvas-image").props.cachePolicy).toBe("none");
    expect(generationImagePipeline!.retainPreviews).toHaveBeenCalledWith("gen_test");
    mockGenerationState.streamingPreviewUri = "file:///cache/nai-stream-previews/gen_test/1.jpg";
    await screen.rerender(<GenerationCanvas onOpenMetadata={jest.fn()} />);
    expect(releaseNativePreviews).not.toHaveBeenCalled();
    mockGenerationState.streamingPreviewUri = "file:///originals/final.png";
    await screen.rerender(<GenerationCanvas onOpenMetadata={jest.fn()} />);
    expect(releaseNativePreviews).toHaveBeenCalledWith("gen_test");
    expect(screen.getByTestId("canvas-image").props.cachePolicy).toBe("memory-disk");
  });

  function loadEvent(url: string, width: number, height: number): ImageLoadEventData {
    return { cacheType: "none", source: { url, width, height, mediaType: "image/png" } };
  }

  test("skips preview load updates and image renders on toolbar toggles", async () => {
    mockGenerationState.streamingPreviewUri = "data:image/png;base64,preview";
    mockGenerationState.isLoading = true;
    const screen = await render(<GenerationCanvas onOpenMetadata={jest.fn()} />);
    const image = screen.getByTestId("canvas-image");
    const onLoad = image.props.onLoad;
    const renders = jest.mocked(ExpoImage).mock.calls.length;

    await act(() => onLoad(loadEvent(mockGenerationState.streamingPreviewUri!, 400, 100)));
    await fireEvent.press(screen.getByRole("button", { name: "이미지 도구 접기" }));

    expect(jest.mocked(ExpoImage).mock.calls).toHaveLength(renders);
    expect(screen.getByTestId("canvas-image").props.onLoad).toBe(onLoad);
  });

  test("corrects final image size and ignores duplicate or stale loads", async () => {
    mockGenerationState.currentGeneration = { imagePath: "first.png", width: 400, height: 400 };
    const onOpenMetadata = jest.fn();
    const screen = await render(<GenerationCanvas onOpenMetadata={onOpenMetadata} />);
    await fireEvent(screen.getByRole("image").parent!, "layout", {
      nativeEvent: { layout: { width: 400, height: 400 } },
    });
    const onLoad = screen.getByTestId("canvas-image").props.onLoad;
    await act(() => onLoad(loadEvent("file:///first.png", 400, 200)));
    expect(StyleSheet.flatten(screen.getByTestId("canvas-image").parent!.props.style))
      .toMatchObject({ width: 400, height: 200 });
    const renders = jest.mocked(ExpoImage).mock.calls.length;
    await act(() => onLoad(loadEvent("file:///first.png", 400, 200)));
    expect(jest.mocked(ExpoImage).mock.calls).toHaveLength(renders);

    mockGenerationState.currentGeneration = { imagePath: "second.png", width: 400, height: 400 };
    await screen.rerender(<GenerationCanvas onOpenMetadata={onOpenMetadata} />);
    expect(screen.getByTestId("canvas-image").props.onLoad).toBe(onLoad);
    await act(() => onLoad(loadEvent("file:///second.png", 100, 400)));
    await act(() => onLoad(loadEvent("file:///first.png", 400, 200)));
    expect(StyleSheet.flatten(screen.getByTestId("canvas-image").parent!.props.style))
      .toMatchObject({ width: 100, height: 400 });
  });
});
