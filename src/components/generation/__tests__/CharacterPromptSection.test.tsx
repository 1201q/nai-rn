import { useState } from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import type { CharacterPrompt } from "../../../store/generationStore";
import { useGenerationStore } from "../../../store/generationStore";
import { CharacterPromptSection } from "../CharacterPromptSection";

const mockOpenCharacterPosition = jest.fn();

jest.mock("../../../context/AppSheetContext", () => ({
  useAppSheet: () => ({
    openCharacterPosition: mockOpenCharacterPosition,
  }),
}));

jest.mock("../../../store/generationStore", () => {
  const { create } = require("zustand") as typeof import("zustand");

  return {
    useGenerationStore: create<{
      characterPrompts: CharacterPrompt[];
      setCharacterPrompts: (value: CharacterPrompt[]) => void;
      characterPromptExpandedIds: string[];
      setCharacterPromptExpandedIds: (value: string[]) => void;
      characterPositionEnabled: boolean;
      setCharacterPositionEnabled: (value: boolean) => void;
    }>((set) => ({
      characterPrompts: [],
      setCharacterPrompts: (characterPrompts) => set({ characterPrompts }),
      characterPromptExpandedIds: [],
      setCharacterPromptExpandedIds: (characterPromptExpandedIds) =>
        set({ characterPromptExpandedIds }),
      characterPositionEnabled: false,
      setCharacterPositionEnabled: (characterPositionEnabled) =>
        set({ characterPositionEnabled }),
    })),
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
      variant,
    }: {
      target: { channel: "positive" | "negative" };
      variant?: "ring" | "bar";
    }) =>
      React.createElement(View, {
        accessibilityLabel: `character-token-${target.channel}`,
        accessibilityHint: variant,
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

function CharacterPromptSectionHarness() {
  const [editingCharacterId, setEditingCharacterId] = useState<string | null>(
    null,
  );
  return (
    <CharacterPromptSection
      active
      editingCharacterId={editingCharacterId}
      onEditingCharacterChange={setEditingCharacterId}
    />
  );
}

describe("CharacterPromptSection", () => {
  beforeEach(() => {
    useGenerationStore.getState().setCharacterPrompts([]);
    useGenerationStore.getState().setCharacterPromptExpandedIds([]);
    useGenerationStore.getState().setCharacterPositionEnabled(false);
    mockOpenCharacterPosition.mockClear();
  });

  it("adds a character and stores its editable name in the existing name field", async () => {
    const { getByLabelText } = await render(
      <CharacterPromptSectionHarness />,
    );

    await fireEvent.press(getByLabelText("캐릭터 프롬프트 추가, 0 / 6"));
    expect(getByLabelText("Character 1 Prompt")).toBeTruthy();
    const nameInput = getByLabelText("Character 1 이름");

    await fireEvent.changeText(nameInput, "Alice");
    await fireEvent(nameInput, "blur");
    expect(useGenerationStore.getState().characterPrompts[0].name).toBe(
      "Alice",
    );

    await fireEvent.changeText(nameInput, "   ");
    await fireEvent(nameInput, "blur");
    expect(useGenerationStore.getState().characterPrompts[0].name).toBeUndefined();
  });

  it("commits the character prompt when switching to undesired content", async () => {
    const { getByLabelText } = await render(
      <CharacterPromptSectionHarness />,
    );

    await fireEvent.press(getByLabelText("캐릭터 프롬프트 추가, 0 / 6"));
    await fireEvent.changeText(
      getByLabelText("Character 1 prompt"),
      "blue eyes",
    );
    await fireEvent.press(
      getByLabelText("Character 1 Undesired Content"),
    );

    expect(useGenerationStore.getState().characterPrompts[0].prompt).toBe(
      "blue eyes",
    );
    expect(getByLabelText("character-token-negative")).toBeTruthy();
  });

  it("enables custom positions before opening the existing position sheet", async () => {
    const { getByLabelText, queryByLabelText } = await render(
      <CharacterPromptSectionHarness />,
    );

    await fireEvent.press(getByLabelText("캐릭터 프롬프트 추가, 0 / 6"));
    const character = useGenerationStore.getState().characterPrompts[0];
    expect(queryByLabelText("Character 1 복사")).toBeNull();
    await fireEvent.press(getByLabelText("Character 1 위치 지정"));

    expect(
      useGenerationStore.getState().characterPositionEnabled,
    ).toBe(true);
    expect(mockOpenCharacterPosition).toHaveBeenCalledWith(character.id);
  });

  it("opens a collapsed editor only from its prompt content", async () => {
    const { getByLabelText, queryByLabelText } = await render(
      <CharacterPromptSectionHarness />,
    );

    await fireEvent.press(getByLabelText("캐릭터 프롬프트 추가, 0 / 6"));
    await fireEvent.press(getByLabelText("Character 1 접기"));

    await fireEvent(getByLabelText("Character 1 이름"), "focus");
    expect(queryByLabelText("Character 1 prompt")).toBeNull();

    await fireEvent.press(getByLabelText("Character 1 편집"));
    expect(getByLabelText("Character 1 prompt")).toBeTruthy();
  });

  it("keeps the card border unchanged when the character is disabled", async () => {
    const { getByLabelText, getByTestId } = await render(
      <CharacterPromptSectionHarness />,
    );

    await fireEvent.press(getByLabelText("캐릭터 프롬프트 추가, 0 / 6"));
    const character = useGenerationStore.getState().characterPrompts[0];
    await fireEvent.press(getByLabelText("Character 1 활성화"));

    expect(
      StyleSheet.flatten(getByTestId(`character-${character.id}-card`).props.style),
    ).toMatchObject({
      borderColor: "#2B2A30",
      borderWidth: 1,
    });
    expect(
      StyleSheet.flatten(
        getByTestId(`character-${character.id}-content`).props.style,
      ).opacity,
    ).toBe(0.55);

    const dividerLabels = [
      "Character 1 위로 이동",
      "Character 1 아래로 이동",
      "Character 1 활성화",
      "Character 1 삭제",
      "Character 1 접기",
    ];
    for (const label of dividerLabels) {
      expect(
        StyleSheet.flatten(getByLabelText(label).props.style).borderLeftColor,
      ).toBe("#2B2A30");
    }
  });

  it("keeps edge move-button dividers opaque", async () => {
    const { getByLabelText } = await render(
      <CharacterPromptSectionHarness />,
    );

    await fireEvent.press(getByLabelText("캐릭터 프롬프트 추가, 0 / 6"));
    await fireEvent.press(getByLabelText("캐릭터 프롬프트 추가, 1 / 6"));
    await fireEvent.press(getByLabelText("캐릭터 프롬프트 추가, 2 / 6"));

    const disabledMoveLabels = [
      "Character 1 위로 이동",
      "Character 3 아래로 이동",
    ];
    for (const label of disabledMoveLabels) {
      const style = StyleSheet.flatten(getByLabelText(label).props.style);
      expect(style.borderLeftColor).toBe("#2B2A30");
      expect(style.opacity).toBeUndefined();
    }
  });

  it("keeps pinned editors open and collapses only temporary editors on focus change", async () => {
    const { getByLabelText, getByText, queryByLabelText } = await render(
      <CharacterPromptSectionHarness />,
    );

    await fireEvent.press(getByLabelText("캐릭터 프롬프트 추가, 0 / 6"));
    await fireEvent.changeText(
      getByLabelText("Character 1 prompt"),
      "blue eyes",
    );
    await fireEvent.press(getByLabelText("캐릭터 프롬프트 추가, 1 / 6"));

    expect(getByLabelText("Character 1 prompt")).toBeTruthy();
    expect(getByLabelText("Character 2 prompt")).toBeTruthy();

    await fireEvent.press(getByLabelText("Character 1 접기"));
    expect(queryByLabelText("Character 1 prompt")).toBeNull();
    expect(getByText("blue eyes").props.numberOfLines).toBe(1);
    expect(getByLabelText("character-token-positive").props.accessibilityHint).toBe(
      "bar",
    );

    await fireEvent.press(getByLabelText("Character 1 편집"));
    expect(getByLabelText("Character 1 prompt")).toBeTruthy();
    expect(getByLabelText("Character 2 prompt")).toBeTruthy();

    await fireEvent(getByLabelText("Character 2 prompt"), "focus");
    expect(queryByLabelText("Character 1 prompt")).toBeNull();
    expect(getByLabelText("Character 2 prompt")).toBeTruthy();
  });

  it("keeps the larger editor height when switching prompt channels", async () => {
    const character: CharacterPrompt = {
      id: "character-height",
      prompt: "short prompt",
      negativePrompt: "long negative prompt",
      enabled: true,
      position: { x: 0.5, y: 0.5 },
    };
    useGenerationStore.getState().setCharacterPrompts([character]);
    useGenerationStore
      .getState()
      .setCharacterPromptExpandedIds([character.id]);

    const { getByLabelText, getByTestId } = await render(
      <CharacterPromptSectionHarness />,
    );

    await fireEvent(
      getByTestId("character-character-height-base-measure"),
      "textLayout",
      { nativeEvent: { lines: Array.from({ length: 2 }, () => ({})) } },
    );
    await fireEvent(
      getByTestId("character-character-height-negative-measure"),
      "textLayout",
      { nativeEvent: { lines: Array.from({ length: 5 }, () => ({})) } },
    );

    const baseInput = getByLabelText("Character 1 prompt");
    expect(StyleSheet.flatten(baseInput.props.style).height).toBe("100%");
    expect(
      StyleSheet.flatten(
        getByTestId("character-character-height-input-frame").props.style,
      ).height,
    ).toBe(127);

    await fireEvent.press(getByLabelText("Character 1 Undesired Content"));
    const negativeInput = getByLabelText("Character 1 undesired content");
    expect(StyleSheet.flatten(negativeInput.props.style).height).toBe("100%");
  });
});
