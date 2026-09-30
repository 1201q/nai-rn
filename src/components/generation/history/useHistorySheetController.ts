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
import { useGenerationStore } from "../../../store/generationStore";

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
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectionIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [selectingAll, setSelectingAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const savingRef = useRef(false);
  const selectingAllRef = useRef(false);
  const selectionRequestRef = useRef(0);
  const deletePhaseRef = useRef<"idle" | "confirming" | "deleting">("idle");

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
  const selectedIds = useMemo(() => {
    const validIds = [...selectionIds].filter((id) => availableIds.has(id));
    return validIds.length === selectionIds.size
      ? selectionIds
      : new Set(validIds);
  }, [availableIds, selectionIds]);
  const selectedCount = selectedIds.size;
  const allSelected =
    (historyIds !== null || !historyHasMore) &&
    selectedCount > 0 &&
    selectedCount === availableIds.size;
  const busy = selectingAll || saving || deleting || deleteConfirmationOpen;

  const exitSelectionMode = useCallback(() => {
    selectionRequestRef.current += 1;
    selectingAllRef.current = false;
    setSelectingAll(false);
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const enterSelectionMode = useCallback((id: string) => {
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
    setSelectedIds(new Set([id]));
  }, []);

  const toggleSelection = useCallback(
    (id: string) => {
      if (
        selectingAllRef.current ||
        savingRef.current ||
        deletePhaseRef.current !== "idle"
      ) {
        return;
      }
      setSelectedIds((current) => {
        const next = new Set(
          [...current].filter((value) => availableIds.has(value)),
        );
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [availableIds],
  );

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
    if (allSelected) {
      setSelectedIds(new Set());
      return;
    }
    const request = ++selectionRequestRef.current;
    selectingAllRef.current = true;
    setSelectingAll(true);
    try {
      const ids = await loadHistoryIds();
      if (selectionRequestRef.current === request) {
        setSelectedIds(new Set(ids));
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
  }, [allSelected, busy, loadHistoryIds]);

  const saveSelected = useCallback(async () => {
    if (
      selectedCount === 0 ||
      busy ||
      selectingAllRef.current ||
      savingRef.current ||
      deletePhaseRef.current !== "idle"
    ) {
      return;
    }

    savingRef.current = true;
    const ids = [...selectedIds];
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
  }, [busy, selectedCount, selectedIds]);

  const deleteSelected = useCallback(() => {
    if (
      selectedCount === 0 ||
      busy ||
      selectingAllRef.current ||
      savingRef.current ||
      deletePhaseRef.current !== "idle"
    ) {
      return;
    }

    deletePhaseRef.current = "confirming";
    setDeleteConfirmationOpen(true);
    const ids = [...selectedIds];

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
  }, [busy, deleteGenerations, exitSelectionMode, selectedCount, selectedIds]);

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
      selectionMode,
      selectedIds,
      selectedCount,
      allSelected,
      busy,
      selectingAll,
      saving,
      deleting,
      closeSheet: onClose,
      exitSelectionMode,
      enterSelectionMode,
      handleTilePress,
      handleActiveGenerationPress,
      toggleSelectAll,
      saveSelected,
      deleteSelected,
    }),
    [
      allSelected,
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
      selectedCount,
      selectedIds,
      selectionMode,
      toggleSelectAll,
    ],
  );
}

export type HistorySheetController = ReturnType<
  typeof useHistorySheetController
>;
