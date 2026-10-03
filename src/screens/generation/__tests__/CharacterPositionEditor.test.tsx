import { act, fireEvent, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { tokens } from "../../../styles/tokens";
import { CharacterPositionEditor } from "../CharacterPositionEditor";

type PanHandlers = {
  onBegin?: () => void;
  onUpdate?: (event: { translationX: number; translationY: number }) => void;
  onEnd?: () => void;
};

const mockPans: PanHandlers[] = [];

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock("expo-image", () => {
  const { View } = require("react-native") as typeof import("react-native");
  return {
    Image: (props: object) => <View {...props} testID="position-backdrop" />,
  };
});
jest.mock("react-native-gesture-handler", () => ({
  Gesture: {
    Pan: () => {
      const handlers: PanHandlers = {};
      mockPans.push(handlers);
      const pan = {
        maxPointers: () => pan,
        onBegin: (handler: PanHandlers["onBegin"]) => {
          handlers.onBegin = handler;
          return pan;
        },
        onUpdate: (handler: PanHandlers["onUpdate"]) => {
          handlers.onUpdate = handler;
          return pan;
        },
        onEnd: (handler: PanHandlers["onEnd"]) => {
          handlers.onEnd = handler;
          return pan;
        },
      };
      return pan;
    },
  },
  GestureDetector: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("react-native-reanimated", () => {
  const React = require("react") as typeof import("react");
  const { View } = require("react-native") as typeof import("react-native");
  return {
    __esModule: true,
    default: { View },
    runOnJS: (callback: unknown) => callback,
    useSharedValue: <T,>(value: T) => React.useRef({ value }).current,
    useAnimatedStyle: (factory: () => object) => factory(),
  };
});
jest.mock("../../../lib/generationHistory", () => ({
  resolveGenerationImageUri: ({ imagePath }: { imagePath: string }) =>
    `file:///${imagePath}`,
}));

const mockSetPosition = jest.fn();
const mockGenerationState = {
  model: "nai-diffusion-5-full",
  characterPrompts: [
    {
      id: "a",
      prompt: "girl",
      negativePrompt: "",
      enabled: true,
      position: { x: 0.5, y: 0.5 },
    },
    {
      id: "b",
      prompt: "boy",
      negativePrompt: "",
      enabled: true,
      position: { x: 0.1, y: 0.1 },
    },
  ],
  setCharacterPromptPosition: mockSetPosition,
  resolution: { width: 832, height: 1216 },
  currentGeneration: null as {
    imagePath: string;
    width: number;
    height: number;
  } | null,
  mainImageBlurred: false,
};
jest.mock("../../../store/generationStore", () => {
  const useGenerationStore = (selector: (state: object) => unknown) =>
    selector(mockGenerationState);
  useGenerationStore.getState = () => mockGenerationState;
  return { useGenerationStore };
});

async function renderEditor() {
  const screen = await render(
    <CharacterPositionEditor initialCharacterId="a" onFinish={jest.fn()} />,
  );
  if (screen.queryByTestId("position-area")) {
    // 832:1216 해상도는 416x608 영역을 꽉 채운다.
    await fireEvent(screen.getByTestId("position-area"), "layout", {
      nativeEvent: { layout: { width: 416, height: 608 } },
    });
  }
  return screen;
}

beforeEach(() => {
  mockPans.length = 0;
  mockSetPosition.mockClear();
  mockGenerationState.model = "nai-diffusion-5-full";
  mockGenerationState.currentGeneration = null;
});

describe("CharacterPositionEditor", () => {
  test("keeps the 5x5 grid for models before V5", async () => {
    mockGenerationState.model = "nai-diffusion-4-5-full";
    const screen = await renderEditor();

    expect(screen.getByLabelText("X 0.5, Y 0.5")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("X 0.1, Y 0.9"));
    expect(mockSetPosition).toHaveBeenCalledWith("a", 0.1, 0.9);
  });

  test("V5 drags markers freely and commits once on release", async () => {
    const screen = await renderEditor();
    expect(screen.queryByLabelText("X 0.5, Y 0.5")).toBeNull();

    const pan = mockPans[mockPans.length - 2];
    await act(async () => {
      pan.onBegin?.();
      pan.onUpdate?.({ translationX: 50, translationY: -152 });
      pan.onUpdate?.({ translationX: 100, translationY: -152 });
    });
    expect(mockSetPosition).not.toHaveBeenCalled();

    await act(async () => pan.onEnd?.());
    expect(mockSetPosition).toHaveBeenCalledTimes(1);
    expect(mockSetPosition).toHaveBeenCalledWith("a", 0.74, 0.25);
  });

  test("V5 keeps dragged markers inside the board", async () => {
    await renderEditor();

    const pan = mockPans[mockPans.length - 1];
    await act(async () => {
      pan.onBegin?.();
      pan.onUpdate?.({ translationX: 9999, translationY: -9999 });
      pan.onEnd?.();
    });
    expect(mockSetPosition).toHaveBeenCalledWith("b", 1, 0);
  });

  test("V5 marks markers that come close to each other in red", async () => {
    const screen = await renderEditor();
    const borderColor = (label: string) =>
      StyleSheet.flatten(screen.getByLabelText(label).props.style).borderColor;
    expect(borderColor("Character 1 위치")).not.toBe(tokens.color.negative);

    // b(0.1, 0.1)를 a(0.5, 0.5) 옆으로 끌면 놓기 전에 둘 다 빨갛게 바뀐다.
    const pan = mockPans[mockPans.length - 1];
    await act(async () => {
      pan.onBegin?.();
      pan.onUpdate?.({ translationX: 0.35 * 416, translationY: 0.35 * 608 });
    });
    expect(mockSetPosition).not.toHaveBeenCalled();
    expect(borderColor("Character 1 위치")).toBe(tokens.color.negative);
    expect(borderColor("Character 2 위치")).toBe(tokens.color.negative);
  });

  test("grid marks characters sharing a cell in red", async () => {
    mockGenerationState.model = "nai-diffusion-4-5-full";
    const original = mockGenerationState.characterPrompts;
    mockGenerationState.characterPrompts = [
      original[0],
      { ...original[1], position: original[0].position },
    ];
    const screen = await renderEditor();
    const colors = screen.getAllByText(/^[12]$/).map((label) => {
      let node = label.parent;
      while (node && StyleSheet.flatten(node.props.style)?.borderRadius !== 12)
        node = node.parent;
      return StyleSheet.flatten(node?.props.style)?.borderColor;
    });
    mockGenerationState.characterPrompts = original;
    expect(colors).toEqual([tokens.color.negative, tokens.color.negative]);
  });

  test("V5 shows the current image only when it matches the resolution", async () => {
    const empty = await renderEditor();
    expect(empty.queryByTestId("position-backdrop")).toBeNull();
    await empty.unmount();

    mockGenerationState.currentGeneration = {
      imagePath: "other.png",
      width: 1216,
      height: 832,
    };
    const mismatched = await renderEditor();
    expect(mismatched.getByTestId("position-board")).toBeTruthy();
    expect(mismatched.queryByTestId("position-backdrop")).toBeNull();
    await mismatched.unmount();

    mockGenerationState.currentGeneration = {
      imagePath: "same.png",
      width: 832,
      height: 1216,
    };
    const matched = await renderEditor();
    expect(matched.getByTestId("position-backdrop").props.source).toEqual({
      uri: "file:///same.png",
    });
  });
});
