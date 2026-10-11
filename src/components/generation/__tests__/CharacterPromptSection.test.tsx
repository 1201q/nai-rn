import { useState } from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import { Keyboard, StyleSheet } from "react-native";

import type { CharacterPrompt } from "../../../store/generationStore";
import { useGenerationStore } from "../../../store/generationStore";
import { CharacterPromptSection } from "../CharacterPromptSection";

const mockEditPositions = jest.fn();

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

// 더 보기 메뉴는 버튼 위치를 잰 뒤에 열린다.
jest.mock("react-native/Libraries/Components/Pressable/Pressable", () => {
  const React = require("react") as typeof import("react");
  const { default: Pressable } = jest.requireActual(
    "react-native/Libraries/Components/Pressable/Pressable",
  );
  return {
    __esModule: true,
    default: React.forwardRef(function MeasuredPressable(props, ref) {
      React.useImperativeHandle(ref, () => ({
        measureInWindow: (
          callback: (x: number, y: number, w: number, h: number) => void,
        ) => callback(300, 200, 40, 40),
      }));
      return React.createElement(Pressable, props);
    }),
  };
});
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("@gorhom/portal", () => ({
  Portal: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock("../../../native/predictiveBack", () => ({
  PREDICTIVE_BACK_SUPPORTED: false,
  usePredictiveBackHandler: jest.fn(),
}));
jest.mock("react-native-reanimated", () => {
  const React = require("react") as typeof import("react");
  const { View } = require("react-native") as typeof import("react-native");
  return {
    __esModule: true,
    default: { View },
    Extrapolation: { CLAMP: "clamp" },
    interpolate: () => 1,
    useSharedValue: <T,>(value: T) => React.useRef({ value }).current,
    useAnimatedStyle: (factory: () => object) => factory(),
    cancelAnimation: jest.fn(),
    withSpring: <T,>(value: T) => value,
    withTiming: <T,>(value: T) => value,
  };
});

jest.mock("../../forms/PromptHighlightTextInput", () => {
  const React = require("react") as typeof import("react");
  const { TextInput } =
    require("react-native") as typeof import("react-native");

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
      onEditPositions={mockEditPositions}
    />
  );
}

describe("CharacterPromptSection", () => {
  beforeEach(() => {
    useGenerationStore.getState().setCharacterPrompts([]);
    useGenerationStore.getState().setCharacterPromptExpandedIds([]);
    useGenerationStore.getState().setCharacterPositionEnabled(false);
    mockEditPositions.mockClear();
  });

  it("adds a character and stores its editable name in the existing name field", async () => {
    const { getByLabelText } = await render(<CharacterPromptSectionHarness />);

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
    expect(
      useGenerationStore.getState().characterPrompts[0].name,
    ).toBeUndefined();
  });

  it("commits the character prompt when switching to undesired content", async () => {
    const { getByLabelText } = await render(<CharacterPromptSectionHarness />);

    await fireEvent.press(getByLabelText("캐릭터 프롬프트 추가, 0 / 6"));
    await fireEvent.changeText(
      getByLabelText("Character 1 prompt"),
      "blue eyes",
    );
    await fireEvent.press(getByLabelText("Character 1 Undesired Content"));

    expect(useGenerationStore.getState().characterPrompts[0].prompt).toBe(
      "blue eyes",
    );
    expect(getByLabelText("character-token-negative")).toBeTruthy();
  });

  it("allows custom positions only from two characters", async () => {
    const { getByLabelText } = await render(<CharacterPromptSectionHarness />);

    await fireEvent.press(getByLabelText("캐릭터 프롬프트 추가, 0 / 6"));
    await fireEvent.press(getByLabelText("Custom position"));
    await fireEvent.press(getByLabelText("캐릭터 위치 편집"));
    await fireEvent.press(getByLabelText("Character 1 위치 지정"));
    expect(useGenerationStore.getState().characterPositionEnabled).toBe(false);
    expect(mockEditPositions).not.toHaveBeenCalled();

    await fireEvent.press(getByLabelText("캐릭터 프롬프트 추가, 1 / 6"));
    const character = useGenerationStore.getState().characterPrompts[1];
    await fireEvent.press(getByLabelText("캐릭터 위치 편집"));
    expect(useGenerationStore.getState().characterPositionEnabled).toBe(true);
    expect(mockEditPositions).toHaveBeenLastCalledWith(null);

    await fireEvent.press(getByLabelText("Character 2 위치 지정"));
    expect(mockEditPositions).toHaveBeenLastCalledWith(character.id);
  });

  it("warns about overlapping custom positions", async () => {
    const { getByLabelText, queryByText } = await render(
      <CharacterPromptSectionHarness />,
    );
    const warning = /캐릭터 위치가 겹치면/;

    await fireEvent.press(getByLabelText("캐릭터 프롬프트 추가, 0 / 6"));
    await fireEvent.press(getByLabelText("캐릭터 프롬프트 추가, 1 / 6"));
    await fireEvent.press(getByLabelText("Custom position"));
    // 새 캐릭터는 겹치지 않는 자리에 놓인다.
    const [first, second] = useGenerationStore.getState().characterPrompts;
    expect(first.position).toEqual({ x: 0.5, y: 0.5 });
    expect(second.position).toEqual({ x: 0.3, y: 0.5 });
    expect(queryByText(warning)).toBeNull();

    await act(() => {
      useGenerationStore
        .getState()
        .setCharacterPrompts([first, { ...second, position: first.position }]);
    });
    expect(queryByText(warning)).toBeTruthy();
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
      StyleSheet.flatten(
        getByTestId(`character-${character.id}-card`).props.style,
      ),
    ).toMatchObject({
      borderColor: "#2B2A30",
      borderWidth: 1,
    });
    expect(
      StyleSheet.flatten(
        getByTestId(`character-${character.id}-content`).props.style,
      ).opacity,
    ).toBe(0.55);
  });

  it("disables edge move items in the more menu", async () => {
    const { getByLabelText } = await render(<CharacterPromptSectionHarness />);

    await fireEvent.press(getByLabelText("캐릭터 프롬프트 추가, 0 / 6"));
    await fireEvent.press(getByLabelText("캐릭터 프롬프트 추가, 1 / 6"));
    await fireEvent.press(getByLabelText("캐릭터 프롬프트 추가, 2 / 6"));

    for (const [character, label, otherLabel] of [
      ["Character 1", "위로 이동", "아래로 이동"],
      ["Character 3", "아래로 이동", "위로 이동"],
    ]) {
      await fireEvent.press(getByLabelText(`${character} 더 보기`));
      expect(
        getByLabelText(`${character} ${label}`).props.accessibilityState
          .disabled,
      ).toBe(true);
      expect(
        getByLabelText(`${character} ${otherLabel}`).props
          .accessibilityState.disabled,
      ).toBe(false);
      await fireEvent.press(getByLabelText(`${character} 메뉴 닫기`));
    }
  });

  it("moves and deletes characters from the more menu", async () => {
    const { getByLabelText, queryByLabelText } = await render(
      <CharacterPromptSectionHarness />,
    );

    await fireEvent.press(getByLabelText("캐릭터 프롬프트 추가, 0 / 6"));
    await fireEvent.press(getByLabelText("캐릭터 프롬프트 추가, 1 / 6"));
    const [first, second] = useGenerationStore.getState().characterPrompts;

    await fireEvent.press(getByLabelText("Character 1 더 보기"));
    await fireEvent.press(getByLabelText("Character 1 아래로 이동"));
    expect(
      useGenerationStore.getState().characterPrompts.map((item) => item.id),
    ).toEqual([second.id, first.id]);
    expect(queryByLabelText("Character 1 메뉴 닫기")).toBeNull();

    await fireEvent.press(getByLabelText("Character 1 더 보기"));
    await fireEvent.press(getByLabelText("Character 1 삭제"));
    expect(
      useGenerationStore.getState().characterPrompts.map((item) => item.id),
    ).toEqual([first.id]);
  });

  it("keeps pinned editors open and collapses only temporary editors on focus change", async () => {
    const dismissKeyboard = jest
      .spyOn(Keyboard, "dismiss")
      .mockImplementation(() => undefined);
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
    expect(
      getByLabelText("character-token-positive").props.accessibilityHint,
    ).toBe("bar");

    await fireEvent.press(getByLabelText("Character 1 편집"));
    expect(dismissKeyboard).toHaveBeenCalledTimes(1);
    expect(getByLabelText("Character 1 prompt")).toBeTruthy();
    expect(getByLabelText("Character 2 prompt")).toBeTruthy();

    await fireEvent(getByLabelText("Character 2 prompt"), "focus");
    expect(queryByLabelText("Character 1 prompt")).toBeNull();
    expect(getByLabelText("Character 2 prompt")).toBeTruthy();
    dismissKeyboard.mockRestore();
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
    useGenerationStore.getState().setCharacterPromptExpandedIds([character.id]);

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

describe("CharacterPromptSection character limit", () => {
  const characters = (count: number): CharacterPrompt[] =>
    Array.from({ length: count }, (_, index) => ({
      id: `c${index}`,
      prompt: `character ${index}`,
      negativePrompt: "",
      enabled: true,
      position: { x: 0.5, y: 0.5 },
    }));

  afterEach(async () => {
    await act(() => {
      useGenerationStore.setState({ model: undefined } as never);
      useGenerationStore.getState().setCharacterPrompts([]);
    });
  });

  it("allows 22 characters on V5", async () => {
    useGenerationStore.setState({ model: "nai-diffusion-5-full" } as never);
    useGenerationStore.getState().setCharacterPrompts(characters(6));
    const { getByLabelText, queryByText } = await render(
      <CharacterPromptSectionHarness />,
    );

    const add = getByLabelText("캐릭터 프롬프트 추가, 6 / 22");
    expect(add.props.accessibilityState.disabled).toBe(false);
    expect(queryByText(/명만 전송됩니다/)).toBeNull();
  });

  it("warns when a 6-character model has more active characters", async () => {
    useGenerationStore.setState({ model: "nai-diffusion-4-5-full" } as never);
    useGenerationStore.getState().setCharacterPrompts(characters(8));
    const { getByLabelText, getByText } = await render(
      <CharacterPromptSectionHarness />,
    );

    const add = getByLabelText("캐릭터 프롬프트 추가, 8 / 6");
    expect(add.props.accessibilityState.disabled).toBe(true);
    expect(
      getByText(
        "현재 모델은 캐릭터를 6명까지 지원합니다. 앞에서부터 6명만 전송됩니다.",
      ),
    ).toBeTruthy();
  });

  it("allows a custom position for a single character on V5", async () => {
    useGenerationStore.setState({ model: "nai-diffusion-5-full" } as never);
    useGenerationStore.getState().setCharacterPrompts(characters(1));
    const { getByLabelText } = await render(<CharacterPromptSectionHarness />);

    await fireEvent.press(getByLabelText("Custom position"));
    await fireEvent.press(getByLabelText("Character 1 위치 지정"));
    expect(useGenerationStore.getState().characterPositionEnabled).toBe(true);
    expect(mockEditPositions).toHaveBeenLastCalledWith("c0");
  });
});
