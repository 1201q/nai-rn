import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";
import * as Haptics from "expo-haptics";
import { toast } from "sonner-native";

import {
  requestGallerySavePermission,
  saveImageToGallery,
} from "../../../lib/gallery";
import {
  type GenerationRecord,
  iterateGenerationImageBatches,
  resolveGenerationImageUri,
} from "../../../lib/generationHistory";
import {
  HISTORY_GRID_COLUMN_OPTIONS,
  HISTORY_LIST_ENGINES,
} from "../../../store/generationOptionsPersistence";
import { useGenerationStore } from "../../../store/generationStore";
import {
  createHistorySelectionStore,
  isAllSelected,
  setAvailableIds,
  setSelectedIds,
} from "./historySelection";

const HISTORY_SAVE_CONCURRENCY = 3;

export function useHistorySheetController({
  onClose,
}: {
  onClose: () => void;
}) {
  const generationHistory = useGenerationStore(
    (state) => state.generationHistory,
  );
  const historyInitialized = useGenerationStore(
    (state) => state.generationHistoryInitialized,
  );
  const historyIds = useGenerationStore((state) => state.generationHistoryIds);
  const historyHasMore = useGenerationStore(
    (state) => state.generationHistoryHasMore,
  );
  const loadHistoryIds = useGenerationStore(
    (state) => state.loadGenerationHistoryIds,
  );
  const historyLoadingMore = useGenerationStore(
    (state) => state.generationHistoryLoadingMore,
  );
  const loadMoreHistory = useGenerationStore(
    (state) => state.loadMoreGenerationHistory,
  );
  const deleteGenerations = useGenerationStore(
    (state) => state.deleteGenerations,
  );
  const currentGenerationId = useGenerationStore(
    (state) => state.currentGeneration?.id ?? null,
  );
  const isLoading = useGenerationStore((state) => state.isLoading);
  const streamingPreviewUri = useGenerationStore(
    (state) => state.streamingPreviewUri,
  );
  const isViewingActiveGeneration = useGenerationStore(
    (state) => state.isViewingActiveGeneration,
  );
  const gridColumns = useGenerationStore((state) => state.historyGridColumns);
  // 열 수를 바꾸면 그리드를 다시 마운트하므로, 보고 있던 항목에서 다시 시작하게 한다.
  const [gridInitialIndex, setGridInitialIndex] = useState(0);
  const listEngine = useGenerationStore((state) => state.historyListEngine);
  const gridFirstVisibleIndexRef = useRef(0);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selection] = useState(createHistorySelectionStore);
  const [selectingAll, setSelectingAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const savingRef = useRef(false);
  const selectingAllRef = useRef(false);
  const selectionRequestRef = useRef(0);
  const deletePhaseRef = useRef<"idle" | "confirming" | "deleting">("idle");
  const dragSelectionRef = useRef<{
    anchorId: string;
    lastId: string;
    base: Set<string>;
    remove: boolean;
  } | null>(null);

  useEffect(
    () => () => {
      selectionRequestRef.current += 1;
    },
    [],
  );

  const availableIdList = useMemo(
    () => historyIds ?? generationHistory.map((item) => item.id),
    [historyIds, generationHistory],
  );
  const availableIds = useMemo(
    () => new Set(availableIdList),
    [availableIdList],
  );
  useEffect(() => {
    setAvailableIds(
      selection,
      availableIds,
      historyIds !== null || !historyHasMore,
    );
  }, [availableIds, historyHasMore, historyIds, selection]);
  const busy = selectingAll || saving || deleting || deleteConfirmationOpen;

  const loadedIndexById = useMemo(
    () => new Map(generationHistory.map((item, index) => [item.id, index])),
    [generationHistory],
  );

  const setGridFirstVisibleIndex = useCallback((index: number) => {
    gridFirstVisibleIndexRef.current = index;
  }, []);

  const resetGridPosition = useCallback(() => {
    gridFirstVisibleIndexRef.current = 0;
    setGridInitialIndex(0);
  }, []);

  const cycleGridColumns = useCallback(() => {
    const { historyGridColumns, setHistoryGridColumns } =
      useGenerationStore.getState();
    const next =
      HISTORY_GRID_COLUMN_OPTIONS[
        (HISTORY_GRID_COLUMN_OPTIONS.indexOf(historyGridColumns) + 1) %
          HISTORY_GRID_COLUMN_OPTIONS.length
      ];
    Haptics.selectionAsync().catch(() => {});
    setGridInitialIndex(gridFirstVisibleIndexRef.current);
    setHistoryGridColumns(next);
  }, []);

  const cycleListEngine = useCallback(() => {
    const { historyListEngine, setHistoryListEngine } =
      useGenerationStore.getState();
    setGridInitialIndex(gridFirstVisibleIndexRef.current);
    setHistoryListEngine(
      HISTORY_LIST_ENGINES[
        (HISTORY_LIST_ENGINES.indexOf(historyListEngine) + 1) %
          HISTORY_LIST_ENGINES.length
      ],
    );
  }, []);

  const exitSelectionMode = useCallback(() => {
    dragSelectionRef.current = null;
    selectionRequestRef.current += 1;
    selectingAllRef.current = false;
    setSelectingAll(false);
    setSelectionMode(false);
    setSelectedIds(selection, new Set());
  }, [selection]);

  const enterSelectionMode = useCallback(
    (id: string) => {
      if (
        selectingAllRef.current ||
        savingRef.current ||
        deletePhaseRef.current !== "idle"
      ) {
        return;
      }
      selectionRequestRef.current += 1;
      Haptics.selectionAsync().catch(() => {});
      setSelectionMode(true);
      setSelectedIds(selection, new Set([id]));
    },
    [selection],
  );

  const toggleSelection = useCallback(
    (id: string) => {
      if (
        selectingAllRef.current ||
        savingRef.current ||
        deletePhaseRef.current !== "idle"
      ) {
        return;
      }
      const next = new Set(selection.getState().ids);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setSelectedIds(selection, next);
    },
    [selection],
  );

  const updateDragSelection = useCallback(
    (id: string) => {
      const drag = dragSelectionRef.current;
      if (!drag || drag.lastId === id) return;
      const anchorIndex = loadedIndexById.get(drag.anchorId);
      const index = loadedIndexById.get(id);
      if (anchorIndex === undefined || index === undefined) return;
      drag.lastId = id;

      // 드래그 시작 시점의 선택에서 다시 계산해, 범위를 줄이면 원래대로 돌아간다.
      const next = new Set(drag.base);
      const end = Math.max(anchorIndex, index);
      for (let i = Math.min(anchorIndex, index); i <= end; i += 1) {
        const rangeId = generationHistory[i].id;
        if (drag.remove) next.delete(rangeId);
        else next.add(rangeId);
      }
      Haptics.selectionAsync().catch(() => {});
      setSelectedIds(selection, next);
    },
    [generationHistory, loadedIndexById, selection],
  );

  const beginDragSelection = useCallback(
    (id: string) => {
      if (
        selectingAllRef.current ||
        savingRef.current ||
        deletePhaseRef.current !== "idle"
      ) {
        return false;
      }
      if (!selectionMode) {
        dragSelectionRef.current = {
          anchorId: id,
          lastId: id,
          base: new Set(),
          remove: false,
        };
        enterSelectionMode(id);
        return true;
      }
      const selectedIds = selection.getState().ids;
      const remove = selectedIds.has(id);
      const base = new Set(selectedIds);
      if (remove) base.delete(id);
      else base.add(id);
      dragSelectionRef.current = { anchorId: id, lastId: id, base, remove };
      Haptics.selectionAsync().catch(() => {});
      setSelectedIds(selection, base);
      return true;
    },
    [enterSelectionMode, selection, selectionMode],
  );

  const endDragSelection = useCallback(() => {
    dragSelectionRef.current = null;
  }, []);

  const handleTilePress = useCallback(
    (item: GenerationRecord) => {
      if (
        selectingAllRef.current ||
        savingRef.current ||
        deletePhaseRef.current !== "idle"
      ) {
        return;
      }
      if (selectionMode) {
        toggleSelection(item.id);
        return;
      }

      useGenerationStore.getState().selectGeneration(item);
      onClose();
    },
    [onClose, selectionMode, toggleSelection],
  );

  const handleActiveGenerationPress = useCallback(() => {
    if (busy || selectionMode || !isLoading) return;
    useGenerationStore.getState().viewActiveGeneration();
    onClose();
  }, [busy, isLoading, onClose, selectionMode]);

  const toggleSelectAll = useCallback(async () => {
    if (
      busy ||
      selectingAllRef.current ||
      savingRef.current ||
      deletePhaseRef.current !== "idle"
    ) {
      return;
    }
    Haptics.selectionAsync().catch(() => {});
    if (isAllSelected(selection.getState())) {
      setSelectedIds(selection, new Set());
      return;
    }
    const request = ++selectionRequestRef.current;
    selectingAllRef.current = true;
    setSelectingAll(true);
    try {
      const ids = await loadHistoryIds();
      if (selectionRequestRef.current === request) {
        setSelectedIds(selection, new Set(ids));
      }
    } catch {
      if (selectionRequestRef.current === request) {
        toast.error("History 목록을 불러오지 못했습니다. 다시 시도해 주세요.");
      }
    } finally {
      if (selectionRequestRef.current === request) {
        selectingAllRef.current = false;
        setSelectingAll(false);
      }
    }
  }, [busy, loadHistoryIds, selection]);

  const saveSelected = useCallback(async () => {
    const ids = [...selection.getState().ids];
    if (
      ids.length === 0 ||
      busy ||
      selectingAllRef.current ||
      savingRef.current ||
      deletePhaseRef.current !== "idle"
    ) {
      return;
    }

    savingRef.current = true;
    let savedCount = 0;
    try {
      setSaving(true);
      if (!(await requestGallerySavePermission())) {
        toast.error("사진 저장 권한이 필요합니다.");
        return;
      }

      let failedCount = 0;
      for await (const batch of iterateGenerationImageBatches(ids)) {
        let nextIndex = 0;
        const saveNext = async () => {
          while (nextIndex < batch.length) {
            const { imagePath } = batch[nextIndex++];
            try {
              if (imagePath === null) {
                failedCount += 1;
                continue;
              }
              await saveImageToGallery(
                resolveGenerationImageUri({ imagePath }),
              );
              savedCount += 1;
            } catch {
              failedCount += 1;
            }
          }
        };
        await Promise.all(
          Array.from(
            { length: Math.min(HISTORY_SAVE_CONCURRENCY, batch.length) },
            saveNext,
          ),
        );
      }
      if (failedCount > 0) {
        Alert.alert(
          savedCount > 0 ? "일부 이미지 저장 실패" : "저장 실패",
          `저장 성공: ${savedCount}개\n저장 실패: ${failedCount}개`,
        );
      } else {
        toast.success(`${savedCount}개의 이미지를 저장했습니다.`);
      }
    } catch {
      if (savedCount > 0) {
        Alert.alert(
          "일부 이미지 저장 실패",
          `저장 성공: ${savedCount}개\n저장 실패: ${ids.length - savedCount}개`,
        );
      } else {
        toast.error("선택한 이미지를 휴대폰 저장소에 저장하지 못했습니다.");
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [busy, selection]);

  const deleteSelected = useCallback(() => {
    const ids = [...selection.getState().ids];
    if (
      ids.length === 0 ||
      busy ||
      selectingAllRef.current ||
      savingRef.current ||
      deletePhaseRef.current !== "idle"
    ) {
      return;
    }

    deletePhaseRef.current = "confirming";
    setDeleteConfirmationOpen(true);

    const dismissConfirmation = () => {
      if (deletePhaseRef.current !== "confirming") return;
      deletePhaseRef.current = "idle";
      setDeleteConfirmationOpen(false);
    };

    Alert.alert(
      "이미지 삭제",
      `${ids.length}개의 이미지를 영구 삭제합니다.\n삭제한 이미지는 복구할 수 없습니다.`,
      [
        {
          text: "취소",
          style: "cancel",
          onPress: dismissConfirmation,
        },
        {
          text: "삭제",
          style: "destructive",
          onPress: () => {
            deletePhaseRef.current = "deleting";
            setDeleteConfirmationOpen(false);
            setDeleting(true);

            void deleteGenerations(ids)
              .then(() => {
                exitSelectionMode();
                toast.success(`${ids.length}개의 이미지를 삭제했습니다.`);
              })
              .catch(() => {
                toast.error("선택한 이미지를 history에서 삭제하지 못했습니다.");
              })
              .finally(() => {
                deletePhaseRef.current = "idle";
                setDeleting(false);
              });
          },
        },
      ],
      {
        cancelable: true,
        onDismiss: dismissConfirmation,
      },
    );
  }, [busy, deleteGenerations, exitSelectionMode, selection]);

  return useMemo(
    () => ({
      generationHistory,
      currentGenerationId,
      isLoading,
      streamingPreviewUri,
      isViewingActiveGeneration,
      historyInitialized,
      historyLoadingMore,
      loadMoreHistory,
      gridColumns,
      gridInitialIndex,
      setGridFirstVisibleIndex,
      resetGridPosition,
      cycleGridColumns,
      listEngine,
      cycleListEngine,
      selectionMode,
      selection,
      busy,
      selectingAll,
      saving,
      deleting,
      closeSheet: onClose,
      exitSelectionMode,
      enterSelectionMode,
      beginDragSelection,
      updateDragSelection,
      endDragSelection,
      handleTilePress,
      handleActiveGenerationPress,
      toggleSelectAll,
      saveSelected,
      deleteSelected,
    }),
    [
      beginDragSelection,
      busy,
      selectingAll,
      deleteSelected,
      deleting,
      enterSelectionMode,
      exitSelectionMode,
      generationHistory,
      currentGenerationId,
      isLoading,
      streamingPreviewUri,
      isViewingActiveGeneration,
      handleTilePress,
      handleActiveGenerationPress,
      historyInitialized,
      historyLoadingMore,
      loadMoreHistory,
      onClose,
      saveSelected,
      saving,
      selection,
      selectionMode,
      toggleSelectAll,
      cycleGridColumns,
      cycleListEngine,
      listEngine,
      gridColumns,
      gridInitialIndex,
      resetGridPosition,
      setGridFirstVisibleIndex,
      endDragSelection,
      updateDragSelection,
    ],
  );
}

export type HistorySheetController = ReturnType<
  typeof useHistorySheetController
>;
