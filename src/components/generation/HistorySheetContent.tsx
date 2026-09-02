import { memo, useCallback, useMemo, useRef, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { toast } from "sonner-native";

import {
  type GenerationRecord,
  resolveGenerationImageUri,
  resolveGenerationThumbnailUri,
} from "../../lib/generationHistory";
import { useGenerationStore } from "../../store/generationStore";
import { tokens } from "../../styles/tokens";

const GRID_PADDING = 12;
const GRID_GAP = 8;
const HEADER_HEIGHT = 52;
const GENERATION_ACTION_BAR_HEIGHT = 72;
const HISTORY_FOOTER_BOTTOM_INSET = GENERATION_ACTION_BAR_HEIGHT - 1;
const HISTORY_SHEET_BOTTOM_PADDING = 156;

const HistorySheetTile = memo(function HistorySheetTile({
  item,
  index,
  size,
  selectionMode,
  selected,
  isCurrent,
  onPress,
  onLongPress,
}: {
  item: GenerationRecord;
  index: number;
  size: number;
  selectionMode: boolean;
  selected: boolean;
  isCurrent: boolean;
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
        accessibilityState={{ selected: selectionMode ? selected : undefined }}
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const deletePhaseRef = useRef<"idle" | "confirming" | "deleting">("idle");

  const selectedCount = selectedIds.size;
  const allSelected =
    generationHistory.length > 0 && selectedCount === generationHistory.length;
  const busy = saving || deleting || deleteConfirmationOpen;
  const selectedRecords = useMemo(
    () => generationHistory.filter((item) => selectedIds.has(item.id)),
    [generationHistory, selectedIds],
  );

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const enterSelectionMode = useCallback((id: string) => {
    Haptics.selectionAsync().catch(() => {});
    setSelectionMode(true);
    setSelectedIds(new Set([id]));
  }, []);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleTilePress = useCallback(
    (item: GenerationRecord) => {
      if (selectionMode) {
        toggleSelection(item.id);
        return;
      }

      useGenerationStore.setState({ currentGeneration: item });
      onClose();
    },
    [onClose, selectionMode, toggleSelection],
  );

  const toggleSelectAll = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    setSelectedIds(
      allSelected
        ? new Set()
        : new Set(generationHistory.map((item) => item.id)),
    );
  }, [allSelected, generationHistory]);

  const saveSelected = useCallback(async () => {
    if (selectedCount === 0 || busy) return;

    try {
      setSaving(true);
      const permission = await MediaLibrary.requestPermissionsAsync(true, [
        "photo",
      ]);
      if (!permission.granted) {
        Alert.alert("저장 실패", "사진 저장 권한이 필요합니다.");
        return;
      }

      await Promise.all(
        selectedRecords.map((record) =>
          MediaLibrary.Asset.create(resolveGenerationImageUri(record)),
        ),
      );
      toast.success(`${selectedRecords.length}개의 이미지를 저장했습니다.`);
    } catch {
      Alert.alert(
        "저장 실패",
        "선택한 이미지를 휴대폰 저장소에 저장하지 못했습니다.",
      );
    } finally {
      setSaving(false);
    }
  }, [busy, selectedCount, selectedRecords]);

  const deleteSelected = useCallback(() => {
    if (
      selectedCount === 0 ||
      busy ||
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
    closeSheet,
    exitSelectionMode,
    toggleSelectAll,
  } = controller;

  return (
    <View style={styles.header}>
      {selectionMode ? (
        <View style={styles.selectionHeaderContent}>
          <Text style={styles.selectionCount}>{selectedCount}개 선택</Text>
          <BottomSheetTouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={allSelected ? "전체 선택 해제" : "전체 선택"}
            activeOpacity={0.65}
            onPress={toggleSelectAll}
            style={styles.headerTextButton}
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
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const {
    generationHistory,
    currentGenerationId,
    historyInitialized,
    historyLoadingMore,
    loadMoreHistory,
    selectionMode,
    selectedIds,
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
          { paddingBottom: HISTORY_SHEET_BOTTOM_PADDING + insets.bottom },
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
      bottomInset={HISTORY_FOOTER_BOTTOM_INSET}
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
    height: HEADER_HEIGHT,
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
    paddingBottom: GENERATION_ACTION_BAR_HEIGHT,
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
    height: 56,
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
