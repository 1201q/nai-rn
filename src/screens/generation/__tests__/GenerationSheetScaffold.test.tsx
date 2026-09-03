import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet, useWindowDimensions } from "react-native";
import type { BottomSheetProps } from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { SharedValue } from "react-native-reanimated";

import {
  PromptSheetHost,
  UtilitySheetHost,
  type PromptSheetStage,
} from "../GenerationSheetScaffold";

const mockSheetProps = jest.fn<void, [BottomSheetProps]>();
const mockPromptMounted = jest.fn();

jest.mock("@gorhom/bottom-sheet", () => {
  const React = require("react") as typeof import("react");
  const { View, TextInput } = require("react-native") as typeof import("react-native");
  return {
    __esModule: true,
    default: React.forwardRef(function MockSheet(props: BottomSheetProps, _ref) {
      mockSheetProps(props);
      return React.createElement(View, null, props.children as React.ReactNode);
    }),
    BottomSheetView: View,
    BottomSheetTextInput: TextInput,
    useBottomSheetTimingConfigs: () => ({}),
  };
});

jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: jest.fn() }));
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 390, height: 844, scale: 1, fontScale: 1 })),
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("../../../native/predictiveBack", () => ({ usePredictiveBackHandler: () => {} }));
jest.mock("../../../context/GenerationInputCommitContext", () => ({
  useGenerationInputCommit: () => ({ commitPendingInput: jest.fn() }),
  useGenerationInputCommitRegistration: () => ({}),
}));
jest.mock("../../../store/generationStore", () => ({
  useGenerationStore: (selector: (state: object) => unknown) => selector({
    vibeReferences: [],
    preciseReferences: [],
    model: "nai-diffusion-4-5-full",
    resolution: { label: "Normal", width: 832, height: 1216 },
    steps: 28,
    promptGuidance: 5,
    promptGuidanceRescale: 0,
    seed: 0,
    seedLocked: false,
  }),
}));
jest.mock("../../../components/forms/Slider", () => ({ Slider: () => null }));
jest.mock("../../../components/forms/SheetSelect", () => ({ SheetSelect: () => null }));
jest.mock("../../../components/forms/FormControls", () => ({ Toggle: () => null }));
jest.mock("../../../components/generation/PromptSheetContent", () => {
  const React = require("react") as typeof import("react");
  const { TextInput } = require("react-native") as typeof import("react-native");
  return {
    PromptSheetContent: function MockPromptContent() {
      React.useEffect(() => {
        mockPromptMounted();
      }, []);
      return React.createElement(TextInput, {
        accessibilityLabel: "테스트 Prompt 입력",
        defaultValue: "draft",
      });
    },
  };
});
jest.mock("../../../components/generation/HistorySheetContent", () => ({
  useHistorySheetController: () => ({ exitSelectionMode: jest.fn() }),
  HistorySheetContent: () => null,
  HistorySheetFooter: () => null,
  HistorySheetHandle: () => null,
}));
jest.mock("../../../components/generation/BottomSheetKeyboardAwareScrollView", () => {
  const React = require("react") as typeof import("react");
  const { ScrollView } = require("react-native") as typeof import("react-native");
  return {
    BottomSheetKeyboardAwareScrollView: (props: import("react-native").ScrollViewProps) =>
      React.createElement(ScrollView, { ...props, testID: "settings-scroll" }),
  };
});
jest.mock("react-native-gesture-handler", () => ({
  GestureDetector: ({ children }: { children: React.ReactNode }) => children,
  Gesture: {
    Pan: () => {
      const gesture: Record<string, jest.Mock> = {};
      for (const method of [
        "enabled", "activeOffsetX", "failOffsetY", "shouldCancelWhenOutside",
        "onStart", "onUpdate", "onEnd", "onFinalize",
      ]) {
        gesture[method] = jest.fn(() => gesture);
      }
      return gesture;
    },
  },
}));
jest.mock("react-native-reanimated", () => {
  const React = require("react") as typeof import("react");
  const { View } = require("react-native") as typeof import("react-native");
  return {
    __esModule: true,
    default: { View },
    Easing: { bezier: () => jest.fn() },
    Extrapolation: { CLAMP: "clamp" },
    interpolate: () => 0,
    useSharedValue: <T,>(value: T) => React.useRef({ value }).current,
    useAnimatedStyle: (factory: () => object) => factory(),
    cancelAnimation: jest.fn(),
    withTiming: <T,>(value: T) => value,
  };
});

const backProgress = { value: 0 } as SharedValue<number>;

function renderPromptStage(stage: PromptSheetStage) {
  return (
    <PromptSheetHost
      promptPreview="prompt"
      promptStage={stage}
      predictiveBackProgress={backProgress}
      onPromptStageChange={jest.fn()}
    />
  );
}

