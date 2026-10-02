import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
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
  type BottomSheetFlatListMethods,
  type BottomSheetFooterProps,
} from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";

import {
  GENERATION_SHEET_HEADER_HEIGHT,
  useGenerationChromeMetrics,
} from "../../hooks/useGenerationChromeMetrics";
import { type GenerationRecord } from "../../lib/generationHistory";
import { tokens } from "../../styles/tokens";
import {
  ActiveGenerationTile,
  GRID_GAP,
  HistorySheetTile,
} from "./history/HistoryTiles";
import { type HistorySheetController } from "./history/useHistorySheetController";

export {
  type HistorySheetController,
  useHistorySheetController,
} from "./history/useHistorySheetController";

const GRID_PADDING = 12;
const HISTORY_SELECTION_ACTIONS_HEIGHT = 56;
const HISTORY_SCROLL_BOTTOM_GAP = 28;
const HISTORY_SCROLL_TOP_THRESHOLD = 600;
const HISTORY_SCROLL_TOP_BUTTON_GAP = 16;

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
            activeOpacity={tokens.opacity.pressed}
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
          activeOpacity={tokens.opacity.pressed}
          onPress={exitSelectionMode}
          style={styles.headerTextButton}
        >
          <Text style={styles.cancelText}>취소</Text>
        </BottomSheetTouchableOpacity>
      ) : (
        <BottomSheetTouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="History 닫기"
          activeOpacity={tokens.opacity.pressed}
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
  active = true,
}: {
  controller: HistorySheetController;
  active?: boolean;
}) {
  const { actionBarHeight } = useGenerationChromeMetrics();
  const { width } = useWindowDimensions();
  const {
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
    busy,
    enterSelectionMode,
    handleTilePress,
    handleActiveGenerationPress,
  } = controller;
  const tileSize = Math.floor((width - GRID_PADDING * 2 - GRID_GAP * 2) / 3);
  const listData = useMemo<(GenerationRecord | null)[]>(
    () => (isLoading ? [null, ...generationHistory] : generationHistory),
    [generationHistory, isLoading],
  );
  const activeGenerationSelected = isLoading && isViewingActiveGeneration;
  // Swapping the margin and padding in one commit lets the scroll view clamp
  // its offset mid-update. Trail one frame so the scroll range never shrinks.
  const [settledSelectionMode, setSettledSelectionMode] =
    useState(selectionMode);
  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      setSettledSelectionMode(selectionMode),
    );
    return () => cancelAnimationFrame(frame);
  }, [selectionMode]);
  const listEndsAboveSelectionActions = selectionMode || settledSelectionMode;
  const contentClearsSelectionActions = !(
    selectionMode && settledSelectionMode
  );
  const listRef = useRef<BottomSheetFlatListMethods>(null);
  const [scrollTopVisible, setScrollTopVisible] = useState(false);
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) =>
      setScrollTopVisible(
        event.nativeEvent.contentOffset.y > HISTORY_SCROLL_TOP_THRESHOLD,
      ),
    [],
  );

  return (
    // The sheet pads its content container for over-drag; anchor the button to
    // an in-flow box so it is not offset by that padding.
    <View style={styles.listContainer}>
      <BottomSheetFlatList
        ref={listRef}
        // gorhom forwards onScroll at runtime but omits it from the prop types.
        {...({ onScroll: handleScroll } as object)}
        data={listData}
        keyExtractor={(item) => item?.id ?? "active-generation"}
        numColumns={3}
        // Android detaches off-screen rows by default; resizing the list on
        // selection toggles can leave visible rows detached.
        removeClippedSubviews={false}
        accessibilityElementsHidden={!active}
        importantForAccessibility={active ? "auto" : "no-hide-descendants"}
        initialNumToRender={15}
        maxToRenderPerBatch={9}
        windowSize={7}
        onEndReached={() => {
          void loadMoreHistory();
        }}
        onEndReachedThreshold={0.4}
        // End the list above the action bar and selection actions so the scroll
        // indicator stays visible.
        style={{
          marginBottom:
            actionBarHeight +
            (listEndsAboveSelectionActions
              ? HISTORY_SELECTION_ACTIONS_HEIGHT
              : 0),
        }}
        contentContainerStyle={[
          styles.gridContent,
          {
            paddingBottom:
              (contentClearsSelectionActions
                ? HISTORY_SELECTION_ACTIONS_HEIGHT
                : 0) + HISTORY_SCROLL_BOTTOM_GAP,
          },
          listData.length === 0 && styles.emptyGrid,
        ]}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            {historyInitialized ? (
              <>
                <Text style={styles.emptyTitle}>
                  아직 생성한 이미지가 없어요
                </Text>
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
        renderItem={({ item, index }) =>
          item === null ? (
            <ActiveGenerationTile
              index={index}
              size={tileSize}
              previewUri={streamingPreviewUri}
              selected={activeGenerationSelected}
              disabled={busy || selectionMode}
              onPress={handleActiveGenerationPress}
            />
          ) : (
            <HistorySheetTile
              item={item}
              index={index}
              size={tileSize}
              selectionMode={selectionMode}
              selected={selectedIds.has(item.id)}
              isCurrent={
                !activeGenerationSelected && item.id === currentGenerationId
              }
              disabled={busy}
              onPress={handleTilePress}
              onLongPress={enterSelectionMode}
            />
          )
        }
      />
      {active && scrollTopVisible ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="History 맨 위로 이동"
          onPress={() =>
            listRef.current?.scrollToOffset({ offset: 0, animated: true })
          }
          style={({ pressed }) => [
            styles.scrollTopButton,
            {
              bottom:
                actionBarHeight +
                (selectionMode ? HISTORY_SELECTION_ACTIONS_HEIGHT : 0) +
                HISTORY_SCROLL_TOP_BUTTON_GAP,
            },
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name="arrow-up"
            size={20}
            color={tokens.color.textPrimary}
          />
        </Pressable>
      ) : null}
    </View>
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
  listContainer: {
    flex: 1,
  },
  scrollTopButton: {
    position: "absolute",
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.borderSubtle,
    backgroundColor: tokens.color.raised,
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
    opacity: tokens.opacity.pressed,
  },
  disabled: {
    opacity: 0.35,
  },
});
