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
  "still sends changed text %j to native",
  async (nextValue) => {
    const { rerender } = await render(
      <ActualTextInput testID="prompt" value={value} multiline />,
    );
    await rerender(
      <ActualTextInput testID="prompt" value={nextValue} multiline />,
    );
    expect(setTextAndSelection).toHaveBeenLastCalledWith(
      expect.anything(),
      0,
      nextValue,
      -1,
      -1,
    );
  },
);
