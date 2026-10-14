import { act, render } from "@testing-library/react-native";
import { Text } from "react-native";

import {
  SuggestionBarProvider,
  useSuggestionBarActions,
  useSuggestions,
  type PromptSuggestion,
} from "../SuggestionBarContext";

test("clearing empty suggestions skips consumer renders and still releases the pick callback", async () => {
  const owner = Symbol("input");
  const otherOwner = Symbol("other-input");
  const renderSuggestions = jest.fn();
  let actions: NonNullable<ReturnType<typeof useSuggestionBarActions>>;
  function ActionsProbe() {
    actions = useSuggestionBarActions()!;
    return null;
  }
  function SuggestionsProbe() {
    const suggestions = useSuggestions();
    renderSuggestions(suggestions);
    return <Text>{suggestions.map((item) => item.label).join(", ")}</Text>;
  }

  const screen = await render(
    <SuggestionBarProvider>
      <ActionsProbe />
      <SuggestionsProbe />
    </SuggestionBarProvider>,
  );
  await act(() => actions.setActive(owner, true));
  renderSuggestions.mockClear();

  await act(() => actions.clearSuggestions(owner));
  await act(() => actions.clearSuggestions(owner));
  expect(renderSuggestions).not.toHaveBeenCalled();

  const pick = jest.fn();
  const suggestions: PromptSuggestion[] = [
    { type: "chunk", label: "Portrait", value: "@portrait", color: "#ffffff" },
  ];
  await act(() => actions.setSuggestions(owner, suggestions, pick));
  expect(screen.getByText("Portrait")).toBeTruthy();
  expect(actions!.pickRef.current).toBe(pick);
  renderSuggestions.mockClear();

  await act(() => actions.clearSuggestions(otherOwner));
  expect(renderSuggestions).not.toHaveBeenCalled();
  expect(actions!.pickRef.current).toBe(pick);

  await act(() => actions.clearSuggestions(owner));
  expect(renderSuggestions).toHaveBeenCalledTimes(1);
  expect(renderSuggestions).toHaveBeenLastCalledWith([]);
  expect(actions!.pickRef.current).toBeNull();
  renderSuggestions.mockClear();

  await act(() => actions.setSuggestions(owner, [], pick));
  expect(actions!.pickRef.current).toBe(pick);
  renderSuggestions.mockClear();
  await act(() => actions.clearSuggestions(owner));
  expect(renderSuggestions).not.toHaveBeenCalled();
  expect(actions!.pickRef.current).toBeNull();
});
