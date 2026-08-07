import { fireEvent, render } from "@testing-library/react-native";

import { CharacterCard } from "../CharacterCard";

jest.mock("react-native-reanimated", () => {
  const { Text, View } = require("react-native") as typeof import("react-native");
  const animation = {
    duration: () => animation,
    easing: () => animation,
  };

  return {
    __esModule: true,
    default: {
      View,
      Text,
      createAnimatedComponent: (Component: React.ElementType) => Component,
    },
    Easing: { cubic: jest.fn(), in: jest.fn((value) => value), out: jest.fn((value) => value) },
    FadeIn: animation,
    ZoomIn: animation,
    interpolate: (_value: number, _input: number[], output: number[]) => output[0],
    interpolateColor: (_value: number, _input: number[], output: string[]) => output[0],
    useAnimatedProps: (factory: () => object) => factory(),
    useAnimatedStyle: (factory: () => object) => factory(),
    useSharedValue: (value: unknown) => ({ value }),
    withTiming: (value: unknown) => value,
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

jest.mock("../../forms/FormControls", () => {
  const React = require("react") as typeof import("react");
  const { View } = require("react-native") as typeof import("react-native");

  return {
    Toggle: ({ label }: { label: string }) =>
      React.createElement(View, { accessibilityLabel: label }),
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

describe("CharacterCard prompt drafts", () => {
  it("commits the latest prompt when the card unmounts", async () => {
    const onUpdate = jest.fn();
    const { getByLabelText, unmount } = await render(
      <CharacterCard
        item={{
          id: "character-1",
          prompt: "before",
          negativePrompt: "negative",
          enabled: true,
          position: { x: 0.5, y: 0.5 },
        }}
        index={0}
        expanded
        positionEnabled={false}
        canCopy
        canReorder={false}
        onToggleExpand={jest.fn()}
        onUpdate={onUpdate}
        onCopy={jest.fn()}
        onDelete={jest.fn()}
        onOpenOrder={jest.fn()}
        onOpenPosition={jest.fn()}
      />,
    );

    await fireEvent.changeText(getByLabelText("Base prompt"), "after");
    await unmount();

    expect(onUpdate).toHaveBeenCalledWith("character-1", {
      prompt: "after",
    });
  });
});
