import { act, fireEvent, render } from "@testing-library/react-native";
import { Pressable, StyleSheet, useWindowDimensions } from "react-native";
import type { BottomSheetProps } from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { SharedValue } from "react-native-reanimated";
import type { ComponentProps } from "react";
import type { Slider } from "../../../components/forms/Slider";
import {
  GenerationInputCommitProvider,
  useGenerationInputCommit,
} from "../../../context/GenerationInputCommitContext";
import { useGenerationStore } from "../../../store/generationStore";

import {
  PromptSheetHost,
  UtilitySheetHost,
  type PromptSheetStage,
} from "../GenerationSheetScaffold";

const mockSheetProps = jest.fn<void, [BottomSheetProps]>();
const mockPromptMounted = jest.fn();
const mockSliderProps = jest.fn<void, [ComponentProps<typeof Slider>]>();

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
jest.mock("../../../store/generationStore", () => {
  const { create } = require("zustand") as typeof import("zustand");
  return { useGenerationStore: create(() => ({
    vibeReferences: [],
    preciseReferences: [],
    model: "nai-diffusion-4-5-full",
    resolution: { label: "Normal", width: 832, height: 1216 },
    steps: 28,
    promptGuidance: 5,
    promptGuidanceRescale: 0,
    seed: 0,
    seedLocked: false,
    setSteps: jest.fn(),
    setPromptGuidance: jest.fn(),
    setPromptGuidanceRescale: jest.fn(),
  })) };
});
jest.mock("../../../components/forms/Slider", () => ({
  Slider: (props: ComponentProps<typeof Slider>) => {
    mockSliderProps(props);
    return null;
  },
}));
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
    default: { View, createAnimatedComponent: (Component: React.ElementType) => Component },
    Easing: { bezier: () => jest.fn() },
    Extrapolation: { CLAMP: "clamp" },
    interpolate: () => 0,
    useSharedValue: <T,>(value: T) => React.useRef({ value }).current,
    useAnimatedStyle: (factory: () => object) => factory(),
    useAnimatedProps: (factory: () => object) => ({ read: factory }),
    cancelAnimation: jest.fn(),
    withTiming: <T,>(value: T) => value,
  };
});

const backProgress = { value: 0 } as SharedValue<number>;
const initialState = useGenerationStore.getInitialState();

function CommitPendingButton() {
  const { commitPendingInput } = useGenerationInputCommit();
  return <Pressable accessibilityLabel="Commit pending input" onPress={commitPendingInput} />;
}

function renderSettings() {
  return <GenerationInputCommitProvider>
    <UtilitySheetHost sheet="settings" predictiveBackProgress={backProgress} onClose={jest.fn()} />
    <CommitPendingButton />
  </GenerationInputCommitProvider>;
}

function sliderProps(label = "Steps") {
  return mockSliderProps.mock.calls.filter(([props]) => props.accessibilityLabel === label).at(-1)![0];
}

