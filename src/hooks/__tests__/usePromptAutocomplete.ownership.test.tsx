import { act, renderHook } from "@testing-library/react-native";
import { useState, type ReactNode } from "react";
import type { NativeSyntheticEvent, TextInputSelectionChangeEventData } from "react-native";
import { SuggestionBarProvider, useSuggestionBarActions, useSuggestions } from "../../context/SuggestionBarContext";
import { searchTags, type TagSuggestion } from "../../lib/tagDb";
import { usePromptAutocomplete } from "../usePromptAutocomplete";

jest.mock("../../lib/tagDb", () => ({ searchTags: jest.fn() }));

const suggestion: TagSuggestion = {
  label: "simple background", value: "simple background", count: 1, type: "general",
};
const selectionEvent = (start: number) =>
  ({ nativeEvent: { selection: { start, end: start } } }) as NativeSyntheticEvent<TextInputSelectionChangeEventData>;
const wrapper = ({ children }: { children: ReactNode }) => <SuggestionBarProvider>{children}</SuggestionBarProvider>;

function useEditor(initial: string) {
  const [value, setValue] = useState(initial);
  const ac = usePromptAutocomplete({ value, onChangeText: setValue, inputRef: { current: null }, channel: "base" });
  return { ...ac, value, setValue };
}

async function setup() {
  return renderHook(() => ({
    first: useEditor("simple"),
    second: useEditor("smile"),
    suggestions: useSuggestions(),
    actions: useSuggestionBarActions()!,
  }), { wrapper });
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  jest.mocked(searchTags).mockResolvedValue([suggestion]);
});
afterEach(() => jest.useRealTimers());

it("does not let an inactive editor clear or deactivate the active editor's suggestions", async () => {
  const { result } = await setup();
  await act(() => result.current.first.activateSuggestions());
  await act(() => result.current.first.handleSelectionChange(selectionEvent(6)));
  await act(async () => { await jest.advanceTimersByTimeAsync(150); });
  await act(() => result.current.second.deactivateSuggestions());
  await act(() => result.current.second.setValue("changed externally"));
  expect(result.current.suggestions).toEqual([suggestion]);
  await act(() => result.current.actions.pickRef.current?.(suggestion));
  expect(result.current.first.value).toBe("simple background, ");
  expect(result.current.second.value).toBe("changed externally");
});

it("rejects a previous editor's delayed result after focus transfers, even before blur", async () => {
  let resolve!: (items: TagSuggestion[]) => void;
  jest.mocked(searchTags).mockReturnValueOnce(new Promise(r => { resolve = r; }));
  const { result } = await setup();
  await act(() => result.current.first.activateSuggestions());
  await act(() => result.current.first.handleSelectionChange(selectionEvent(6)));
  await act(async () => { await jest.advanceTimersByTimeAsync(150); });
  await act(() => result.current.second.activateSuggestions());
  await act(() => result.current.second.handleSelectionChange(selectionEvent(5)));
  await act(() => result.current.first.deactivateSuggestions());
  await act(async () => { await jest.advanceTimersByTimeAsync(150); });
  const secondPick = result.current.actions.pickRef.current;
  await act(async () => { resolve([{ ...suggestion, value: "old result" }]); });
  expect(result.current.suggestions).toEqual([suggestion]);
  expect(result.current.actions.pickRef.current).toBe(secondPick);
  await act(() => result.current.actions.pickRef.current?.(suggestion));
  expect(result.current.first.value).toBe("simple");
  expect(result.current.second.value).toBe("simple background, ");
});

it("invalidates a displayed callback when another editor takes ownership", async () => {
  const { result } = await setup();
  await act(() => result.current.first.activateSuggestions());
  await act(() => result.current.first.handleSelectionChange(selectionEvent(6)));
  await act(async () => { await jest.advanceTimersByTimeAsync(150); });
  const oldPick = result.current.actions.pickRef.current!;
  await act(() => result.current.second.activateSuggestions());
  expect(result.current.suggestions).toEqual([]);
  await act(() => oldPick(suggestion));
  await act(() => result.current.first.handleSelectionChange(selectionEvent(3)));
  await act(async () => { await jest.advanceTimersByTimeAsync(150); });
  expect(result.current.first.value).toBe("simple");
  expect(searchTags).toHaveBeenCalledTimes(1);
});
