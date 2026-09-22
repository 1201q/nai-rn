import { act, renderHook } from "@testing-library/react-native";
import { useState } from "react";
import type { NativeSyntheticEvent, TextInputSelectionChangeEventData } from "react-native";

import { usePromptAutocomplete } from "../usePromptAutocomplete";
import { searchTags, type TagSuggestion } from "../../lib/tagDb";

const mockActions = {
  isActive: jest.fn(() => true),
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
  const hook = await renderHook(({ channel }: { channel: "base" | "negative" }) => {
    const [value, setValue] = useState(initialText);
    const autocomplete = usePromptAutocomplete({ value, onChangeText: setValue, inputRef, channel });
    return { ...autocomplete, value, setValue };
  }, { initialProps: { channel: "base" as "base" | "negative" } });
  await act(() => hook.result.current.activateSuggestions());
  return hook;
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
    await act(() => mockActions.setSuggestions.mock.calls[0][2](suggestion));

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
    const { result } = await setup("simple");
    await act(() => result.current.handleSelectionChange(selectionEvent(6)));
    await act(async () => { await jest.advanceTimersByTimeAsync(150); });
    await act(() => mockActions.setSuggestions.mock.calls[0][2](suggestion));
    expect(result.current.selection).toEqual({ start: 19, end: 19 });
    await act(() => result.current.handleChangeText("simple background, x"));
    expect(result.current.selection).toBeUndefined();
    expect(result.current.value).toBe("simple background, x");
  });

  it("does not wait for a caret event when completing an already complete tag", async () => {
    const { result } = await setup("simple background, smile");
    await act(() => result.current.handleSelectionChange(selectionEvent(17)));
    await act(async () => { await jest.advanceTimersByTimeAsync(150); });
    await act(() => mockActions.setSuggestions.mock.calls[0][2](suggestion));
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

  it.each([
    ["depth of field, downblouse", 0],
    ["smile, depth of field", 7],
    ["-1::sky::", 0],
    ["smile, 1.5::sky, -1::clouds::::", 7],
    ["{sky}", 0],
    ["{sky}", 1],
    ["girl", 0],
  ])("inserts before existing text in %j", async (initial, caret) => {
    jest.mocked(searchTags).mockResolvedValue([{ ...suggestion, value: "1girl" }]);
    const { result } = await setup(initial);
    await act(() => result.current.handleSelectionChange(selectionEvent(caret)));
    for (const query of ["g", "gi", "gir"]) {
      await act(() => result.current.handleChangeText(initial.slice(0, caret) + query + initial.slice(caret)));
      await act(() => result.current.handleSelectionChange(selectionEvent(caret + query.length)));
    }
    await act(async () => { await jest.advanceTimersByTimeAsync(150); });
    const pick = mockActions.setSuggestions.mock.calls.at(-1)![2];
    await act(() => pick({ ...suggestion, value: "1girl" }));
    expect(result.current.value).toBe(initial.slice(0, caret) + "1girl, " + initial.slice(caret));
    expect(result.current.selection).toEqual({ start: caret + 7, end: caret + 7 });
  });

  it("keeps the insertion range when selection events precede text events", async () => {
    const { result } = await setup("depth of field");
    for (const query of ["g", "gi", "gir"]) {
      await act(() => result.current.handleSelectionChange(selectionEvent(query.length)));
      await act(() => result.current.handleChangeText(query + "depth of field"));
    }
    await act(async () => { await jest.advanceTimersByTimeAsync(150); });
    await act(() => mockActions.setSuggestions.mock.calls.at(-1)![2](suggestion));
    expect(result.current.value).toBe("simple background, depth of field");
  });

  it("still replaces the suffix when editing the middle of an existing tag", async () => {
    const { result } = await setup("simple foreground, smile");
    await act(() => result.current.handleSelectionChange(selectionEvent(6)));
    await act(() => result.current.handleChangeText("simplex foreground, smile"));
    await act(async () => { await jest.advanceTimersByTimeAsync(150); });
    await act(() => mockActions.setSuggestions.mock.calls.at(-1)![2](suggestion));
    expect(result.current.value).toBe("simple background, smile");
  });

  it("ends a previous typing range when the user moves to insert between tags", async () => {
    jest.mocked(searchTags).mockResolvedValue([{ ...suggestion, value: "1girl" }]);
    const { result } = await setup("");
    await act(() => result.current.handleChangeText("smile, depth of field"));
    await act(() => result.current.handleSelectionChange(selectionEvent(20)));
    await act(() => result.current.handleSelectionChange(selectionEvent(7)));
    await act(() => result.current.handleChangeText("smile, 1girdepth of field"));
    await act(() => result.current.handleSelectionChange(selectionEvent(11)));
    await act(async () => { await jest.advanceTimersByTimeAsync(150); });
    await act(() => mockActions.setSuggestions.mock.calls.at(-1)![2]({ ...suggestion, value: "1girl" }));
    expect(result.current.value).toBe("smile, 1girl, depth of field");
  });

  it("clears old suggestions immediately and refuses their callback after a caret move", async () => {
    const { result } = await setup();
    await act(() => result.current.handleSelectionChange(selectionEvent(6)));
    await act(async () => { await jest.advanceTimersByTimeAsync(150); });
    const pick = mockActions.setSuggestions.mock.calls.at(-1)![2];
    mockActions.clearSuggestions.mockClear();
    await act(() => result.current.handleSelectionChange(selectionEvent(13)));
    expect(mockActions.clearSuggestions).toHaveBeenCalled();
    await act(() => pick(suggestion));
    expect(result.current.value).toBe("simple, smile");
  });

  it("refreshes searches without a caret event and discards the earlier result", async () => {
    let resolve!: (items: TagSuggestion[]) => void;
    jest.mocked(searchTags).mockReturnValueOnce(new Promise(r => { resolve = r; }));
    const { result } = await setup("blue");
    await act(() => result.current.handleSelectionChange(selectionEvent(4)));
    await act(async () => { await jest.advanceTimersByTimeAsync(150); });
    await act(() => result.current.handleChangeText("blur"));
    await act(async () => { resolve([suggestion]); });
    expect(mockActions.setSuggestions).not.toHaveBeenCalled();
    await act(async () => { await jest.advanceTimersByTimeAsync(150); });
    expect(searchTags).toHaveBeenLastCalledWith("blur", null);
    expect(mockActions.setSuggestions).toHaveBeenCalledTimes(1);
  });

  it("releases selection even if native acknowledgement never arrives", async () => {
    const { result } = await setup();
    await act(() => result.current.handleSelectionChange(selectionEvent(6)));
    await act(async () => { await jest.advanceTimersByTimeAsync(150); });
    await act(() => mockActions.setSuggestions.mock.calls.at(-1)![2](suggestion));
    await act(async () => { await jest.advanceTimersByTimeAsync(250); });
    expect(result.current.selection).toBeUndefined();
    await act(() => result.current.handleSelectionChange(selectionEvent(6)));
    await act(async () => { await jest.advanceTimersByTimeAsync(150); });
    expect(searchTags).toHaveBeenCalledTimes(2);
  });

  it("accepts a user caret move before native acknowledgement", async () => {
    const { result } = await setup();
    await act(() => result.current.handleSelectionChange(selectionEvent(6)));
    await act(async () => { await jest.advanceTimersByTimeAsync(150); });
    await act(() => mockActions.setSuggestions.mock.calls.at(-1)![2](suggestion));
    await act(() => result.current.handleSelectionChange(selectionEvent(2)));
    expect(result.current.selection).toBeUndefined();
    await act(async () => { await jest.advanceTimersByTimeAsync(150); });
    expect(searchTags).toHaveBeenLastCalledWith("si", null);
  });

  it("ignores late selection events and picks after blur", async () => {
    const { result } = await setup();
    await act(() => result.current.handleSelectionChange(selectionEvent(6)));
    await act(async () => { await jest.advanceTimersByTimeAsync(150); });
    const pick = mockActions.setSuggestions.mock.calls.at(-1)![2];
    await act(() => result.current.deactivateSuggestions());
    await act(() => result.current.handleSelectionChange(selectionEvent(13)));
    await act(() => pick(suggestion));
    await act(async () => { await jest.advanceTimersByTimeAsync(150); });
    expect(searchTags).toHaveBeenCalledTimes(1);
    expect(result.current.value).toBe("simple, smile");
  });

  it("handles a failed search without publishing suggestions", async () => {
    jest.mocked(searchTags).mockRejectedValueOnce(new Error("database unavailable"));
    const { result } = await setup();
    await act(() => result.current.handleSelectionChange(selectionEvent(6)));
    await act(async () => { await jest.advanceTimersByTimeAsync(150); });
    expect(mockActions.setSuggestions).not.toHaveBeenCalled();
  });

  it("rejects a chip from a superseded result list", async () => {
    const { result } = await setup();
    await act(() => result.current.handleSelectionChange(selectionEvent(6)));
    await act(async () => { await jest.advanceTimersByTimeAsync(150); });
    await act(() => mockActions.setSuggestions.mock.calls.at(-1)![2]({ ...suggestion, value: "unrelated old chip" }));
    expect(result.current.value).toBe("simple, smile");
  });

  it("accepts a repeated old position rather than blocking it indefinitely", async () => {
    const { result } = await setup();
    await act(() => result.current.handleSelectionChange(selectionEvent(6)));
    await act(async () => { await jest.advanceTimersByTimeAsync(150); });
    await act(() => mockActions.setSuggestions.mock.calls.at(-1)![2](suggestion));
    await act(() => result.current.handleSelectionChange(selectionEvent(6)));
    await act(() => result.current.handleSelectionChange(selectionEvent(6)));
    expect(result.current.selection).toBeUndefined();
    await act(async () => { await jest.advanceTimersByTimeAsync(150); });
    expect(searchTags).toHaveBeenCalledTimes(2);
  });
});
