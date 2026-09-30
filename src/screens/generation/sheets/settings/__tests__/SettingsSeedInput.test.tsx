import { useEffect } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

import {
  GenerationInputCommitProvider,
  useGenerationInputCommit,
} from "../../../../../context/GenerationInputCommitContext";
import { useGenerationStore } from "../../../../../store/generationStore";
import { SettingsSheetContent } from "../SettingsSheetContent";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("@gorhom/bottom-sheet", () => ({
  BottomSheetTextInput: require("react-native").TextInput,
}));
jest.mock(
  "../../../../../components/generation/BottomSheetKeyboardAwareScrollView",
  () => ({
    BottomSheetKeyboardAwareScrollView: ({
      children,
    }: {
      children: React.ReactNode;
    }) => children,
  }),
);
jest.mock("../../../../../components/forms/SheetSelect", () => ({
  SheetSelect: () => null,
}));
jest.mock("../../../../../components/forms/FormControls", () => ({
  Toggle: () => null,
}));
jest.mock("../SettingsSlider", () => ({
  SettingsSlider: () => null,
  SettingsHelpButton: () => null,
}));
jest.mock("../../SheetLayers", () => {
  const { Pressable } = require("react-native");
  return {
    PressableSurface: ({
      accessibilityLabel,
      disabled = false,
      onPress,
      children,
    }: {
      accessibilityLabel: string;
      disabled?: boolean;
      onPress: () => void;
      children: React.ReactNode;
    }) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
      >
        {children}
      </Pressable>
    ),
  };
});
jest.mock("../ResolutionDimensionInputs", () => ({
  ResolutionDimensionInputs: () => null,
}));
jest.mock("../../../../../hooks/useGenerationChromeMetrics", () => ({
  useGenerationChromeMetrics: () => ({ sheetContentPaddingBottom: 0 }),
}));
jest.mock("../../../../../lib/novelai", () => ({
  resolveNoiseSchedule: () => null,
}));
jest.mock("../../../../../store/generationStore", () => {
  const { create } = require("zustand");
  return { useGenerationStore: create(() => ({})) };
});

type SeedState = {
  seed: number;
  seedLocked: boolean;
  currentGeneration: { seed: number | null } | null;
  isLoading: boolean;
  streamingPreviewUri: string | null;
};

function setStoreState(state: Partial<SeedState> = {}) {
  useGenerationStore.setState({
    model: "nai-diffusion-4-5-full",
    resolution: { label: "Normal", width: 832, height: 1216 },
    steps: 28,
    promptGuidance: 5,
    promptGuidanceRescale: 0,
    sampler: "k_euler_ancestral",
    noiseSchedule: "karras",
    varietyPlus: false,
    seed: 0,
    seedLocked: false,
    currentGeneration: { seed: 777 },
    isLoading: false,
    streamingPreviewUri: null,
    ...state,
    setSeed: (seed: number) => useGenerationStore.setState({ seed }),
    setSeedLocked: (seedLocked: boolean) =>
      useGenerationStore.setState({ seedLocked }),
  } as never);
}

const seedState = () => useGenerationStore.getState() as unknown as SeedState;

let commitPendingInput: () => void = () => {};

function CommitProbe() {
  const { commitPendingInput: commit } = useGenerationInputCommit();
  useEffect(() => {
    commitPendingInput = commit;
  }, [commit]);
  return null;
}

const view = (active: boolean) => (
  <GenerationInputCommitProvider>
    <CommitProbe />
    <SettingsSheetContent active={active} />
  </GenerationInputCommitProvider>
);

async function renderSettings(active = true) {
  const utils = await render(view(active));
  return { rerender: (next: boolean) => utils.rerender(view(next)) };
}

const input = () => screen.getByLabelText("Seed 값");

test("shows the seed only while it is locked", async () => {
  setStoreState({ seed: 1234, seedLocked: true });
  await renderSettings();
  expect(input().props.value).toBe("1234");

  await act(async () => setStoreState({ seed: 1234, seedLocked: false }));
  expect(input().props.value).toBe("");
});

test("typing digits locks the seed and clearing the text unlocks it", async () => {
  setStoreState();
  await renderSettings();

  await act(async () => fireEvent.changeText(input(), "12a34"));
  expect(input().props.value).toBe("1234");
  expect(seedState()).toMatchObject({ seed: 1234, seedLocked: true });

  await act(async () => fireEvent.changeText(input(), ""));
  expect(seedState()).toMatchObject({ seed: 0, seedLocked: false });
});

test("out-of-range text is kept while typing and clamped on commit", async () => {
  setStoreState({ seed: 5, seedLocked: true });
  await renderSettings();

  await act(async () => fireEvent(input(), "focus"));
  await act(async () => fireEvent.changeText(input(), "9999999999"));
  expect(input().props.value).toBe("9999999999");
  expect(seedState().seed).toBe(5);

  await act(async () => fireEvent(input(), "blur"));
  expect(input().props.value).toBe("4294967295");
  expect(seedState()).toMatchObject({ seed: 4_294_967_295, seedLocked: true });
});

test("the action button clears a seed or takes the current image seed", async () => {
  setStoreState({ seed: 42, seedLocked: true });
  await renderSettings();

  await act(async () => fireEvent.press(screen.getByLabelText("Seed 지우기")));
  expect(input().props.value).toBe("");
  expect(seedState()).toMatchObject({ seed: 0, seedLocked: false });

  await act(async () =>
    fireEvent.press(screen.getByLabelText("현재 이미지 Seed 가져오기")),
  );
  expect(input().props.value).toBe("777");
  expect(seedState()).toMatchObject({ seed: 777, seedLocked: true });
});

test("the current image seed is unavailable while generating", async () => {
  setStoreState({ isLoading: true });
  await renderSettings();

  const button = screen.getByLabelText("현재 이미지 Seed 가져오기");
  expect(button.props.accessibilityState).toMatchObject({ disabled: true });
  await act(async () => fireEvent.press(button));
  expect(seedState().seedLocked).toBe(false);
});

test("external changes do not replace the draft while focused", async () => {
  setStoreState({ seed: 1, seedLocked: true });
  await renderSettings();

  await act(async () => fireEvent(input(), "focus"));
  await act(async () => fireEvent.changeText(input(), "99999999999"));
  await act(async () => setStoreState({ seed: 2, seedLocked: true }));
  expect(input().props.value).toBe("9999999999");
});

test("the pending input commit applies the focused draft", async () => {
  setStoreState({ seed: 1, seedLocked: true });
  await renderSettings();

  await act(async () => fireEvent(input(), "focus"));
  await act(async () => fireEvent.changeText(input(), "9999999999"));
  await act(async () => commitPendingInput());
  expect(seedState().seed).toBe(4_294_967_295);
});

test("becoming inactive drops focus and syncs the store seed", async () => {
  setStoreState({ seed: 1, seedLocked: true });
  const { rerender } = await renderSettings();

  await act(async () => fireEvent(input(), "focus"));
  await act(async () => fireEvent.changeText(input(), "9999999999"));
  await act(async () => rerender(false));
  expect(input().props.value).toBe("1");

  await act(async () => commitPendingInput());
  expect(seedState().seed).toBe(1);
});
