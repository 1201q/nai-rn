import { fireEvent, render } from "@testing-library/react-native";
import { Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  GenerationInputCommitProvider,
  useGenerationInputCommit,
} from "../../../context/GenerationInputCommitContext";
import { useGenerationStore } from "../../../store/generationStore";
import { PromptComposerCard, PromptSheetContent } from "../PromptSheetContent";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: jest.fn(() => ({ top: 0, right: 0, bottom: 0, left: 0 })),
}));

jest.mock("../CharacterPromptSection", () => ({
  CharacterPromptSection: () => null,
}));

function CommitPendingInputButton() {
  const { commitPendingInput } = useGenerationInputCommit();
  return (
    <Pressable
      accessibilityLabel="Commit pending input"
      onPress={commitPendingInput}
    />
  );
}

jest.mock("../../../context/AppSheetContext", () => ({
  useAppSheet: () => ({
    openCharacterPosition: jest.fn(),
  }),
}));

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

jest.mock("../BottomSheetKeyboardAwareScrollView", () => {
  const React = require("react") as typeof import("react");
  const { ScrollView } = require("react-native") as typeof import("react-native");

  return {
    BottomSheetKeyboardAwareScrollView: (
      props: import("react-native").ScrollViewProps,
    ) => React.createElement(ScrollView, { ...props, testID: "prompt-scroll" }),
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

jest.mock("../../forms/PromptTokenCounter", () => {
  const React = require("react") as typeof import("react");
  const { View } = require("react-native") as typeof import("react-native");

  return {
    PromptTokenCounter: ({
      target,
      draftText,
      variant,
    }: {
      target: { channel: "positive" | "negative" };
      draftText: string;
      variant?: "ring" | "bar";
    }) =>
      React.createElement(View, {
        accessibilityLabel: `base-token-${target.channel}`,
        accessibilityHint: `${variant}:${draftText}`,
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

  test.each([0, 24, 34])("reserves %i bottom inset in the Prompt scroll content", async (bottom) => {
    jest.mocked(useSafeAreaInsets).mockReturnValue({
      top: 0, right: 0, bottom, left: 0,
    });
    const screen = await render(<PromptSheetContent active />);

    const { contentContainerStyle } = screen.getByTestId("prompt-scroll").props;
    expect(StyleSheet.flatten(contentContainerStyle)).toMatchObject({
      paddingBottom: 200 + bottom,
    });
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

  it("binds the usage bar to actual prompt token targets", async () => {
    const { getByLabelText } = await render(<PromptComposerCard active />);

    expect(
      getByLabelText("base-token-positive").props.accessibilityHint,
    ).toBe("bar:base");

    await fireEvent.press(getByLabelText("Undesired Content"));
    expect(
      getByLabelText("base-token-negative").props.accessibilityHint,
    ).toBe("bar:negative");

    await fireEvent.press(getByLabelText("Split prompt로 전환"));
    expect(getByLabelText("base-token-positive")).toBeTruthy();
    expect(getByLabelText("base-token-negative")).toBeTruthy();
  });

  it("reports main prompt focus so temporary character editors can close", async () => {
    const onEditorFocus = jest.fn();
    const { getByLabelText } = await render(
      <PromptComposerCard active onEditorFocus={onEditorFocus} />,
    );

    await fireEvent(getByLabelText("Base prompt"), "focus");
    expect(onEditorFocus).toHaveBeenCalledTimes(1);
  });

  it("commits the latest focused prompt before an external action", async () => {
    const { getByLabelText } = await render(
      <GenerationInputCommitProvider>
        <PromptComposerCard active />
        <CommitPendingInputButton />
      </GenerationInputCommitProvider>,
    );
    const input = getByLabelText("Base prompt");

    await fireEvent(input, "focus");
    await fireEvent.changeText(input, "latest prompt");
    expect(useGenerationStore.getState().prompt).toBe("base");

    await fireEvent.press(getByLabelText("Commit pending input"));
    expect(useGenerationStore.getState().prompt).toBe("latest prompt");
  });
});
