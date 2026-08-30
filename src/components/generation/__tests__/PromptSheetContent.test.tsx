import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { useGenerationStore } from "../../../store/generationStore";
import { PromptComposerCard } from "../PromptSheetContent";

jest.mock("../../../store/generationStore", () => {
  const { create } = require("zustand") as typeof import("zustand");
  const useGenerationStore = create<{
    prompt: string;
    negativePrompt: string;
    qualityToggle: boolean;
    ucPreset: 0 | 1 | 3 | 4;
    setPrompt: (value: string) => void;
    setNegativePrompt: (value: string) => void;
    setQualityToggle: (value: boolean) => void;
    setUcPreset: (value: 0 | 1 | 3 | 4) => void;
  }>((set) => ({
    prompt: "base",
    negativePrompt: "negative",
    qualityToggle: true,
    ucPreset: 0,
    setPrompt: (prompt) => set({ prompt }),
    setNegativePrompt: (negativePrompt) => set({ negativePrompt }),
    setQualityToggle: (qualityToggle) => set({ qualityToggle }),
    setUcPreset: (ucPreset) => set({ ucPreset }),
  }));

  return { useGenerationStore };
});

jest.mock("@gorhom/bottom-sheet", () => {
  const React = require("react") as typeof import("react");
  const { ScrollView } = require("react-native") as typeof import("react-native");

  return {
    BottomSheetScrollView: (props: import("react-native").ScrollViewProps) =>
      React.createElement(ScrollView, props),
  };
});

jest.mock("../../forms/PromptHighlightTextInput", () => {
  const React = require("react") as typeof import("react");
  const { TextInput } = require("react-native") as typeof import("react-native");

  return {
    PromptHighlightTextInput: React.forwardRef(function MockPromptInput(
      props: import("react-native").TextInputProps,
      ref: import("react").ForwardedRef<import("react-native").TextInput>,
    ) {
      return React.createElement(TextInput, { ...props, ref });
    }),
  };
});

jest.mock("../../forms/SheetSelect", () => {
  const React = require("react") as typeof import("react");
  const { Pressable, Text } = require("react-native") as typeof import("react-native");

  return {
    SheetSelect: ({
      accessibilityLabel,
      value,
      options,
      onChange,
    }: {
      accessibilityLabel: string;
      value: string;
      options: readonly string[];
      onChange: (value: string) => void;
    }) =>
      React.createElement(
        Pressable,
        {
          accessibilityLabel: `${accessibilityLabel} select`,
          onPress: () => onChange(options[1]),
        },
        React.createElement(Text, null, value),
      ),
  };
});

jest.mock("../../../hooks/usePromptAutocomplete", () => ({
  usePromptAutocomplete: ({
    onChangeText,
  }: {
    onChangeText: (text: string) => void;
  }) => ({
    handleChangeText: onChangeText,
    handleSelectionChange: jest.fn(),
    clearSuggestions: jest.fn(),
    activateSuggestions: jest.fn(),
    deactivateSuggestions: jest.fn(),
  }),
}));

describe("PromptComposerCard", () => {
  beforeEach(() => {
    const state = useGenerationStore.getState();
    state.setPrompt("base");
    state.setNegativePrompt("negative");
    state.setQualityToggle(true);
    state.setUcPreset(0);
  });

  it("starts merged and keeps the editor at the largest prompt height", async () => {
    const { getByLabelText, getByTestId, queryByLabelText } = await render(
      <PromptComposerCard active />,
    );

    expect(getByLabelText("Base prompt")).toBeTruthy();
    expect(queryByLabelText("Negative prompt")).toBeNull();

    await fireEvent(getByTestId("prompt-negative-measure"), "textLayout", {
      nativeEvent: { lines: Array.from({ length: 6 }, () => ({})) },
    });
    await fireEvent.press(getByLabelText("Undesired Content"));

    const negativeInput = getByLabelText("Negative prompt");
    const inputStyle = StyleSheet.flatten(negativeInput.props.style);
    expect(inputStyle.height).toBe(150);
  });

  it("shows the split switch only while merged UC is active", async () => {
    const { getByLabelText, queryByLabelText } = await render(
      <PromptComposerCard active />,
    );

    expect(queryByLabelText("Split prompt로 전환")).toBeNull();
    await fireEvent.press(getByLabelText("Undesired Content"));
    expect(getByLabelText("Split prompt로 전환")).toBeTruthy();
    await fireEvent.press(getByLabelText("Split prompt로 전환"));

    expect(getByLabelText("Base prompt")).toBeTruthy();
    expect(getByLabelText("Negative prompt")).toBeTruthy();
    expect(queryByLabelText("Split prompt로 전환")).toBeNull();
    expect(getByLabelText("Merged prompt로 전환")).toBeTruthy();
  });

  it("uses the Settings select for prompt options", async () => {
    const { getByLabelText } = await render(<PromptComposerCard active />);

    await fireEvent.press(getByLabelText("Quality Tags select"));
    expect(useGenerationStore.getState().qualityToggle).toBe(false);

    await fireEvent.press(getByLabelText("Undesired Content"));
    await fireEvent.press(getByLabelText("UC Preset select"));
    expect(useGenerationStore.getState().ucPreset).toBe(1);
  });
});