describe("generation sheet accessibility visibility", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useSafeAreaInsets).mockReturnValue({
      top: 0, bottom: 0, left: 0, right: 0,
    });
  });

  test("exposes only the preview when Prompt is collapsed", async () => {
    const screen = await render(renderPromptStage("collapsed"));

    expect(screen.getByRole("button", { name: "Prompt 펼치기" })).toBeTruthy();
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
    expect(screen.queryAllByLabelText("Prompt 접기")).toHaveLength(0);
    expect(screen.queryByLabelText("테스트 Prompt 입력")).toBeNull();
    expect(screen.getByLabelText("테스트 Prompt 입력", {
      includeHiddenElements: true,
    })).toBeTruthy();

    for (const tab of ["prompt", "reference", "chunks"]) {
      expect(screen.getByTestId(`prompt-page-${tab}`, {
        includeHiddenElements: true,
      }).props).toMatchObject({
        accessibilityElementsHidden: true,
        importantForAccessibility: "no-hide-descendants",
      });
    }
  });

  test.each(["half", "full"] as const)(
    "restores the active page and close controls at the %s stage",
    async (stage) => {
      const screen = await render(renderPromptStage("collapsed"));
      await screen.rerender(renderPromptStage(stage));

      expect(screen.queryByLabelText("Prompt 펼치기")).toBeNull();
      expect(screen.getAllByRole("tab")).toHaveLength(3);
      expect(screen.getAllByRole("button", { name: "Prompt 접기" })).toHaveLength(2);
      expect(screen.getByLabelText("테스트 Prompt 입력")).toBeTruthy();
      expect(screen.getByTestId("prompt-page-prompt").props).toMatchObject({
        accessibilityElementsHidden: false,
        importantForAccessibility: "auto",
      });

      await screen.rerender(renderPromptStage("collapsed"));
      expect(screen.queryByLabelText("테스트 Prompt 입력")).toBeNull();
      expect(screen.queryAllByLabelText("Prompt 접기")).toHaveLength(0);
      expect(screen.getByRole("button", { name: "Prompt 펼치기" })).toBeTruthy();
    },
  );

  test("exposes only the selected page without unmounting the prompt draft", async () => {
    const screen = await render(renderPromptStage("full"));

    for (const [name, key] of [["Reference Images", "reference"], ["Chunks", "chunks"]]) {
      await fireEvent.press(screen.getByRole("tab", { name }));
      expect(screen.queryByLabelText("테스트 Prompt 입력")).toBeNull();
      expect(screen.getByLabelText("테스트 Prompt 입력", {
        includeHiddenElements: true,
      }).props.defaultValue).toBe("draft");

      for (const tab of ["prompt", "reference", "chunks"]) {
        const active = tab === key;
        expect(screen.getByTestId(`prompt-page-${tab}`, {
          includeHiddenElements: true,
        }).props).toMatchObject({
          accessibilityElementsHidden: !active,
          importantForAccessibility: active ? "auto" : "no-hide-descendants",
        });
      }
    }

    await fireEvent.press(screen.getByRole("tab", { name: "Prompt" }));
    expect(screen.getByLabelText("테스트 Prompt 입력")).toBeTruthy();
    expect(mockPromptMounted).toHaveBeenCalledTimes(1);
  });
});

describe("generation sheet safe area", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useWindowDimensions).mockReturnValue({
      width: 390, height: 844, scale: 1, fontScale: 1,
    });
  });

  test.each([
    { top: 0, bottom: 0, fullTop: 70, utilityTop: 56 },
    { top: 59, bottom: 34, fullTop: 71, utilityTop: 71 },
  ])("keeps Prompt and Settings clear of $top/$bottom insets", async ({
    top, bottom, fullTop, utilityTop,
  }) => {
    jest.mocked(useSafeAreaInsets).mockReturnValue({ top, bottom, left: 0, right: 0 });
    const prompt = await render(
      <PromptSheetHost
        promptPreview="prompt"
        promptStage="collapsed"
        predictiveBackProgress={backProgress}
        onPromptStageChange={jest.fn()}
      />,
    );
    expect(mockSheetProps.mock.calls.at(-1)?.[0].snapPoints).toEqual([
      128 + bottom, 444, 844 - fullTop,
    ]);
    await prompt.unmount();

    const settings = await render(
      <UtilitySheetHost
        sheet="settings"
        predictiveBackProgress={backProgress}
        onClose={jest.fn()}
      />,
    );
    expect(mockSheetProps.mock.calls.at(-1)?.[0].snapPoints).toEqual([844 - utilityTop]);
    const { contentContainerStyle } = settings.getByTestId("settings-scroll").props;
    expect(StyleSheet.flatten(contentContainerStyle)).toMatchObject({
      paddingBottom: 200 + bottom,
    });
  });

  test("recalculates Prompt snap points after a window and inset change", async () => {
    jest.mocked(useSafeAreaInsets).mockReturnValue({
      top: 59, bottom: 34, left: 0, right: 0,
    });
    const renderPrompt = () => (
      <PromptSheetHost
        promptPreview="prompt"
        promptStage="full"
        predictiveBackProgress={backProgress}
        onPromptStageChange={jest.fn()}
      />
    );
    const prompt = await render(renderPrompt());
    jest.mocked(useWindowDimensions).mockReturnValue({
      width: 844, height: 390, scale: 1, fontScale: 1,
    });
    jest.mocked(useSafeAreaInsets).mockReturnValue({
      top: 0, bottom: 21, left: 0, right: 0,
    });
    await prompt.rerender(renderPrompt());

    expect(mockSheetProps.mock.calls.at(-1)?.[0].snapPoints).toEqual([149, 149, 320]);
  });
});
