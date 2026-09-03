import { act, fireEvent, render, renderHook, waitFor } from "@testing-library/react-native";
import { Alert, StyleSheet } from "react-native";
import { BottomSheetFlatList, BottomSheetFooter } from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { SharedValue } from "react-native-reanimated";
import * as MediaLibrary from "expo-media-library";
import { toast } from "sonner-native";

import { iterateGenerationImageBatches, type GenerationRecord } from "../../../lib/generationHistory";
import { useGenerationStore } from "../../../store/generationStore";
import {
  HistorySheetContent,
  HistorySheetFooter,
  HistorySheetHandle,
  useHistorySheetController,
} from "../HistorySheetContent";

type MockHistoryState = {
  generationHistory: GenerationRecord[];
  generationHistoryIds: string[] | null;
  generationHistoryHasMore: boolean;
  loadGenerationHistoryIds: jest.Mock<Promise<string[]>, []>;
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
      generationHistoryIds: null,
      generationHistoryHasMore: true,
      loadGenerationHistoryIds: jest.fn(),
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
  TouchableOpacity: require("react-native").Pressable,
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

jest.mock("../../../lib/generationHistory", () => ({
  iterateGenerationImageBatches: jest.fn(),
  resolveGenerationImageUri: (record: GenerationRecord) => record.imagePath,
  resolveGenerationThumbnailUri: () => null,
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
const mockLoadHistoryIds = initialState.loadGenerationHistoryIds as jest.Mock<Promise<string[]>, []>;
const mockImageBatches = jest.mocked(iterateGenerationImageBatches);

beforeEach(() => {
  mockLoadHistoryIds.mockReset().mockImplementation(async () => {
    const ids = useGenerationStore.getState().generationHistory.map((record) => record.id);
    useGenerationStore.setState({ generationHistoryIds: ids });
    return ids;
  });
  mockImageBatches.mockReset().mockImplementation(async function* (ids) {
    const records = useGenerationStore.getState().generationHistory;
    yield ids.map((id) => ({ id, imagePath: records.find((record) => record.id === id)?.imagePath ?? null }));
  });
});

function getAlertButton(callIndex: number, buttonIndex: number) {
  const buttons = mockAlert.mock.calls[callIndex]?.[2];
  if (!buttons?.[buttonIndex]) {
    throw new Error("Expected alert button was not rendered.");
  }
  return buttons[buttonIndex];
}

async function renderSelectedHistoryController(records = [generation]) {
  const onClose = jest.fn();
  useGenerationStore.setState({ generationHistory: records });
  const hook = await renderHook(() => useHistorySheetController({ onClose }));

  await act(async () => {
    hook.result.current.enterSelectionMode(records[0].id);
    await hook.result.current.toggleSelectAll();
  });

  return hook;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

type SavedAsset = Awaited<ReturnType<typeof MediaLibrary.Asset.create>>;
type SavePermission = Awaited<ReturnType<typeof MediaLibrary.requestPermissionsAsync>>;
const savedAsset = {} as SavedAsset;
const grantedPermission = { granted: true } as SavePermission;
const mockCreateAsset = jest.mocked(MediaLibrary.Asset.create);
const mockRequestPermission = jest.mocked(MediaLibrary.requestPermissionsAsync);

function historyRecords(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    ...generation,
    id: `generation-${index}`,
    imagePath: `file:///history/generation-${index}.png`,
  }));
}

describe("History database-wide selection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useGenerationStore.setState(initialState, true);
    mockCreateAsset.mockReset().mockResolvedValue(savedAsset);
    mockRequestPermission.mockReset().mockResolvedValue(grantedPermission);
    mockDeleteGenerations.mockReset().mockResolvedValue(undefined);
  });

  function storedHistory(records: GenerationRecord[]) {
    mockLoadHistoryIds.mockImplementation(async () => {
      const ids = records.map((record) => record.id);
      useGenerationStore.setState({ generationHistoryIds: ids });
      return ids;
    });
    mockImageBatches.mockImplementation(async function* (ids) {
      for (let offset = 0; offset < ids.length; offset += 300) {
        yield ids.slice(offset, offset + 300).map((id) => ({
          id, imagePath: records.find((record) => record.id === id)?.imagePath ?? null,
        }));
      }
    });
  }

  test("selects and saves all 601 stored images without loading their records into the grid", async () => {
    const records = historyRecords(601);
    storedHistory(records);
    const hook = await renderSelectedHistoryController(records.slice(0, 2));
    expect(hook.result.current.selectedCount).toBe(601);
    expect(hook.result.current.allSelected).toBe(true);
    expect(hook.result.current.generationHistory).toHaveLength(2);
    expect(initialState.loadMoreGenerationHistory).not.toHaveBeenCalled();

    await act(async () => { await hook.result.current.saveSelected(); });
    expect(mockCreateAsset.mock.calls.map(([uri]) => uri)).toEqual(records.map((record) => record.imagePath));
    expect(mockToastSuccess).toHaveBeenCalledWith("601개의 이미지를 저장했습니다.");
  });

  test("does not mistake selecting every loaded item for selecting the entire database", async () => {
    const records = historyRecords(3);
    storedHistory(records);
    useGenerationStore.setState({ generationHistory: records.slice(0, 1) });
    const hook = await renderHook(() => useHistorySheetController({ onClose: jest.fn() }));
    await act(async () => { hook.result.current.enterSelectionMode(records[0].id); });
    expect(hook.result.current.allSelected).toBe(false);
    await act(async () => { await hook.result.current.toggleSelectAll(); });
    expect(hook.result.current.selectedCount).toBe(3);
  });

  test("preserves unloaded selections across pagination and clears or restores the full selection", async () => {
    const records = historyRecords(5);
    storedHistory(records);
    const hook = await renderSelectedHistoryController(records.slice(0, 1));
    await act(async () => { useGenerationStore.setState({ generationHistory: records }); });
    expect(hook.result.current.selectedIds).toEqual(new Set(records.map((record) => record.id)));
    await act(async () => { hook.result.current.handleTilePress(records[3]); });
    expect(hook.result.current.selectedCount).toBe(4);
    expect(hook.result.current.allSelected).toBe(false);
    await act(async () => { hook.result.current.handleTilePress(records[3]); });
    expect(hook.result.current.allSelected).toBe(true);
    await act(async () => { await hook.result.current.toggleSelectAll(); });
    expect(hook.result.current.selectedCount).toBe(0);
    expect(mockLoadHistoryIds).toHaveBeenCalledTimes(1);
    await act(async () => { await hook.result.current.toggleSelectAll(); });
    expect(hook.result.current.selectedCount).toBe(5);
  });

  test("deletes the confirmed snapshot, including unloaded IDs, without deselected or newly generated images", async () => {
    const records = historyRecords(5);
    storedHistory(records);
    const hook = await renderSelectedHistoryController(records.slice(0, 2));
    await act(async () => { hook.result.current.handleTilePress(records[1]); });
    await act(async () => { hook.result.current.deleteSelected(); });
    expect(mockAlert.mock.calls[0][1]).toContain("4개의 이미지를 영구 삭제");
    const newest = { ...generation, id: "new" };
    await act(async () => {
      useGenerationStore.setState({
        generationHistory: [newest, ...records.slice(0, 2)],
        generationHistoryIds: [newest.id, ...records.map((record) => record.id)],
      });
    });
    expect(hook.result.current.selectedIds.has(newest.id)).toBe(false);
    expect(hook.result.current.selectedCount).toBe(4);
    await act(async () => { getAlertButton(0, 1).onPress?.(); });
    expect(mockDeleteGenerations).toHaveBeenCalledWith(records.filter((_, index) => index !== 1).map((record) => record.id));
  });

  test("new generations require an explicit new selection", async () => {
    const records = historyRecords(3);
    storedHistory(records);
    const hook = await renderSelectedHistoryController(records.slice(0, 1));
    const newest = { ...generation, id: "new" };
    records.unshift(newest);
    await act(async () => {
      useGenerationStore.setState({
        generationHistory: [newest, ...hook.result.current.generationHistory],
        generationHistoryIds: records.map((record) => record.id),
      });
    });
    expect(hook.result.current.selectedCount).toBe(3);
    expect(hook.result.current.allSelected).toBe(false);
    expect(hook.result.current.selectedIds.has(newest.id)).toBe(false);
    await act(async () => { await hook.result.current.toggleSelectAll(); });
    expect(hook.result.current.selectedCount).toBe(4);
  });

  test("prunes deleted IDs using the database catalog, not the currently loaded page", async () => {
    const records = historyRecords(5);
    storedHistory(records);
    const hook = await renderSelectedHistoryController(records.slice(0, 1));
    await act(async () => {
      useGenerationStore.setState({ generationHistoryIds: records.slice(0, 4).map((record) => record.id) });
    });
    expect(hook.result.current.selectedCount).toBe(4);
    expect(hook.result.current.selectedIds.has(records[3].id)).toBe(true);
    expect(hook.result.current.selectedIds.has(records[4].id)).toBe(false);
    await act(async () => { await hook.result.current.saveSelected(); });
    expect(mockImageBatches).toHaveBeenCalledWith(records.slice(0, 4).map((record) => record.id));
    await act(async () => { useGenerationStore.setState({ generationHistory: [], generationHistoryIds: [] }); });
    expect(hook.result.current.selectedCount).toBe(0);
    expect(hook.result.current.allSelected).toBe(false);
  });

  test("locks competing actions synchronously while querying all IDs", async () => {
    const pending = deferred<string[]>();
    mockLoadHistoryIds.mockReturnValue(pending.promise);
    useGenerationStore.setState({ generationHistory: [generation] });
    const hook = await renderHook(() => useHistorySheetController({ onClose: jest.fn() }));
    await act(async () => { hook.result.current.enterSelectionMode(generation.id); });
    let selecting!: Promise<void>;
    await act(async () => {
      selecting = hook.result.current.toggleSelectAll();
      await hook.result.current.toggleSelectAll();
      await hook.result.current.saveSelected();
      hook.result.current.deleteSelected();
      hook.result.current.handleTilePress(generation);
    });
    expect(mockLoadHistoryIds).toHaveBeenCalledTimes(1);
    expect(mockRequestPermission).not.toHaveBeenCalled();
    expect(mockAlert).not.toHaveBeenCalled();
    expect(hook.result.current.selectingAll).toBe(true);
    expect(hook.result.current.busy).toBe(true);
    expect(hook.result.current.selectedCount).toBe(1);
    await act(async () => { pending.resolve([generation.id]); await selecting; });
    expect(hook.result.current.busy).toBe(false);
  });

  test("shows selection loading, disables the full-selection button, and allows cancellation", async () => {
    const pending = deferred<string[]>();
    mockLoadHistoryIds.mockReturnValue(pending.promise);
    useGenerationStore.setState({ generationHistory: [generation] });
    const hook = await renderHook(() => useHistorySheetController({ onClose: jest.fn() }));
    await act(async () => { hook.result.current.enterSelectionMode(generation.id); });
    let selecting!: Promise<void>;
    await act(async () => { selecting = hook.result.current.toggleSelectAll(); });
    const view = await render(<HistorySheetHandle controller={hook.result.current} />);
    expect(view.getByText("선택 중...")).toBeTruthy();
    const selectAll = view.getByRole("button", { name: "전체 선택" });
    expect(selectAll.props.accessibilityState).toEqual({ disabled: true, busy: true });
    expect(selectAll.props.accessibilityHint).toContain("화면에 불러오지 않은 항목도 포함");
    await fireEvent.press(selectAll);
    expect(mockLoadHistoryIds).toHaveBeenCalledTimes(1);
    await fireEvent.press(view.getByRole("button", { name: "선택 취소" }));
    expect(hook.result.current.selectionMode).toBe(false);
    await act(async () => { pending.resolve([generation.id]); await selecting; });
    expect(hook.result.current.selectedCount).toBe(0);
  });

  test("ignores a failed query after unmount", async () => {
    const pending = deferred<string[]>();
    mockLoadHistoryIds.mockReturnValue(pending.promise);
    useGenerationStore.setState({ generationHistory: [generation] });
    const hook = await renderHook(() => useHistorySheetController({ onClose: jest.fn() }));
    await act(async () => { hook.result.current.enterSelectionMode(generation.id); });
    let selecting!: Promise<void>;
    await act(async () => { selecting = hook.result.current.toggleSelectAll(); });
    await hook.unmount();
    await act(async () => { pending.reject(new Error("query failed")); await selecting; });
    expect(mockAlert).not.toHaveBeenCalled();
  });

  test("does not change the selection while a save permission request is pending", async () => {
    const pending = deferred<SavePermission>();
    mockRequestPermission.mockReturnValueOnce(pending.promise);
    const records = historyRecords(3);
    const hook = await renderSelectedHistoryController(records);
    let saving!: Promise<void>;
    await act(async () => {
      saving = hook.result.current.saveSelected();
      await hook.result.current.toggleSelectAll();
      hook.result.current.handleTilePress(records[0]);
      hook.result.current.enterSelectionMode(records[0].id);
    });
    expect(hook.result.current.selectedCount).toBe(3);
    expect(mockLoadHistoryIds).toHaveBeenCalledTimes(1);
    await act(async () => { pending.resolve(grantedPermission); await saving; });
    expect(mockCreateAsset).toHaveBeenCalledTimes(3);
  });

  test.each(["resolve", "reject"])("ignores a cancelled query that later %ss", async (outcome) => {
    const pending = deferred<string[]>();
    mockLoadHistoryIds.mockReturnValueOnce(pending.promise);
    useGenerationStore.setState({ generationHistory: [generation] });
    const hook = await renderHook(() => useHistorySheetController({ onClose: jest.fn() }));
    await act(async () => { hook.result.current.enterSelectionMode(generation.id); });
    let selecting!: Promise<void>;
    await act(async () => { selecting = hook.result.current.toggleSelectAll(); });
    await act(async () => { hook.result.current.exitSelectionMode(); });
    expect(hook.result.current.busy).toBe(false);
    await act(async () => {
      if (outcome === "resolve") pending.resolve([generation.id]);
      else pending.reject(new Error("query failed"));
      await selecting;
    });
    expect(hook.result.current.selectionMode).toBe(false);
    expect(hook.result.current.selectedCount).toBe(0);
    expect(mockAlert).not.toHaveBeenCalled();
  });

  test("a cancelled response cannot replace a newer selection or release its lock", async () => {
    const oldRequest = deferred<string[]>();
    const newRequest = deferred<string[]>();
    mockLoadHistoryIds.mockReturnValueOnce(oldRequest.promise).mockReturnValueOnce(newRequest.promise);
    const records = historyRecords(2);
    useGenerationStore.setState({ generationHistory: records });
    const hook = await renderHook(() => useHistorySheetController({ onClose: jest.fn() }));
    await act(async () => { hook.result.current.enterSelectionMode(records[0].id); });
    let oldSelecting!: Promise<void>;
    let newSelecting!: Promise<void>;
    await act(async () => { oldSelecting = hook.result.current.toggleSelectAll(); });
    await act(async () => {
      hook.result.current.exitSelectionMode();
      hook.result.current.enterSelectionMode(records[1].id);
    });
    await act(async () => { newSelecting = hook.result.current.toggleSelectAll(); });
    await act(async () => { oldRequest.resolve([records[0].id]); await oldSelecting; });
    expect(hook.result.current.selectedIds).toEqual(new Set([records[1].id]));
    expect(hook.result.current.selectingAll).toBe(true);
    await act(async () => { newRequest.resolve(records.map((record) => record.id)); await newSelecting; });
    expect(hook.result.current.selectedCount).toBe(2);
    expect(hook.result.current.busy).toBe(false);
  });

  test("keeps the previous selection on ID lookup failure and supports retry or an empty database", async () => {
    mockLoadHistoryIds.mockRejectedValueOnce(new Error("query failed"));
    const hook = await renderSelectedHistoryController();
    expect(hook.result.current.selectedCount).toBe(1);
    expect(hook.result.current.busy).toBe(false);
    expect(mockAlert.mock.calls[0][0]).toBe("전체 선택 실패");
    await act(async () => { await hook.result.current.toggleSelectAll(); });
    expect(hook.result.current.allSelected).toBe(true);
    await act(async () => { await hook.result.current.toggleSelectAll(); });
    storedHistory([]);
    await act(async () => { await hook.result.current.toggleSelectAll(); });
    expect(hook.result.current.selectedCount).toBe(0);
    expect(hook.result.current.allSelected).toBe(false);
  });

  test("counts missing DB paths as failures and continues saving", async () => {
    const hook = await renderSelectedHistoryController(historyRecords(3));
    mockImageBatches.mockImplementationOnce(async function* () {
      yield [{ id: "0", imagePath: null }, { id: "1", imagePath: "1.png" }];
      yield [{ id: "2", imagePath: "2.png" }];
    });
    await act(async () => { await hook.result.current.saveSelected(); });
    expect(mockCreateAsset).toHaveBeenCalledTimes(2);
    expect(mockAlert).toHaveBeenCalledWith("일부 이미지 저장 실패", "저장 성공: 2개\n저장 실패: 1개");
  });

  test("reports completed saves when a later path query fails and releases the lock for retry", async () => {
    const hook = await renderSelectedHistoryController(historyRecords(4));
    mockImageBatches.mockImplementationOnce(async function* () {
      yield [{ id: "0", imagePath: "0.png" }];
      throw new Error("next query failed");
    });
    await act(async () => { await hook.result.current.saveSelected(); });
    expect(mockAlert).toHaveBeenCalledWith("일부 이미지 저장 실패", "저장 성공: 1개\n저장 실패: 3개");
    expect(hook.result.current.busy).toBe(false);
    await act(async () => { await hook.result.current.saveSelected(); });
    expect(mockToastSuccess).toHaveBeenCalledWith("4개의 이미지를 저장했습니다.");
  });
});

