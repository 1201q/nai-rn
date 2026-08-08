import { fireEvent, render } from "@testing-library/react-native";

import { PromptEditor } from "../FormControls";

jest.mock("../Slider", () => {
  const React = require("react") as typeof import("react");
  const { View } = require("react-native") as typeof import("react-native");

  return {
    Slider: () => React.createElement(View),
  };
});

jest.mock("react-native-reanimated", () => {
  const { Text, View } = require("react-native") as typeof import("react-native");

  return {
    __esModule: true,
    default: {
      View,
      Text,
      createAnimatedComponent: (Component: React.ElementType) => Component,
    },
    Easing: {
      cubic: jest.fn(),
      out: jest.fn((value) => value),
    },
    interpolate: (
      _value: number,
      _input: number[],
      output: number[],
    ) => output[0],
    useAnimatedProps: (factory: () => object) => factory(),
    useAnimatedStyle: (factory: () => object) => factory(),
    useSharedValue: (value: unknown) => ({ value }),
    withTiming: (value: unknown) => value,
  };
});

jest.mock("../PromptHighlightTextInput", () => {
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

jest.mock("../PromptTokenCounter", () => {
  const React = require("react") as typeof import("react");
  const { View } = require("react-native") as typeof import("react-native");

  return {
    PromptTokenCounter: ({
      target,
    }: {
      target: { channel: "positive" | "negative" };
    }) =>
      React.createElement(View, {
        accessibilityLabel: `token-${target.channel}`,
      }),
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

describe("PromptEditor", () => {
  it("switches the input and token target between base and negative", async () => {
    const { getByLabelText, queryByLabelText } = await render(
      <PromptEditor
        prompt="base"
        negativePrompt="negative"
        onCommitPrompt={jest.fn()}
        onCommitNegativePrompt={jest.fn()}
      />,
    );

    expect(getByLabelText("Base prompt").props.value).toBe("base");
    expect(getByLabelText("token-positive")).toBeTruthy();

    await fireEvent.press(getByLabelText("Negative"));

    expect(queryByLabelText("Base prompt")).toBeNull();
    expect(getByLabelText("Negative prompt").props.value).toBe("negative");
    expect(getByLabelText("token-negative")).toBeTruthy();
  });

  it("commits the active draft before switching modes", async () => {
    const onCommitPrompt = jest.fn();
    const { getByLabelText } = await render(
      <PromptEditor
        prompt="before"
        negativePrompt="negative"
        onCommitPrompt={onCommitPrompt}
        onCommitNegativePrompt={jest.fn()}
      />,
    );

    await fireEvent.changeText(getByLabelText("Base prompt"), "after");
    await fireEvent.press(getByLabelText("Negative"));

    expect(onCommitPrompt).toHaveBeenCalledWith("after");
  });
});
