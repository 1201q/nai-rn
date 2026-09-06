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
import type { GenerationRecord } from "../../../lib/generationHistory";
import { useGenerationStore } from "../../../store/generationStore";

import {
  PromptSheetHost,
  UtilitySheetHost,
  type PromptSheetStage,
} from "../GenerationSheetScaffold";

const mockSheetProps = jest.fn<void, [BottomSheetProps]>();
const mockPromptMounted = jest.fn();
const mockScrollableRegistration = jest.fn();
const mockSliderProps = jest.fn<void, [ComponentProps<typeof Slider>]>();
const mockSheetMounted = jest.fn();
const mockSheetClose = jest.fn();
const mockSheetSnap = jest.fn();

jest.mock("@gorhom/bottom-sheet", () => {
  const React = require("react") as typeof import("react");
  const { View, TextInput } = require("react-native") as typeof import("react-native");
  return {
    __esModule: true,
    default: React.forwardRef(function MockSheet(props: BottomSheetProps, _ref) {
      mockSheetProps(props);
      React.useImperativeHandle(_ref, () => ({ close: mockSheetClose, snapToIndex: mockSheetSnap }));
      React.useEffect(() => { mockSheetMounted(); }, []);
      return React.createElement(View, null, props.children as React.ReactNode);
    }),
    BottomSheetView: function MockSheetView({
      focusHook = React.useEffect,
      ...props
    }: import("react-native").ViewProps & { focusHook?: typeof React.useEffect }) {
      focusHook(() => {
        mockScrollableRegistration("view");
      });
      return React.createElement(View, {
        ...props,
        testID: "sheet-body",
        style: [props.style, { position: "absolute", left: 0, top: 0, right: 0 }],
      });
    },
    BottomSheetScrollView: View,
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
jest.mock("sonner-native", () => ({ toast: { success: jest.fn() } }));
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
jest.mock("../../../components/generation/ReferenceImagesSheetContent", () => {
  const React = require("react") as typeof import("react");
  return {
    ReferenceImagesSheetContent: function MockReferenceContent({ active }: { active: boolean }) {
      React.useEffect(() => {
        if (active) mockScrollableRegistration("reference-scroll");
      }, [active]);
      return null;
    },
  };
});
jest.mock("../../../components/generation/PromptSheetContent", () => {
  const React = require("react") as typeof import("react");
  const { TextInput } = require("react-native") as typeof import("react-native");
  return {
    PromptSheetContent: function MockPromptContent({ active }: { active: boolean }) {
      React.useEffect(() => {
        if (active) mockScrollableRegistration("prompt-scroll");
      }, [active]);
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
const metadataGeneration: GenerationRecord = {
  id: "metadata-generation",
  imagePath: "originals/metadata-generation.png",
  thumbnailPath: null,
  prompt: "prompt",
  negativePrompt: "negative",
  model: "nai-diffusion-4-5-full",
  sampler: "k_euler_ancestral",
  noiseSchedule: "karras",
  width: 832,
  height: 1216,
  steps: 28,
  scale: 5,
  cfgRescale: 0,
  seed: 123,
  createdAt: 1,
  metadataJson: "{}",
};

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

describe("Utility sheet transitions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useGenerationStore.setState(initialState, true);
    jest.mocked(useSafeAreaInsets).mockReturnValue({ top: 0, bottom: 0, left: 0, right: 0 });
  });

  test.each(["settings", "history", "metadata"] as const)(
    "keeps the shell mounted and ignores an interrupted %s close",
    async (sheet) => {
      const onClose = jest.fn();
      const content = (value: typeof sheet | null) => (
        <GenerationInputCommitProvider>
          <UtilitySheetHost sheet={value} generation={metadataGeneration}
            predictiveBackProgress={backProgress} onClose={onClose} />
        </GenerationInputCommitProvider>
      );
      const screen = await render(content(null));
      expect(mockSheetProps.mock.calls.at(-1)?.[0]).toMatchObject({ index: -1, animateOnMount: false });
      await screen.rerender(content(sheet));
      expect(mockSheetProps.mock.calls.at(-1)?.[0].index).toBe(0);
      expect(mockSheetSnap).toHaveBeenLastCalledWith(0);
      mockSheetClose.mockClear();
      await screen.rerender(content(null));
      expect(mockSheetClose).toHaveBeenCalledTimes(1);
      const oldClose = mockSheetProps.mock.calls.at(-1)![0].onClose!;
      expect(mockSheetProps.mock.calls.at(-1)?.[0].index).toBe(-1);
      await screen.rerender(content(sheet));
      await act(() => oldClose());
      expect(onClose).not.toHaveBeenCalled();
      expect(mockSheetProps.mock.calls.at(-1)?.[0].index).toBe(0);
      expect(mockSheetMounted).toHaveBeenCalledTimes(1);
    },
  );

  test("an old Settings completion cannot close History", async () => {
    const onClose = jest.fn();
    const content = (sheet: "settings" | "history") => (
      <GenerationInputCommitProvider>
        <UtilitySheetHost sheet={sheet} predictiveBackProgress={backProgress} onClose={onClose} />
      </GenerationInputCommitProvider>
    );
    const screen = await render(content("settings"));
    const oldClose = mockSheetProps.mock.calls.at(-1)![0].onClose!;
    await screen.rerender(content("history"));
    await act(() => oldClose());
    expect(onClose).not.toHaveBeenCalled();
    expect(mockSheetProps.mock.calls.at(-1)?.[0].index).toBe(0);
    expect(mockSheetMounted).toHaveBeenCalledTimes(1);
  });

  test("still reports a gesture close for the current request", async () => {
    const onClose = jest.fn();
    await render(<UtilitySheetHost sheet="history" predictiveBackProgress={backProgress} onClose={onClose} />);
    await act(() => mockSheetProps.mock.calls.at(-1)![0].onClose!());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("retains content and back visibility until closing completes", async () => {
    const onClose = jest.fn();
    const onVisibilityChange = jest.fn();
    const content = (sheet: "settings" | null) => (
      <GenerationInputCommitProvider>
        <UtilitySheetHost sheet={sheet} predictiveBackProgress={backProgress}
          onClose={onClose} onVisibilityChange={onVisibilityChange} />
      </GenerationInputCommitProvider>
    );
    const screen = await render(content("settings"));
    backProgress.value = 0.6;
    await screen.rerender(content(null));
    expect(backProgress.value).toBe(0.6);
    expect(screen.getByTestId("settings-scroll")).toBeTruthy();
    expect(onVisibilityChange).toHaveBeenLastCalledWith(true);
    await act(() => mockSheetProps.mock.calls.at(-1)![0].onClose!());
    expect(backProgress.value).toBe(0);
    expect(screen.queryByTestId("settings-scroll")).toBeNull();
    expect(onVisibilityChange).toHaveBeenLastCalledWith(false);
    expect(onClose).not.toHaveBeenCalled();
    expect(mockSheetMounted).toHaveBeenCalledTimes(1);
    await screen.rerender(content("settings"));
    expect(screen.getByTestId("settings-scroll")).toBeTruthy();
    expect(onVisibilityChange).toHaveBeenLastCalledWith(true);
  });

  test("reconciles a native completion overtaken by a reversal", async () => {
    const content = (sheet: "history" | null) => (
      <UtilitySheetHost sheet={sheet} predictiveBackProgress={backProgress} onClose={jest.fn()} />
    );
    const screen = await render(content("history"));
    const opening = mockSheetProps.mock.calls.at(-1)![0];
    await screen.rerender(content(null));
    mockSheetClose.mockClear();
    await act(() => opening.onChange!(0, 100, 0));
    expect(mockSheetClose).toHaveBeenCalledTimes(1);
    const closing = mockSheetProps.mock.calls.at(-1)![0];
    await screen.rerender(content("history"));
    mockSheetSnap.mockClear();
    await act(() => closing.onChange!(-1, 844, 0));
    expect(mockSheetSnap).toHaveBeenCalledWith(0);
  });
});

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

  test("reports a fast opening target before settling and waits for collapse to finish", async () => {
    const onStageChange = jest.fn();
    await render(
      <PromptSheetHost
        promptPreview="prompt"
        promptStage="collapsed"
        predictiveBackProgress={backProgress}
        onPromptStageChange={onStageChange}
      />,
    );
    const sheet = mockSheetProps.mock.calls.at(-1)![0];

    await act(() => { sheet.onAnimate?.(0, 2, 716, 70); });
    expect(onStageChange).toHaveBeenLastCalledWith("full");
    await act(() => { sheet.onAnimate?.(2, 1, 70, 400); });
    expect(onStageChange).toHaveBeenLastCalledWith("half");

    onStageChange.mockClear();
    await act(() => { sheet.onAnimate?.(1, 0, 400, 716); });
    expect(onStageChange).not.toHaveBeenCalled();
    await act(() => { sheet.onChange?.(0, 716, 0); });
    expect(onStageChange).toHaveBeenLastCalledWith("collapsed");
  });

  test.each([0, 1])("keeps predictive scale until Prompt reaches index %i", async (index) => {
    await render(renderPromptStage("full"));
    backProgress.value = 0.6;
    const sheet = mockSheetProps.mock.calls.at(-1)![0];
    await act(() => { sheet.onAnimate?.(2, index, 70, 716); });
    expect(backProgress.value).toBe(0.6);
    await act(() => { sheet.onChange?.(index, 716, 0); });
    expect(backProgress.value).toBe(0);
  });

  test("counts only enabled reference images in the tab badge", async () => {
    const initial = useGenerationStore.getState();
    useGenerationStore.setState({
      i2iSourceImage: { uri: "file:///source.png" } as never,
      i2iEnabled: true,
      vibeReferences: [{ enabled: true }, { enabled: false }] as never,
      preciseReferences: [{ enabled: true }, { enabled: false }] as never,
    });
    const screen = await render(renderPromptStage("half"));
    expect(screen.getByText("3")).toBeTruthy();
    await act(() => useGenerationStore.setState({ i2iEnabled: false }));
    expect(screen.getByText("2")).toBeTruthy();
    await act(() => useGenerationStore.setState({
      vibeReferences: [{ enabled: false }] as never,
      preciseReferences: [{ enabled: false }] as never,
    }));
    expect(screen.queryByText("2")).toBeNull();
    expect(screen.queryByText("0")).toBeNull();
    await act(() => useGenerationStore.setState(initial, true));
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

  test("preserves the bounded sheet layout and active scroll registration across tabs and stages", async () => {
    const screen = await render(renderPromptStage("half"));
    expect(StyleSheet.flatten(screen.getByTestId("sheet-body").props.style)).toMatchObject({
      position: "absolute", top: 0, right: 0, bottom: 0, left: 0,
    });
    expect(mockScrollableRegistration).toHaveBeenLastCalledWith("prompt-scroll");
    await fireEvent.press(screen.getByRole("tab", { name: "Reference Images" }));
    expect(mockScrollableRegistration).toHaveBeenLastCalledWith("reference-scroll");

    await screen.rerender(renderPromptStage("full"));
    expect(mockScrollableRegistration).toHaveBeenLastCalledWith("reference-scroll");

    await fireEvent.press(screen.getByRole("tab", { name: "Prompt" }));
    expect(mockScrollableRegistration).toHaveBeenLastCalledWith("prompt-scroll");
    await fireEvent.press(screen.getByRole("tab", { name: "Reference Images" }));
    expect(mockScrollableRegistration).toHaveBeenLastCalledWith("reference-scroll");
    await fireEvent.press(screen.getByRole("tab", { name: "Chunks" }));
    expect(mockScrollableRegistration).toHaveBeenLastCalledWith("view");
    await fireEvent.press(screen.getByRole("tab", { name: "Prompt" }));
    expect(mockScrollableRegistration).toHaveBeenLastCalledWith("prompt-scroll");
    await screen.rerender(renderPromptStage("collapsed"));
    await screen.rerender(renderPromptStage("half"));
    expect(mockScrollableRegistration).toHaveBeenLastCalledWith("prompt-scroll");
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
    { top: 0, bottom: 0, fullTop: 56, utilityTop: 56 },
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

    expect(mockSheetProps.mock.calls.at(-1)?.[0].snapPoints).toEqual([149, 149, 334]);
  });

  test("lets the Metadata pager win horizontal gestures over the sheet", async () => {
    jest.mocked(useSafeAreaInsets).mockReturnValue({
      top: 0, bottom: 0, left: 0, right: 0,
    });
    await render(
      <UtilitySheetHost
        sheet="metadata"
        generation={metadataGeneration}
        predictiveBackProgress={backProgress}
        onClose={jest.fn()}
      />,
    );

    expect(mockSheetProps.mock.calls.at(-1)?.[0]).toMatchObject({
      activeOffsetY: [-10, 10],
      failOffsetX: [-18, 18],
    });
    expect(mockSheetProps.mock.calls.at(-1)?.[0].waitFor).toBeDefined();
  });
});
