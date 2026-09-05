import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import {
  BottomSheetFlatList,
  BottomSheetFooter,
  TouchableOpacity as BottomSheetTouchableOpacity,
  type BottomSheetFooterProps,
} from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import * as Haptics from "expo-haptics";
import * as MediaLibrary from "expo-media-library";
import { toast } from "sonner-native";

import {
  GENERATION_ACTION_BAR_CONTENT_HEIGHT,
  GENERATION_SHEET_HEADER_HEIGHT,
  useGenerationChromeMetrics,
} from "../../hooks/useGenerationChromeMetrics";
import {
  type GenerationRecord,
  iterateGenerationImageBatches,
  resolveGenerationImageUri,
  resolveGenerationThumbnailUri,
} from "../../lib/generationHistory";
import { useGenerationStore } from "../../store/generationStore";
import { tokens } from "../../styles/tokens";

const GRID_PADDING = 12;
const GRID_GAP = 8;
const HISTORY_SELECTION_ACTIONS_HEIGHT = 56;
const HISTORY_SCROLL_BOTTOM_GAP = 28;
const HISTORY_SAVE_CONCURRENCY = 3;

const HistorySheetTile = memo(function HistorySheetTile({
  item,
  index,
  size,
  selectionMode,
  selected,
  isCurrent,
  disabled,
  onPress,
  onLongPress,
}: {
  item: GenerationRecord;
  index: number;
  size: number;
  selectionMode: boolean;
  selected: boolean;
  isCurrent: boolean;
  disabled: boolean;
  onPress: (item: GenerationRecord) => void;
  onLongPress: (id: string) => void;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        marginRight: index % 3 === 2 ? 0 : GRID_GAP,
        marginBottom: GRID_GAP,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          selectionMode
            ? selected
              ? "History 이미지 선택 해제"
              : "History 이미지 선택"
            : "메인 이미지로 표시"
        }
        accessibilityHint={isCurrent ? "현재 메인에 표시 중인 이미지" : undefined}
        accessibilityState={{
          selected: selectionMode ? selected : undefined,
          disabled,
        }}
        disabled={disabled}
        delayLongPress={180}
        onPress={() => onPress(item)}
        onLongPress={() => onLongPress(item.id)}
        style={({ pressed }) => [
          StyleSheet.absoluteFill,
          styles.tile,
          pressed && styles.pressed,
        ]}
      >
        <ExpoImage
          source={{
            uri:
              resolveGenerationThumbnailUri(item) ??
              resolveGenerationImageUri(item),
          }}
          contentFit="cover"
          recyclingKey={item.id}
          transition={120}
          style={StyleSheet.absoluteFill}
        />
        {selected ? (
          <View pointerEvents="none" style={styles.selectedDim} />
        ) : null}
        {selectionMode ? (
          <View
            pointerEvents="none"
            style={[
              styles.selectionIndicator,
              selected && styles.selectionIndicatorSelected,
            ]}
          >
            {selected ? (
              <Ionicons
                name="checkmark"
                size={14}
                color={tokens.color.onAccent}
              />
            ) : null}
          </View>
        ) : null}
        {isCurrent ? (
          <View pointerEvents="none" style={styles.currentRing} />
        ) : null}
        {selected ? (
          <View pointerEvents="none" style={styles.selectedRing} />
        ) : null}
      </Pressable>
    </View>
  );
});

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

  useEffect(() => () => {
    selectionRequestRef.current += 1;
  }, []);

  const availableIdList = useMemo(
    () => historyIds ?? generationHistory.map((item) => item.id),
    [historyIds, generationHistory],
  );
  const availableIds = useMemo(() => new Set(availableIdList), [availableIdList]);
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

  const toggleSelection = useCallback((id: string) => {
    if (
      selectingAllRef.current ||
      savingRef.current ||
      deletePhaseRef.current !== "idle"
    ) {
      return;
    }
    setSelectedIds((current) => {
      const next = new Set([...current].filter((value) => availableIds.has(value)));
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, [availableIds]);

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

      useGenerationStore.setState({ currentGeneration: item });
      onClose();
    },
    [onClose, selectionMode, toggleSelection],
  );

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
        Alert.alert(
          "전체 선택 실패",
          "History 목록을 불러오지 못했습니다. 다시 시도해 주세요.",
        );
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
      const permission = await MediaLibrary.requestPermissionsAsync(true, [
        "photo",
      ]);
      if (!permission.granted) {
        Alert.alert("저장 실패", "사진 저장 권한이 필요합니다.");
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
              await MediaLibrary.Asset.create(
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
      Alert.alert(
        savedCount > 0 ? "일부 이미지 저장 실패" : "저장 실패",
        savedCount > 0
          ? `저장 성공: ${savedCount}개\n저장 실패: ${ids.length - savedCount}개`
          : "선택한 이미지를 휴대폰 저장소에 저장하지 못했습니다.",
      );
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
                Alert.alert(
                  "삭제 실패",
                  "선택한 이미지를 history에서 삭제하지 못했습니다.",
                );
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
      handleTilePress,
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

const HistorySheetHeader = memo(function HistorySheetHeader({
  controller,
}: {
  controller: HistorySheetController;
}) {
  const {
    selectionMode,
    selectedCount,
    allSelected,
    busy,
    selectingAll,
    closeSheet,
    exitSelectionMode,
    toggleSelectAll,
  } = controller;

  return (
    <View style={styles.header}>
      {selectionMode ? (
        <View style={styles.selectionHeaderContent}>
          <Text style={styles.selectionCount}>
            {selectingAll ? "선택 중..." : `${selectedCount}개 선택`}
          </Text>
          <BottomSheetTouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={allSelected ? "전체 선택 해제" : "전체 선택"}
            accessibilityHint="화면에 불러오지 않은 항목도 포함합니다. 이후 생성된 이미지는 자동 선택되지 않습니다."
            accessibilityState={{ disabled: busy, busy: selectingAll }}
            disabled={busy}
            activeOpacity={0.65}
            onPress={() => void toggleSelectAll()}
            style={[styles.headerTextButton, busy && styles.disabled]}
          >
            <Text style={styles.selectAllText}>
              {allSelected ? "전체 해제" : "전체 선택"}
            </Text>
          </BottomSheetTouchableOpacity>
        </View>
      ) : (
        <Text style={styles.title}>History</Text>
      )}

      {selectionMode ? (
        <BottomSheetTouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="선택 취소"
          activeOpacity={0.65}
          onPress={exitSelectionMode}
          style={styles.headerTextButton}
        >
          <Text style={styles.cancelText}>취소</Text>
        </BottomSheetTouchableOpacity>
      ) : (
        <BottomSheetTouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="History 닫기"
          activeOpacity={0.65}
          onPress={closeSheet}
          style={styles.closeButton}
        >
          <Ionicons name="close" size={21} color={tokens.color.textPrimary} />
        </BottomSheetTouchableOpacity>
      )}
    </View>
  );
});

export const HistorySheetHandle = memo(function HistorySheetHandle({
  controller,
}: {
  controller: HistorySheetController;
}) {
  return (
    <View style={styles.sheetHandle}>
      <View style={styles.handleArea}>
        <View style={styles.handleIndicator} />
      </View>
      <HistorySheetHeader controller={controller} />
    </View>
  );
});

export const HistorySheetContent = memo(function HistorySheetContent({
  controller,
}: {
  controller: HistorySheetController;
}) {
  const { actionBarHeight } = useGenerationChromeMetrics();
  const { width } = useWindowDimensions();
  const {
    generationHistory,
    currentGenerationId,
    historyInitialized,
    historyLoadingMore,
    loadMoreHistory,
    selectionMode,
    selectedIds,
    busy,
    enterSelectionMode,
    handleTilePress,
  } = controller;
  const tileSize = Math.floor(
    (width - GRID_PADDING * 2 - GRID_GAP * 2) / 3,
  );

  return (
    <BottomSheetFlatList
        data={generationHistory}
        keyExtractor={(item) => item.id}
        numColumns={3}
        showsVerticalScrollIndicator={false}
        initialNumToRender={15}
        maxToRenderPerBatch={9}
        windowSize={7}
        onEndReached={() => {
          void loadMoreHistory();
        }}
        onEndReachedThreshold={0.4}
        contentContainerStyle={[
          styles.gridContent,
          {
            paddingBottom:
              actionBarHeight +
              HISTORY_SELECTION_ACTIONS_HEIGHT +
              HISTORY_SCROLL_BOTTOM_GAP,
          },
          generationHistory.length === 0 && styles.emptyGrid,
        ]}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            {historyInitialized ? (
              <>
                <Text style={styles.emptyTitle}>아직 생성한 이미지가 없어요</Text>
                <Text style={styles.emptyText}>
                  이미지를 생성하면 여기에 기록이 쌓입니다
                </Text>
              </>
            ) : (
              <ActivityIndicator
                accessibilityLabel="History 불러오는 중"
                color={tokens.color.textMuted}
              />
            )}
          </View>
        }
        ListFooterComponent={
          historyLoadingMore ? (
            <View style={styles.loadingFooter}>
              <ActivityIndicator
                accessibilityLabel="이전 History 불러오는 중"
                color={tokens.color.textMuted}
              />
            </View>
          ) : null
        }
        renderItem={({ item, index }) => (
          <HistorySheetTile
            item={item}
            index={index}
            size={tileSize}
            selectionMode={selectionMode}
            selected={selectedIds.has(item.id)}
            isCurrent={item.id === currentGenerationId}
            disabled={busy}
            onPress={handleTilePress}
            onLongPress={enterSelectionMode}
          />
        )}
      />
  );
});

export const HistorySheetFooter = memo(function HistorySheetFooter({
  animatedFooterPosition,
  controller,
}: BottomSheetFooterProps & {
  controller: HistorySheetController;
}) {
  const { actionBarHeight } = useGenerationChromeMetrics();
  const {
    selectionMode,
    selectedCount,
    busy,
    saving,
    deleting,
    saveSelected,
    deleteSelected,
  } = controller;

  return (
    <BottomSheetFooter
      animatedFooterPosition={animatedFooterPosition}
      bottomInset={actionBarHeight - 1}
    >
      {selectionMode ? (
        <View style={styles.selectionActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="선택 이미지 저장"
            accessibilityState={{ disabled: selectedCount === 0 || busy }}
            disabled={selectedCount === 0 || busy}
            onPress={() => void saveSelected()}
            style={({ pressed }) => [
              styles.actionButton,
              (selectedCount === 0 || busy) && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            {saving ? (
              <ActivityIndicator
                color={tokens.color.textTertiary}
                size="small"
              />
            ) : (
              <Ionicons
                name="save-outline"
                size={20}
                color={tokens.color.textTertiary}
              />
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="선택 이미지 삭제"
            accessibilityState={{ disabled: selectedCount === 0 || busy }}
            disabled={selectedCount === 0 || busy}
            onPress={() => void deleteSelected()}
            style={({ pressed }) => [
              styles.actionButton,
              (selectedCount === 0 || busy) && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            {deleting ? (
              <ActivityIndicator color={tokens.color.negative} size="small" />
            ) : (
              <Ionicons
                name="trash-outline"
                size={20}
                color={tokens.color.negative}
              />
            )}
          </Pressable>
        </View>
      ) : (
        <View style={styles.emptyFooter} />
      )}
    </BottomSheetFooter>
  );
});

const styles = StyleSheet.create({
  sheetHandle: {
    backgroundColor: tokens.color.cardAlt,
  },
  handleArea: {
    height: 17,
    paddingTop: 9,
    paddingBottom: 3,
    alignItems: "center",
  },
  handleIndicator: {
    width: 38,
    height: 5,
    borderRadius: 3,
    backgroundColor: tokens.color.borderSubtleStrong,
  },
  header: {
    height: GENERATION_SHEET_HEADER_HEIGHT,
    paddingLeft: 20,
    paddingRight: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.color.borderSubtle,
    backgroundColor: tokens.color.cardAlt,
  },
  title: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: 23,
    letterSpacing: -0.3,
  },
  selectionHeaderContent: {
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  selectionCount: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: 18,
    letterSpacing: -0.2,
  },
  headerTextButton: {
    minHeight: 38,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  selectAllText: {
    color: tokens.color.accent,
    fontFamily: tokens.font.semibold,
    fontSize: 14,
  },
  cancelText: {
    color: tokens.color.textSecondary,
    fontFamily: tokens.font.semibold,
    fontSize: 14,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.raised,
  },
  gridContent: {
    paddingTop: GRID_PADDING,
    paddingHorizontal: GRID_PADDING,
  },
  emptyGrid: {
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 32,
    paddingBottom: GENERATION_ACTION_BAR_CONTENT_HEIGHT,
  },
  emptyTitle: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: 16,
  },
  emptyText: {
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.regular,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  loadingFooter: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
  },
  tile: {
    overflow: "hidden",
    borderRadius: 12,
    backgroundColor: tokens.color.sunken,
  },
  selectedDim: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(10,10,12,0.38)",
  },
  selectedRing: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderWidth: 2,
    borderColor: tokens.color.accent,
    borderRadius: 12,
  },
  currentRing: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderWidth: 2,
    borderColor: tokens.color.accent,
    borderRadius: 12,
  },
  selectionIndicator: {
    position: "absolute",
    top: 7,
    left: 7,
    width: 22,
    height: 22,
    borderWidth: 1.5,
    borderColor: tokens.color.textPrimary,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10,10,12,0.42)",
  },
  selectionIndicatorSelected: {
    borderColor: tokens.color.accent,
    backgroundColor: tokens.color.accent,
  },
  selectionActions: {
    height: HISTORY_SELECTION_ACTIONS_HEIGHT,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.color.borderSubtle,
    backgroundColor: tokens.color.cardAlt,
  },
  emptyFooter: {
    height: 0,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.65,
  },
  disabled: {
    opacity: 0.35,
  },
});
