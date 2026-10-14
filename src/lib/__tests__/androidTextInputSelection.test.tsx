import { fireEvent, render } from "@testing-library/react-native";
import { Platform, type TextInputProps } from "react-native";

jest.mock(
  "react-native/Libraries/Components/TextInput/AndroidTextInputNativeComponent",
  () => {
    const actual = jest.requireActual(
      "react-native/Libraries/Components/TextInput/AndroidTextInputNativeComponent",
    );
    return {
      ...actual,
      Commands: { ...actual.Commands, setTextAndSelection: jest.fn() },
    };
  },
);

// Exercise the patched input instead of the Jest preset's TextInput mock.
Object.defineProperty(Platform, "OS", { get: () => "android" });
const ActualTextInput: React.ComponentType<TextInputProps> = jest.requireActual(
  "react-native/Libraries/Components/TextInput/TextInput",
).default;
const { setTextAndSelection } = jest.requireMock(
  "react-native/Libraries/Components/TextInput/AndroidTextInputNativeComponent",
).Commands;

const value = "simple background, sitting, ";

beforeEach(() => jest.clearAllMocks());

it("moves the caret without replacing unchanged text and its native spans", async () => {
  const { getByTestId, rerender } = await render(
    <ActualTextInput testID="prompt" value={value} multiline />,
  );
  await fireEvent(getByTestId("prompt"), "selectionChange", {
    nativeEvent: { selection: { start: 4, end: 4 } },
  });
  await rerender(
    <ActualTextInput
      testID="prompt"
      value={value}
      multiline
      selection={{ start: 17, end: 17 }}
    />,
  );
  expect(setTextAndSelection).toHaveBeenLastCalledWith(
    expect.anything(),
    0,
    null,
    17,
    17,
  );
});

it.each(["simple foreground, sitting, ", ""])(
  "updates native text props to %j without an unstyled text command",
  async (nextValue) => {
    const { getByTestId, rerender } = await render(
      <ActualTextInput testID="prompt" value={value} multiline />,
    );
    await rerender(
      <ActualTextInput testID="prompt" value={nextValue} multiline />,
    );
    expect(getByTestId("prompt").props.text).toBe(nextValue);
    expect(setTextAndSelection).not.toHaveBeenCalled();
  },
);

it("still restores text when JS rejects a native edit", async () => {
  const { getByTestId } = await render(
    <ActualTextInput testID="prompt" value={value} multiline />,
  );
  await fireEvent(getByTestId("prompt"), "change", {
    nativeEvent: { text: value + "x", eventCount: 1 },
  });
  expect(setTextAndSelection).toHaveBeenLastCalledWith(
    expect.anything(),
    1,
    value,
    -1,
    -1,
  );
});

it("moves the caret alongside a new value without replacing its styled text", async () => {
  const nextValue = "1.5::simple background::, sitting, ";
  const { getByTestId, rerender } = await render(
    <ActualTextInput testID="prompt" value={value} multiline />,
  );
  await rerender(
    <ActualTextInput
      testID="prompt"
      value={nextValue}
      multiline
      selection={{ start: 21, end: 21 }}
    />,
  );
  expect(getByTestId("prompt").props.text).toBe(nextValue);
  expect(setTextAndSelection).toHaveBeenLastCalledWith(
    expect.anything(),
    0,
    null,
    21,
    21,
  );
});
