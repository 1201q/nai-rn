import { fireEvent, render } from "@testing-library/react-native";
import { UpscaleScreen } from "../UpscaleScreen";

const mockNavigate = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), navigate: mockNavigate }),
}));
jest.mock("expo-status-bar", () => ({ StatusBar: () => null }));
jest.mock("expo-image", () => ({ Image: () => null }));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("@gorhom/portal", () => ({ PortalHost: () => null }));
jest.mock("sonner-native", () => ({ toast: jest.fn() }));
jest.mock("../../../lib/generationHistory", () => ({
  resolveGenerationImageUri: jest.fn(),
}));
jest.mock("../../../lib/upscaleInput", () => ({
  pickUpscaleFiles: jest.fn(),
  pickUpscaleGalleryImages: jest.fn(),
}));
jest.mock("../../../native/useBackHandler", () => ({
  useBackHandler: jest.fn(),
}));
jest.mock("../../../hooks/useGenerationChromeMetrics", () => ({
  useGenerationChromeMetrics: () => ({
    topInset: 24,
    promptCollapsedHeight: 60,
  }),
}));
jest.mock("../../../store/upscaleSettingsStore", () => ({
  useUpscaleSettingsStore: (selector: (state: object) => unknown) =>
    selector({
      settings: require("../upscaleOptions").DEFAULT_UPSCALE_SETTINGS,
      setSettings: jest.fn(),
    }),
}));
jest.mock("../../../store/upscaleQueueStore", () => ({
  useUpscaleQueueStore: (selector: (state: object) => unknown) =>
    selector({ items: [], running: false, progress: 0, stopRequested: false }),
}));
jest.mock("react-native-reanimated", () => ({
  useSharedValue: (value: number) => ({ value }),
  cancelAnimation: jest.fn(),
  withSpring: (value: number) => value,
}));
jest.mock("../../generation/GenerationActionBar", () => ({
  ActionBar: require("react-native").View,
  ActionIconButton: () => null,
  ActionProgressButton: () => null,
}));
jest.mock("../../generation/GenerationSheetScaffold", () => ({
  UtilitySheetHost: () => null,
}));
jest.mock("../UpscaleSettingsSheet", () => ({
  UpscaleSettingsSheetHost: () => null,
  UPSCALE_SELECT_PORTAL_HOST: "upscale-select-overlay",
}));
jest.mock("../../../components/common/DetailScrollHeader", () => ({
  DETAIL_FIXED_HEADER_CONTENT_OFFSET: 72,
  DetailHeaderOverlay: ({ onMore }: { onMore: () => void }) => {
    const { Pressable } = require("react-native");
    return <Pressable accessibilityLabel="더 보기" onPress={onMore} />;
  },
}));

test("the overflow menu opens the dedicated upscale settings page", async () => {
  const view = await render(<UpscaleScreen />);
  expect(view.queryByText("업스케일링 설정")).toBeNull();
  await fireEvent.press(view.getByLabelText("더 보기"));
  await fireEvent.press(view.getByRole("menuitem"));
  expect(mockNavigate).toHaveBeenCalledWith("/upscale-settings");
  expect(view.queryByText("업스케일링 설정")).toBeNull();
});

test("pressing outside the menu dismisses it", async () => {
  const view = await render(<UpscaleScreen />);
  await fireEvent.press(view.getByLabelText("더 보기"));
  expect(view.getByText("업스케일링 설정")).toBeTruthy();
  await fireEvent.press(view.getByLabelText("메뉴 닫기"));
  expect(view.queryByText("업스케일링 설정")).toBeNull();
});