describe("Settings slider input and UI-thread display", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useGenerationStore.setState(initialState, true);
    jest.mocked(useSafeAreaInsets).mockReturnValue({ top: 0, bottom: 0, left: 0, right: 0 });
  });

  test("updates animated text without per-step React renders or store commits", async () => {
    const screen = await render(renderSettings());
    const slider = sliderProps();
    expect(slider.onValueChange).toBeUndefined();
    expect(slider.display).toBeDefined();
    const textProps = screen.getByLabelText("Steps 값").props.animatedProps;
    const renderCount = mockSliderProps.mock.calls.length;
    await act(() => {
      slider.onSlidingStart?.();
      for (let next = 29; next <= 40; next++) slider.display!.value = next;
    });
    expect(textProps.read()).toEqual({ text: "40", defaultValue: "40" });
    expect(mockSliderProps).toHaveBeenCalledTimes(renderCount);
    expect(initialState.setSteps).not.toHaveBeenCalled();

    await act(() => { slider.onSlidingComplete(40); });
    expect(initialState.setSteps).toHaveBeenCalledTimes(1);
    expect(initialState.setSteps).toHaveBeenCalledWith(40);
    expect(screen.getByLabelText("Steps 값").props.value).toBe("40");
  });

  test("commits the current drag display before finalization when generation is requested", async () => {
    const screen = await render(renderSettings());
    await act(() => {
      sliderProps().onSlidingStart?.();
      sliderProps().display!.value = 37;
    });
    await fireEvent.press(screen.getByLabelText("Commit pending input"));
    expect(initialState.setSteps).toHaveBeenLastCalledWith(37);
  });

  test("commits the latest typed draft without waiting for blur", async () => {
    const screen = await render(renderSettings());
    const input = screen.getByLabelText("Steps 값");
    await fireEvent(input, "focus");
    await fireEvent.changeText(input, "41");
    expect(screen.getByLabelText("Steps 값").props.animatedProps.read()).toEqual({});
    await fireEvent.press(screen.getByLabelText("Commit pending input"));
    expect(initialState.setSteps).toHaveBeenLastCalledWith(41);
  });

  test.each([
    ["Steps", "999", 50, "setSteps"],
    ["Steps", "-5", 1, "setSteps"],
    ["Prompt Guidance", "5,37", 5.4, "setPromptGuidance"],
    ["Prompt Guidance Rescale", "0.137", 0.14, "setPromptGuidanceRescale"],
  ] as const)("normalizes %s input %s to %s", async (label, draft, expected, action) => {
    const screen = await render(renderSettings());
    const input = screen.getByLabelText(`${label} 값`);
    await fireEvent(input, "focus");
    await fireEvent.changeText(input, draft);
    await fireEvent(input, "blur");
    expect(initialState[action]).toHaveBeenLastCalledWith(expected);
    expect(screen.getByLabelText(`${label} 값`).props.animatedProps.read().text).toBe(String(expected));
  });

  test("restores an invalid draft even when the numeric display did not change", async () => {
    const screen = await render(renderSettings());
    const input = screen.getByLabelText("Steps 값");
    await fireEvent(input, "focus");
    await fireEvent.changeText(input, "bad");
    await fireEvent(input, "blur");
    expect(initialState.setSteps).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Steps 값").props.value).toBe("28");
    expect(screen.getByLabelText("Steps 값").props.animatedProps.read().text).toBe("28");
  });

  test("keeps keyboard blur from replacing a drag value or losing its pending commit", async () => {
    const screen = await render(renderSettings());
    const input = screen.getByLabelText("Steps 값");
    await fireEvent(input, "focus");
    await fireEvent.changeText(input, "12");
    await act(() => {
      sliderProps().onSlidingStart?.();
      sliderProps().display!.value = 36;
    });
    await fireEvent(input, "blur");
    expect(initialState.setSteps).toHaveBeenLastCalledWith(36);
    await act(() => { sliderProps().display!.value = 39; });
    await fireEvent.press(screen.getByLabelText("Commit pending input"));
    expect(initialState.setSteps).toHaveBeenLastCalledWith(39);
    await act(() => { sliderProps().onSlidingComplete(39); });
    expect(screen.getByLabelText("Steps 값").props.value).toBe("39");
  });

  test("does not overwrite a focused draft on external value changes", async () => {
    const screen = await render(renderSettings());
    const input = screen.getByLabelText("Steps 값");
    await fireEvent(input, "focus");
    await fireEvent.changeText(input, "43");
    await act(() => { useGenerationStore.setState({ steps: 20 }); });
    expect(screen.getByLabelText("Steps 값").props.value).toBe("43");
    expect(screen.getByLabelText("Steps 값").props.animatedProps.read()).toEqual({});
    await fireEvent(input, "blur");
    expect(initialState.setSteps).toHaveBeenLastCalledWith(43);
  });

  test("synchronizes an external value when idle", async () => {
    const screen = await render(renderSettings());
    await act(() => { useGenerationStore.setState({ steps: 20 }); });
    expect(screen.getByLabelText("Steps 값").props.value).toBe("20");
    expect(sliderProps().display!.value).toBe(20);
  });

  test("starts typing from the last drag value and commits the new draft", async () => {
    const screen = await render(renderSettings());
    await act(() => {
      sliderProps().onSlidingStart?.();
      sliderProps().display!.value = 35;
      sliderProps().onSlidingComplete(35);
    });
    const input = screen.getByLabelText("Steps 값");
    await fireEvent(input, "focus");
    expect(screen.getByLabelText("Steps 값").props.value).toBe("35");
    await fireEvent.changeText(input, "46");
    await fireEvent.press(screen.getByLabelText("Commit pending input"));
    expect(initialState.setSteps).toHaveBeenLastCalledWith(46);
  });

  test("commits another focused field before a new slider takes pending-input ownership", async () => {
    const screen = await render(renderSettings());
    const input = screen.getByLabelText("Steps 값");
    await fireEvent(input, "focus");
    await fireEvent.changeText(input, "42");
    await act(() => {
      const guidance = sliderProps("Prompt Guidance");
      guidance.onSlidingStart?.();
      guidance.display!.value = 6.7;
    });
    await fireEvent.press(screen.getByLabelText("Commit pending input"));
    expect(initialState.setSteps).toHaveBeenLastCalledWith(42);
    expect(initialState.setPromptGuidance).toHaveBeenLastCalledWith(6.7);
  });

  test("releases pending drag input on unmount", async () => {
    const screen = await render(renderSettings());
    await act(() => {
      sliderProps().onSlidingStart?.();
      sliderProps().display!.value = 37;
    });
    await screen.rerender(<GenerationInputCommitProvider><CommitPendingButton /></GenerationInputCommitProvider>);
    await fireEvent.press(screen.getByLabelText("Commit pending input"));
    expect(initialState.setSteps).not.toHaveBeenCalled();
  });
});

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
