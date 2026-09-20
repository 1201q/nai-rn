import { act, renderHook } from "@testing-library/react-native";
import { useState } from "react";
import type { NativeSyntheticEvent, TextInputSelectionChangeEventData } from "react-native";

import { usePromptAutocomplete } from "../usePromptAutocomplete";
import { searchTags, type TagSuggestion } from "../../lib/tagDb";

const mockActions = {
  setActive: jest.fn(),
  clearSuggestions: jest.fn(),
  setSuggestions: jest.fn(),
};

jest.mock("../../context/SuggestionBarContext", () => ({
  useSuggestionBarActions: () => mockActions,
}));
jest.mock("../../lib/tagDb", () => ({ searchTags: jest.fn() }));

const suggestion: TagSuggestion = {
  label: "simple background", value: "simple background", count: 1, type: "general",
};
const selectionEvent = (start: number, end = start) =>
  ({ nativeEvent: { selection: { start, end } } }) as NativeSyntheticEvent<TextInputSelectionChangeEventData>;

async function setup(initialText = "simple, smile") {
  const inputRef = { current: { focus: jest.fn() } };
  return renderHook(({ channel }: { channel: "base" | "negative" }) => {
    const [value, setValue] = useState(initialText);
    const autocomplete = usePromptAutocomplete({ value, onChangeText: setValue, inputRef, channel });
    return { ...autocomplete, value, setValue };
  }, { initialProps: { channel: "base" as "base" | "negative" } });
}

describe("usePromptAutocomplete", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    jest.mocked(searchTags).mockResolvedValue([suggestion]);
  });
  afterEach(() => jest.useRealTimers());

  it("renders the new text with its caret and ignores the old native position", async () => {
    const { result } = await setup();
    await act(() => result.current.handleSelectionChange(selectionEvent(6)));
    await act(async () => { await jest.advanceTimersByTimeAsync(150); });
    await act(() => mockActions.setSuggestions.mock.calls[0][1](suggestion));

    expect(result.current.value).toBe("simple background, smile");
    expect(result.current.selection).toEqual({ start: 17, end: 17 });
    await act(() => result.current.handleSelectionChange(selectionEvent(6)));
    expect(result.current.selection).toEqual({ start: 17, end: 17 });

    await act(() => result.current.handleSelectionChange(selectionEvent(17)));
    expect(result.current.selection).toBeUndefined();
    await act(async () => { await jest.advanceTimersByTimeAsync(150); });
    expect(searchTags).toHaveBeenCalledTimes(1);

    // A subsequent user caret move must be accepted normally.
    await act(() => result.current.handleSelectionChange(selectionEvent(2)));
    await act(async () => { await jest.advanceTimersByTimeAsync(150); });
    expect(searchTags).toHaveBeenLastCalledWith("si", null);
  });

  it("allows typing even before a selection acknowledgement arrives", async () => {
    const { result } = await setup();
    await act(() => result.current.handleSelectionChange(selectionEvent(6)));
    await act(async () => { await jest.advanceTimersByTimeAsync(150); });
    await act(() => mockActions.setSuggestions.mock.calls[0][1](suggestion));
    await act(() => result.current.handleChangeText("simple backgroundx, smile"));
    expect(result.current.selection).toBeUndefined();
    expect(result.current.value).toBe("simple backgroundx, smile");
  });

  it("does not wait for a caret event when completing an already complete tag", async () => {
    const { result } = await setup("simple background, smile");
    await act(() => result.current.handleSelectionChange(selectionEvent(17)));
    await act(async () => { await jest.advanceTimersByTimeAsync(150); });
    await act(() => mockActions.setSuggestions.mock.calls[0][1](suggestion));
    await act(() => result.current.handleSelectionChange(selectionEvent(2)));
    await act(async () => { await jest.advanceTimersByTimeAsync(150); });
    expect(result.current.selection).toBeUndefined();
    expect(searchTags).toHaveBeenLastCalledWith("si", null);
  });

  it("cancels a pending search on a channel change even with identical text", async () => {
    const { result, rerender } = await setup();
    await act(() => result.current.handleSelectionChange(selectionEvent(6)));
    await rerender({ channel: "negative" });
    await act(async () => { await jest.advanceTimersByTimeAsync(150); });
    expect(searchTags).not.toHaveBeenCalled();
    expect(mockActions.clearSuggestions).toHaveBeenCalled();
  });

  it("discards an in-flight search when its channel is replaced", async () => {
    let resolveSearch!: (items: TagSuggestion[]) => void;
    jest.mocked(searchTags).mockReturnValueOnce(new Promise((resolve) => { resolveSearch = resolve; }));
    const { result, rerender } = await setup();
    await act(() => result.current.handleSelectionChange(selectionEvent(6)));
    await act(async () => { await jest.advanceTimersByTimeAsync(150); });
    await rerender({ channel: "negative" });
    await act(async () => { resolveSearch([suggestion]); });
    expect(mockActions.setSuggestions).not.toHaveBeenCalled();
  });

  it("cancels searches when an external value replaces the draft", async () => {
    const { result } = await setup();
    await act(() => result.current.handleSelectionChange(selectionEvent(6)));
    await act(() => result.current.setValue("lowres"));
    await act(async () => { await jest.advanceTimersByTimeAsync(150); });
    expect(searchTags).not.toHaveBeenCalled();
  });

  it("cancels the debounce on unmount", async () => {
    const { result, unmount } = await setup();
    await act(() => result.current.handleSelectionChange(selectionEvent(6)));
    await unmount();
    await act(async () => { await jest.advanceTimersByTimeAsync(150); });
    expect(searchTags).not.toHaveBeenCalled();
  });
});
