import { fireEvent, render } from "@testing-library/react-native";

import { GenerationCanvas } from "../GenerationCanvas";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("expo-image", () => ({ Image: () => null }));
jest.mock("expo-clipboard", () => ({ setImageAsync: jest.fn() }));
jest.mock("expo-file-system", () => ({ File: jest.fn() }));
jest.mock("expo-media-library", () => ({
  Asset: { create: jest.fn() },
  requestPermissionsAsync: jest.fn(),
}));
jest.mock("sonner-native", () => ({ toast: { success: jest.fn() } }));
jest.mock("react-native-gesture-handler", () => ({
  Gesture: {},
  GestureDetector: ({ children }: { children: React.ReactNode }) => children,
}));
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
  };
});
jest.mock("../../../lib/generationHistory", () => ({
  resolveGenerationImageUri: jest.fn(),
}));
jest.mock("../../../store/generationStore", () => ({
  useGenerationStore: (selector: (state: object) => unknown) => selector({
    currentGeneration: null,
    streamingPreviewUri: null,
    isLoading: false,
    resolution: { width: 832, height: 1216 },
    mainImageBlurred: false,
    setMainImageBlurred: jest.fn(),
  }),
}));

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
