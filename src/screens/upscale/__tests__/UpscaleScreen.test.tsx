import { act, fireEvent, render } from "@testing-library/react-native";
import { UpscaleScreen } from "../UpscaleScreen";
import { useUpscaleQueueStore } from "../../../store/upscaleQueueStore";
import { useBackHandler } from "../../../native/useBackHandler";
import type { ComponentProps } from "react";
import type { UtilitySheetHost } from "../../generation/GenerationSheetScaffold";
import type { UpscaleQueueSheet } from "../UpscaleQueueSheet";

const mockNavigate = jest.fn();
const mockUtilityProps = jest.fn();
const mockQueueProps = jest.fn();
const mockActionProps = jest.fn();

jest.mock("expo-router", () => ({
  useIsFocused: () => true,
  useRouter: () => ({ back: jest.fn(), navigate: mockNavigate }),
}));
jest.mock("../../../../modules/image-upscaler", () => ({
  imageUpscaler: { releasePreviews: jest.fn() },
}));
jest.mock("expo-status-bar", () => ({ StatusBar: () => null }));
jest.mock("expo-image", () => ({ Image: require("react-native").View }));
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
jest.mock("../../../store/upscaleQueueStore", () => {
  const { create } = require("zustand");
  return {
    useUpscaleQueueStore: create(() => ({
      items: [],
      running: false,
      progress: 0,
      stopRequested: false,
      activeBatchIds: [],
      batchCompleted: 0,
      currentItemId: null,
      setPreviewVisible: jest.fn(),
      addImages: jest.fn(),
      clear: jest.fn(),
      removeItem: jest.fn(),
      start: jest.fn(),
      requestStop: jest.fn(),
    })),
  };
});
jest.mock("react-native-reanimated", () => ({
  useSharedValue: (value: number) => ({ value }),
  cancelAnimation: jest.fn(),
  withSpring: (value: number) => value,
}));
jest.mock("../../generation/GenerationActionBar", () => ({
  ActionBar: require("react-native").View,
  ActionIconButton: ({
    label,
    onPress,
  }: {
    label: string;
    onPress: () => void;
  }) => {
    const { Pressable } = require("react-native");
    return <Pressable accessibilityLabel={label} onPress={onPress} />;
  },
  ActionProgressButton: (props: object) => {
    mockActionProps(props);
    return null;
  },
}));
jest.mock("../../generation/GenerationSheetScaffold", () => ({
  UtilitySheetHost: (props: object) => {
    mockUtilityProps(props);
    return null;
  },
}));
jest.mock("../UpscaleQueueSheet", () => ({
  UpscaleQueueSheet: (props: object) => {
    mockQueueProps(props);
    return null;
  },
}));

jest.mock("../UpscaleSettingsSheet", () => ({
  UpscaleSettingsSheetContent: () => null,
  UPSCALE_SELECT_PORTAL_HOST: "upscale-select-overlay",
}));
jest.mock("../../../components/common/DetailScrollHeader", () => ({
  DETAIL_FIXED_HEADER_CONTENT_OFFSET: 72,
  DetailHeaderOverlay: ({ onMore }: { onMore: () => void }) => {
    const { Pressable } = require("react-native");
    return <Pressable accessibilityLabel="더 보기" onPress={onMore} />;
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  useUpscaleQueueStore.setState({
    items: [],
    running: false,
    progress: 0,
    stopRequested: false,
    activeBatchIds: [],
    batchCompleted: 0,
    currentItemId: null,
  });
});
function queueProps() {
  return mockQueueProps.mock.calls.at(-1)![0] as ComponentProps<
    typeof UpscaleQueueSheet
  >;
}
function utilityProps() {
  return mockUtilityProps.mock.calls.at(-1)![0] as ComponentProps<
    typeof UtilitySheetHost
  >;
}
function backCallbacks() {
  return jest.mocked(useBackHandler).mock.calls.at(-1)![1];
}

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

test("opens settings and history separately from the image management sheet", async () => {
  const screen = await render(<UpscaleScreen />);
  expect(queueProps().stage).toBe("collapsed");
  await fireEvent.press(screen.getByLabelText("Settings 열기"));
  expect(utilityProps().sheet).toBe("settings");
  expect(utilityProps().renderSettings).toBeDefined();
  expect(queueProps().stage).toBe("collapsed");
  await fireEvent.press(screen.getByLabelText("History 열기"));
  expect(utilityProps().sheet).toBe("history");
  await act(() => {
    backCallbacks().onBack();
  });
  expect(utilityProps().sheet).toBeNull();
});

test("backs out of full to half to collapsed and closes a utility sheet first", async () => {
  const screen = await render(<UpscaleScreen />);
  await fireEvent.press(screen.getByLabelText("업스케일 이미지 관리 열기"));
  expect(queueProps().stage).toBe("half");
  await act(() => {
    queueProps().onStageChange("full");
  });
  await fireEvent.press(screen.getByLabelText("Settings 열기"));
  await act(() => {
    backCallbacks().onBack();
  });
  expect(utilityProps().sheet).toBeNull();
  expect(queueProps().stage).toBe("full");
  await act(() => {
    backCallbacks().onBack();
  });
  expect(queueProps().stage).toBe("half");
  await act(() => {
    backCallbacks().onBack();
  });
  expect(queueProps().stage).toBe("collapsed");
});

test("shows the current batch image and counts progress using only this batch", async () => {
  useUpscaleQueueStore.setState({
    running: true,
    activeBatchIds: ["first", "current", "next"],
    batchCompleted: 1,
    currentItemId: "current",
    progress: 0.5,
    items: [
      {
        id: "current",
        uri: "file:///current.png",
        width: 100,
        height: 100,
        status: "running",
      },
      {
        id: "next",
        uri: "file:///next.png",
        width: 100,
        height: 100,
        status: "pending",
      },
      {
        id: "later",
        uri: "file:///later.png",
        width: 100,
        height: 100,
        status: "pending",
      },
    ],
  });
  const screen = await render(<UpscaleScreen />);
  expect(screen.getByLabelText("현재 업스케일 이미지").props.source).toEqual({
    uri: "file:///current.png",
  });
  expect(mockActionProps.mock.calls.at(-1)![0]).toMatchObject({
    label: "중단 (2/3) · 50%",
    percent: 0.5,
  });
  await act(() => {
    useUpscaleQueueStore.setState((state) => ({
      items: [
        ...state.items,
        {
          id: "another",
          uri: "file:///another.png",
          width: 100,
          height: 100,
          status: "pending",
        },
      ],
    }));
  });
  expect(mockActionProps.mock.calls.at(-1)![0]).toMatchObject({
    label: "중단 (2/3) · 50%",
    percent: 0.5,
  });
});