describe("History bulk saving", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateAsset.mockReset().mockResolvedValue(savedAsset);
    mockRequestPermission.mockReset().mockResolvedValue(grantedPermission);
    useGenerationStore.setState(initialState, true);
  });

  test("does not request permission without selected records", async () => {
    const hook = await renderHook(() => useHistorySheetController({ onClose: jest.fn() }));
    await act(async () => {
      await hook.result.current.saveSelected();
    });
    expect(mockRequestPermission).not.toHaveBeenCalled();
    expect(mockCreateAsset).not.toHaveBeenCalled();
  });

  test.each([1, 2, 3])("saves %i selected images and keeps the selection", async (count) => {
    const records = historyRecords(count);
    const hook = await renderSelectedHistoryController(records);
    await act(async () => {
      await hook.result.current.saveSelected();
    });

    expect(mockCreateAsset.mock.calls.map(([uri]) => uri)).toEqual(
      records.map((record) => record.imagePath),
    );
    expect(mockToastSuccess).toHaveBeenCalledWith(`${count}개의 이미지를 저장했습니다.`);
    expect(mockAlert).not.toHaveBeenCalled();
    expect(hook.result.current.selectedCount).toBe(count);
    expect(hook.result.current.busy).toBe(false);
  });

  test("limits saves to three and waits for every result after a failure", async () => {
    const records = historyRecords(7);
    const pending = records.map(() => deferred<SavedAsset>());
    let active = 0;
    let peakActive = 0;
    let next = 0;
    mockCreateAsset.mockImplementation(() => {
      active += 1;
      peakActive = Math.max(peakActive, active);
      return pending[next++].promise.finally(() => { active -= 1; });
    });
    const hook = await renderSelectedHistoryController(records);
    let saving!: Promise<void>;
    await act(async () => {
      saving = hook.result.current.saveSelected();
    });
    expect(mockCreateAsset).toHaveBeenCalledTimes(3);
    expect(hook.result.current.busy).toBe(true);

    await act(async () => { pending[1].resolve(savedAsset); });
    expect(mockCreateAsset).toHaveBeenCalledTimes(4);
    await act(async () => { pending[0].reject(new Error("save failed")); });
    expect(mockCreateAsset).toHaveBeenCalledTimes(5);
    expect(hook.result.current.busy).toBe(true);
    expect(mockAlert).not.toHaveBeenCalled();
    expect(mockToastSuccess).not.toHaveBeenCalled();

    await act(async () => { await hook.result.current.saveSelected(); });
    expect(mockRequestPermission).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending.slice(2).forEach((item) => item.resolve(savedAsset));
      await saving;
    });
    expect(peakActive).toBe(3);
    expect(active).toBe(0);
    expect(mockCreateAsset.mock.calls.map(([uri]) => uri)).toEqual(
      records.map((record) => record.imagePath),
    );
    expect(mockAlert).toHaveBeenCalledWith(
      "일부 이미지 저장 실패", "저장 성공: 6개\n저장 실패: 1개",
    );
    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(hook.result.current.busy).toBe(false);
    expect(hook.result.current.selectedCount).toBe(7);
  });

  test("blocks repeated saves and deletion before the first rerender", async () => {
    const permission = deferred<SavePermission>();
    mockRequestPermission.mockReturnValue(permission.promise);
    const hook = await renderSelectedHistoryController();
    let saving!: Promise<void>;
    let repeatedSave!: Promise<void>;
    await act(async () => {
      saving = hook.result.current.saveSelected();
      repeatedSave = hook.result.current.saveSelected();
      hook.result.current.deleteSelected();
    });
    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
    expect(mockAlert).not.toHaveBeenCalled();
    expect(mockCreateAsset).not.toHaveBeenCalled();

    await act(async () => {
      permission.resolve(grantedPermission);
      await Promise.all([saving, repeatedSave]);
    });
    expect(mockCreateAsset).toHaveBeenCalledTimes(1);
    expect(hook.result.current.busy).toBe(false);
  });

  test("does not start saving while delete confirmation is opening", async () => {
    const hook = await renderSelectedHistoryController();
    await act(async () => {
      hook.result.current.deleteSelected();
      await hook.result.current.saveSelected();
    });
    expect(mockRequestPermission).not.toHaveBeenCalled();
    await act(async () => { getAlertButton(0, 0).onPress?.(); });
    await act(async () => { await hook.result.current.saveSelected(); });
    expect(mockCreateAsset).toHaveBeenCalledTimes(1);
  });

  test.each(["denied", "error"])("releases the save lock after permission is %s", async (result) => {
    if (result === "denied") {
      mockRequestPermission.mockResolvedValueOnce({ ...grantedPermission, granted: false });
    } else {
      mockRequestPermission.mockRejectedValueOnce(new Error("permission failed"));
    }
    const hook = await renderSelectedHistoryController();
    await act(async () => { await hook.result.current.saveSelected(); });
    expect(mockCreateAsset).not.toHaveBeenCalled();
    expect(mockAlert).toHaveBeenCalledTimes(1);
    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(hook.result.current.busy).toBe(false);

    await act(async () => { await hook.result.current.saveSelected(); });
    expect(mockCreateAsset).toHaveBeenCalledTimes(1);
    expect(mockToastSuccess).toHaveBeenCalledTimes(1);
  });

  test.each(["rejection", "throw"])("counts every failure after an asset %s and permits retry", async (failure) => {
    if (failure === "rejection") {
      mockCreateAsset.mockRejectedValue(new Error("save failed"));
    } else {
      mockCreateAsset.mockImplementation(() => { throw new Error("save failed"); });
    }
    const hook = await renderSelectedHistoryController(historyRecords(4));
    await act(async () => { await hook.result.current.saveSelected(); });
    expect(mockCreateAsset).toHaveBeenCalledTimes(4);
    expect(mockAlert).toHaveBeenCalledWith("저장 실패", "저장 성공: 0개\n저장 실패: 4개");
    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(hook.result.current.busy).toBe(false);

    mockCreateAsset.mockResolvedValue(savedAsset);
    await act(async () => { await hook.result.current.saveSelected(); });
    expect(mockToastSuccess).toHaveBeenCalledWith("4개의 이미지를 저장했습니다.");
  });
});

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
