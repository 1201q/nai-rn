import {
  act,
  fireEvent,
  render,
  renderHook,
} from "@testing-library/react-native";
import { useState } from "react";
import { Platform, type TextInputProps } from "react-native";

import { usePromptAutocomplete } from "../../hooks/usePromptAutocomplete";
import { searchTags } from "../tagDb";

const mockActions = {
  isActive: jest.fn(() => true),
  setActive: jest.fn(),
  clearSuggestions: jest.fn(),
  setSuggestions: jest.fn(),
};

jest.mock("../../context/SuggestionBarContext", () => ({
  useSuggestionBarActions: () => mockActions,
}));
jest.mock("../tagDb", () => ({ searchTags: jest.fn() }));
jest.mock("../storage", () => ({
  storage: { getString: jest.fn(() => undefined), set: jest.fn() },
}));

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

describe("autocomplete during an Android Fabric text update", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("expires the shift guard even when the early acknowledgement is the only event", async () => {
    const picked = {
      label: "simple background",
      value: "simple background",
      type: "general" as const,
      count: 1,
    };
    jest.mocked(searchTags).mockResolvedValue([picked]);
    const inputRef = { current: { focus: jest.fn() } };
    const { result } = await renderHook(() => {
      const [text, setText] = useState("simple, smile, red hair");
      return usePromptAutocomplete({
        value: text,
        onChangeText: setText,
        inputRef,
        channel: "base",
      });
    });
    const select = (offset: number) =>
      act(() =>
        result.current.handleSelectionChange({
          nativeEvent: { selection: { start: offset, end: offset } },
        } as Parameters<typeof result.current.handleSelectionChange>[0]),
      );
    await act(() => result.current.activateSuggestions());
    await select(6);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(150);
    });
    await act(() => mockActions.setSuggestions.mock.calls.at(-1)![2](picked));
    await select(17);
    expect(result.current.selection).toEqual({ start: 17, end: 17 });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(250);
    });
    expect(result.current.selection).toBeUndefined();
    await select(28);
    expect(result.current.selection).toBeUndefined();
  });

  it.each([
    ["simple, smile, red hair, blue eyes", "simple background", true],
    ["simple, smile, red hair, blue eyes", "simple background", false],
    ["simple background, smile, red hair", "sky", true],
    ["simple background, smile, red hair", "sky", false],
    ["simple background, smile", "simple", true],
    ["simple, smile", "very detailed simple background", true],
    ["simple, smile", "very detailed simple background", false],
  ])(
    "restores the completion caret in %j after picking %j (early acknowledgement: %s)",
    async (initial, completion, acknowledgeFirst) => {
      const picked = {
        label: completion,
        value: completion,
        type: "general" as const,
        count: 1,
      };
      jest.mocked(searchTags).mockResolvedValue([picked]);
      const inputRef = { current: { focus: jest.fn() } };
      function Prompt() {
        const [text, setText] = useState(initial);
        const autocomplete = usePromptAutocomplete({
          value: text,
          onChangeText: setText,
          inputRef,
          channel: "base",
        });
        return (
          <ActualTextInput
            testID="prompt"
            value={text}
            selection={autocomplete.selection}
            onFocus={autocomplete.activateSuggestions}
            onChangeText={autocomplete.handleChangeText}
            onSelectionChange={autocomplete.handleSelectionChange}
            multiline
          />
        );
      }
      const { getByTestId } = await render(<Prompt />);
      const select = (start: number) =>
        fireEvent(getByTestId("prompt"), "selectionChange", {
          nativeEvent: { selection: { start, end: start } },
        });
      await fireEvent(getByTestId("prompt"), "focus");
      await select(6);
      await act(async () => {
        await jest.advanceTimersByTimeAsync(150);
      });
      await act(() => mockActions.setSuggestions.mock.calls.at(-1)![2](picked));
      const target = completion.length;
      expect(getByTestId("prompt").props.text).toBe(
        completion + initial.slice(initial.indexOf(",")),
      );

      // Fabric dispatches view commands before mounting the new styled text.
      // ReactEditText first clamps the command to the OLD text length.
      const commandCaret = Math.min(target, initial.length);
      if (acknowledgeFirst) await select(commandCaret);
      // updateExtraData then preserves the gap to the end, shifting it again.
      const delta = completion.length - initial.indexOf(",");
      const shiftedCaret = Math.max(0, commandCaret + delta);
      const callsBeforeShift = setTextAndSelection.mock.calls.length;
      await select(shiftedCaret);
      expect(setTextAndSelection.mock.calls.length).toBeGreaterThan(
        callsBeforeShift,
      );
      expect(setTextAndSelection).toHaveBeenLastCalledWith(
        expect.anything(),
        0,
        null,
        target,
        target,
      );
      await select(target);

      // A real user move and subsequent typing must still work immediately.
      await select(2);
      await act(async () => {
        await jest.advanceTimersByTimeAsync(150);
      });
      expect(searchTags).toHaveBeenLastCalledWith(completion.slice(0, 2), null);
      await fireEvent.changeText(
        getByTestId("prompt"),
        completion.slice(0, 2) +
          "x" +
          completion.slice(2) +
          initial.slice(initial.indexOf(",")),
      );
      expect(getByTestId("prompt").props.text).toContain(
        completion.slice(0, 2) + "x" + completion.slice(2),
      );
    },
  );
});
