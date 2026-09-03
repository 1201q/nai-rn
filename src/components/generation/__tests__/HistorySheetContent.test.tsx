import { act, render, renderHook, waitFor } from "@testing-library/react-native";
import { Alert, StyleSheet } from "react-native";
import { BottomSheetFlatList, BottomSheetFooter } from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { SharedValue } from "react-native-reanimated";
import { toast } from "sonner-native";

import type { GenerationRecord } from "../../../lib/generationHistory";
import { useGenerationStore } from "../../../store/generationStore";
import {
  HistorySheetContent,
  HistorySheetFooter,
  useHistorySheetController,
} from "../HistorySheetContent";

type MockHistoryState = {
  generationHistory: GenerationRecord[];
  generationHistoryInitialized: boolean;
  generationHistoryLoadingMore: boolean;
  loadMoreGenerationHistory: jest.Mock<Promise<void>, []>;
  deleteGenerations: jest.Mock<Promise<void>, [string[]]>;
  currentGeneration: GenerationRecord | null;
};

jest.mock("../../../store/generationStore", () => {
  const { create } = require("zustand") as typeof import("zustand");

  return {
    useGenerationStore: create<MockHistoryState>(() => ({
      generationHistory: [],
      generationHistoryInitialized: true,
      generationHistoryLoadingMore: false,
      loadMoreGenerationHistory: jest.fn(),
      deleteGenerations: jest.fn(),
      currentGeneration: null,
    })),
  };
});

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@gorhom/bottom-sheet", () => ({
  BottomSheetFlatList: jest.fn(() => null),
  BottomSheetFooter: jest.fn(() => null),
  TouchableOpacity: () => null,
}));

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("expo-image", () => ({
  Image: () => null,
}));

jest.mock("expo-media-library", () => ({
  Asset: { create: jest.fn() },
  requestPermissionsAsync: jest.fn(),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: jest.fn(() => ({ top: 0, right: 0, bottom: 0, left: 0 })),
}));

jest.mock("sonner-native", () => ({
  toast: { success: jest.fn() },
}));

const generation: GenerationRecord = {
  id: "generation-1",
  imagePath: "generation.png",
  thumbnailPath: null,
  prompt: "prompt",
  negativePrompt: "",
  model: "nai-diffusion-4-5-full",
  sampler: "k_euler_ancestral",
  noiseSchedule: "karras",
  width: 1024,
  height: 1024,
  steps: 28,
  scale: 5,
  cfgRescale: 0,
  seed: 123,
  createdAt: 1,
  metadataJson: "{}",
};

const initialState = useGenerationStore.getInitialState();
const mockDeleteGenerations =
  initialState.deleteGenerations as MockHistoryState["deleteGenerations"];
const mockAlert = jest.spyOn(Alert, "alert");
const mockToastSuccess = jest.mocked(toast.success);
const mockInsets = jest.mocked(useSafeAreaInsets);

function getAlertButton(callIndex: number, buttonIndex: number) {
  const buttons = mockAlert.mock.calls[callIndex]?.[2];
  if (!buttons?.[buttonIndex]) {
    throw new Error("Expected alert button was not rendered.");
  }
  return buttons[buttonIndex];
}

async function renderSelectedHistoryController() {
  const onClose = jest.fn();
  useGenerationStore.setState({ generationHistory: [generation] });
  const hook = await renderHook(() => useHistorySheetController({ onClose }));

  await act(async () => {
    hook.result.current.enterSelectionMode(generation.id);
  });

  return hook;
}

describe("History deletion confirmation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInsets.mockReturnValue({ top: 0, right: 0, bottom: 0, left: 0 });
    useGenerationStore.setState(initialState, true);
  });

  test.each([0, 24, 34])("keeps the History footer and list above %i bottom inset", async (bottom) => {
    mockInsets.mockReturnValue({ top: 0, right: 0, bottom, left: 0 });
    const hook = await renderSelectedHistoryController();
    await render(
      <>
        <HistorySheetContent controller={hook.result.current} />
        <HistorySheetFooter
          controller={hook.result.current}
          animatedFooterPosition={{ value: 0 } as SharedValue<number>}
        />
      </>,
    );

    const footerProps = jest.mocked(BottomSheetFooter).mock.calls[0][0];
    const listProps = jest.mocked(BottomSheetFlatList).mock.calls[0][0];
    expect(footerProps.bottomInset).toBe(71 + bottom);
    expect(StyleSheet.flatten(listProps.contentContainerStyle)).toMatchObject({
      paddingBottom: 156 + bottom,
    });
  });

  test("keeps the selection and does not delete when cancelled", async () => {
    const hook = await renderSelectedHistoryController();

    await act(async () => {
      hook.result.current.deleteSelected();
    });

    expect(mockAlert).toHaveBeenCalledWith(
      "이미지 삭제",
      "1개의 이미지를 영구 삭제합니다.\n삭제한 이미지는 복구할 수 없습니다.",
      expect.any(Array),
      expect.objectContaining({ cancelable: true }),
    );
    expect(hook.result.current.busy).toBe(true);

    await act(async () => {
      getAlertButton(0, 0).onPress?.();
    });

    expect(mockDeleteGenerations).not.toHaveBeenCalled();
    expect(hook.result.current.selectionMode).toBe(true);
    expect(hook.result.current.selectedIds.has(generation.id)).toBe(true);
    expect(hook.result.current.busy).toBe(false);
  });

  test("deletes only after destructive confirmation", async () => {
    mockDeleteGenerations.mockResolvedValue(undefined);
    const hook = await renderSelectedHistoryController();

    await act(async () => {
      hook.result.current.deleteSelected();
      getAlertButton(0, 1).onPress?.();
    });

    await waitFor(() => {
      expect(mockDeleteGenerations).toHaveBeenCalledWith([generation.id]);
      expect(hook.result.current.selectionMode).toBe(false);
      expect(hook.result.current.busy).toBe(false);
    });
    expect(mockToastSuccess).toHaveBeenCalledWith(
      "1개의 이미지를 삭제했습니다.",
    );
  });

  test("does not open duplicate confirmation alerts", async () => {
    const hook = await renderSelectedHistoryController();

    await act(async () => {
      hook.result.current.deleteSelected();
      hook.result.current.deleteSelected();
    });

    expect(mockAlert).toHaveBeenCalledTimes(1);

    await act(async () => {
      getAlertButton(0, 0).onPress?.();
    });
  });

  test("keeps the selection when deletion fails", async () => {
    mockDeleteGenerations.mockRejectedValue(new Error("delete failed"));
    const hook = await renderSelectedHistoryController();

    await act(async () => {
      hook.result.current.deleteSelected();
      getAlertButton(0, 1).onPress?.();
    });

    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledTimes(2);
      expect(hook.result.current.busy).toBe(false);
    });
    expect(mockAlert).toHaveBeenLastCalledWith(
      "삭제 실패",
      "선택한 이미지를 history에서 삭제하지 못했습니다.",
    );
    expect(hook.result.current.selectionMode).toBe(true);
    expect(hook.result.current.selectedIds.has(generation.id)).toBe(true);
  });
});
