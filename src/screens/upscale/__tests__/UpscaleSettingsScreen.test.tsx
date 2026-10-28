import { act, fireEvent, render } from "@testing-library/react-native";
import { useUpscaleSettingsStore } from "../../../store/upscaleSettingsStore";
import { DEFAULT_UPSCALE_SETTINGS } from "../upscaleOptions";
import { UpscaleSettingsScreen } from "../UpscaleSettingsScreen";

jest.mock("react-native-keyboard-controller", () => ({
  KeyboardAwareScrollView: require("react-native").ScrollView,
}));

const mockBack = jest.fn();
let mockRunning = false;

jest.mock("../../../lib/storage", () => ({
  storage: { getString: jest.fn(), set: jest.fn() },
}));
jest.mock("../../../store/upscaleQueueStore", () => ({
  useUpscaleQueueStore: (selector: (state: object) => unknown) =>
    selector({ running: mockRunning }),
}));
jest.mock("../../../store/generationStore", () => ({
  useGenerationStore: (selector: (state: object) => unknown) =>
    selector({ sliderHandleOnly: true }),
}));
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack }),
  useIsFocused: () => true,
  useFocusEffect: (callback: () => () => void) =>
    require("react").useEffect(callback, [callback]),
}));
jest.mock("expo-blur", () => ({
  BlurTargetView: require("react-native").View,
}));
jest.mock("expo-status-bar", () => ({ StatusBar: () => null }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 16 }),
}));
jest.mock("@gorhom/portal", () => ({ PortalHost: () => null }));
jest.mock("@gorhom/bottom-sheet", () => ({
  // Throw if a page accidentally uses the sheet-only input.
  BottomSheetTextInput: () => {
    throw new Error("Input requires a bottom sheet");
  },
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("expo-haptics", () => ({ selectionAsync: () => Promise.resolve() }));
jest.mock("react-native-reanimated", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: {
      View: require("react-native").View,
      createAnimatedComponent: (component: unknown) => component,
    },
    useSharedValue: (value: number) => React.useRef({ value }).current,
    useAnimatedProps: () => ({}),
    useAnimatedStyle: (factory: () => object) => factory(),
    withTiming: (value: number) => value,
  };
});
jest.mock("../../../components/common/DetailScrollHeader", () => ({
  DETAIL_FIXED_HEADER_CONTENT_OFFSET: 72,
  DetailHeaderOverlay: ({ onBack }: { onBack: () => void }) => {
    const { Pressable } = require("react-native");
    return <Pressable accessibilityLabel="뒤로" onPress={onBack} />;
  },
}));
jest.mock("../../../components/forms/Slider", () => ({ Slider: () => null }));
jest.mock("../../../components/forms/HelpButton", () => ({
  HelpButton: ({ label }: { label: string }) => {
    const { Pressable } = require("react-native");
    return <Pressable accessibilityLabel={`${label} 도움말`} />;
  },
}));
jest.mock("../../../components/forms/SheetSelect", () => ({
  SheetSelect: ({
    accessibilityLabel,
    options,
    onOpenChange,
    onChange,
  }: {
    accessibilityLabel: string;
    options: string[];
    onOpenChange?: (open: boolean) => void;
    onChange: (value: string) => void;
  }) => {
    const { View, Pressable } = require("react-native");
    return (
      <View>
        {options.map((value) => (
          <Pressable
            key={value}
            accessibilityLabel={`${accessibilityLabel}: ${value}`}
            onPress={() => {
              onOpenChange?.(true);
              onChange(value);
            }}
          />
        ))}
      </View>
    );
  },
}));
jest.mock("../UpscaleCpuSettings", () => ({ UpscaleCpuSettings: () => null }));

beforeEach(() => {
  jest.clearAllMocks();
  mockRunning = false;
  useUpscaleSettingsStore.setState({
    settings: { ...DEFAULT_UPSCALE_SETTINGS, format: "jpg" },
  });
});

test("shows value help and inline toggle descriptions, without the sheet's core options", async () => {
  const view = await render(<UpscaleSettingsScreen />);
  expect(view.getByLabelText("Image Format 도움말")).toBeTruthy();
  expect(view.queryByLabelText("TTA mode 도움말")).toBeNull();
  expect(
    view.getByText(
      "8가지 방향으로 추론한 결과를 합칩니다. 처리 시간과 메모리 사용량이 늘어납니다.",
    ),
  ).toBeTruthy();
  expect(view.queryByText("Model")).toBeNull();
  expect(view.queryByText("Scale")).toBeNull();
  expect(view.queryByText("Denoise")).toBeNull();
  expect(view.queryByLabelText("Use GPU")).toBeNull();
  expect(view.getByLabelText("Image quality 값")).toBeTruthy();
});

test("switching format commits the pending quality without overwriting either format's value", async () => {
  const view = await render(<UpscaleSettingsScreen />);
  const input = view.getByLabelText("Image quality 값");
  await fireEvent(input, "focus");
  await fireEvent.changeText(input, "83");
  await fireEvent.press(view.getByLabelText("Image Format: WebP"));
  expect(useUpscaleSettingsStore.getState().settings).toMatchObject({
    format: "webp",
    jpgQuality: 83,
    webpQuality: 90,
  });
  expect(view.getByLabelText("Image quality 값").props.value).toBe("90");
});

test("back commits pending quality and changes use the persisted upscale store", async () => {
  const view = await render(<UpscaleSettingsScreen />);
  await fireEvent.press(view.getByLabelText("원본 파일명 유지"));
  await fireEvent.changeText(view.getByLabelText("저장 앨범"), "Upscaled");
  const input = view.getByLabelText("Image quality 값");
  await fireEvent(input, "focus");
  await fireEvent.changeText(input, "79");
  await fireEvent.press(view.getByLabelText("뒤로"));
  expect(mockBack).toHaveBeenCalled();
  expect(useUpscaleSettingsStore.getState().settings).toMatchObject({
    jpgQuality: 79,
    keepOriginalFilename: true,
    albumName: "Upscaled",
  });
});

test("PNG removes the editable quality input and running jobs lock toggles", async () => {
  const view = await render(<UpscaleSettingsScreen />);
  await fireEvent.press(view.getByLabelText("Image Format: PNG"));
  expect(view.queryByLabelText("Image quality 값")).toBeNull();
  expect(view.getByText("무손실")).toBeTruthy();
  mockRunning = true;
  await act(async () => view.rerender(<UpscaleSettingsScreen />));
  expect(
    view.getByLabelText("TTA mode", { includeHiddenElements: true }).props
      .accessibilityState.disabled,
  ).toBe(true);
});

test("Sync Gap is selected from a dropdown and GPU memory is not displayed", async () => {
  const view = await render(<UpscaleSettingsScreen />);
  expect(view.queryByText("GPU 메모리 예산")).toBeNull();
  expect(view.queryByLabelText("Real-CUGAN Sync Gap 값")).toBeNull();
  await fireEvent.press(view.getByLabelText("Real-CUGAN Sync Gap: 1"));
  expect(useUpscaleSettingsStore.getState().settings.syncGap).toBe(1);
});
