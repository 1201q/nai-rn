import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import {
  BottomSheetFooter,
  TouchableOpacity as BottomSheetTouchableOpacity,
  type BottomSheetFooterProps,
} from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useStore } from "zustand";
import { GestureDetector } from "react-native-gesture-handler";

import {
  GENERATION_ACTION_BAR_CONTENT_HEIGHT,
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
import { HistoryGridList } from "./history/HistoryGridList";
import { isAllSelected } from "./history/historySelection";
import { useHistoryDragSelection } from "./history/useHistoryDragSelection";
import { type HistorySheetController } from "./history/useHistorySheetController";

export {
  type HistorySheetController,
  useHistorySheetController,
} from "./history/useHistorySheetController";

const GRID_PADDING = 12;
// 선택 모드의 플로팅 알약(48)과 액션바 사이 간격(14).
const HISTORY_SELECTION_PILL_HEIGHT = 48;
const HISTORY_SELECTION_PILL_GAP = 14;
const HISTORY_SELECTION_ACTIONS_HEIGHT =
  HISTORY_SELECTION_PILL_HEIGHT + HISTORY_SELECTION_PILL_GAP;
const HISTORY_SELECTION_FADE_HEIGHT = 120;
const HISTORY_SCROLL_BOTTOM_GAP = 28;

const HistorySheetHeader = memo(function HistorySheetHeader({
  controller,
}: {
  controller: HistorySheetController;
}) {
  const {
    selectionMode,
    selection,
    busy,
    selectingAll,
    gridColumns,
    cycleGridColumns,
    listEngine,
    cycleListEngine,
    closeSheet,
    exitSelectionMode,
    toggleSelectAll,
  } = controller;
  const selectedCount = useStore(selection, (state) => state.ids.size);
  const allSelected = useStore(selection, isAllSelected);

  return (
    <View style={styles.header}>
      <View style={styles.headerSide}>
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
            <Ionicons
              name="close-outline"
              size={22}
              color={tokens.color.textPrimary}
            />
          </BottomSheetTouchableOpacity>
        )}
      </View>

      <Text style={styles.title}>
        {!selectionMode
          ? "History"
          : selectingAll
            ? "선택 중..."
            : `${selectedCount}개 선택`}
      </Text>

      <View style={[styles.headerSide, styles.headerSideEnd]}>
        {selectionMode ? (
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
        ) : (
          <View style={styles.headerButtons}>
            <BottomSheetTouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="리스트 구현 변경 (비교용)"
              accessibilityValue={{ text: listEngine }}
              activeOpacity={tokens.opacity.pressed}
              onPress={cycleListEngine}
              style={styles.headerTextButton}
            >
              <Text style={styles.cancelText}>{listEngine}</Text>
            </BottomSheetTouchableOpacity>
            <BottomSheetTouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="한 줄에 보이는 이미지 수 변경"
              accessibilityValue={{ text: `${gridColumns}개` }}
              activeOpacity={tokens.opacity.pressed}
              onPress={cycleGridColumns}
              style={[styles.closeButton, styles.gridButton]}
            >
              <Ionicons
                name="grid-outline"
                size={16}
                color={tokens.color.textPrimary}
              />
            </BottomSheetTouchableOpacity>
          </View>
        )}
      </View>
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
  sheetOpen = true,
}: {
  controller: HistorySheetController;
  sheetOpen?: boolean;
}) {
  return (
    <HistorySheetGrid
      key={`${controller.listEngine}-${controller.gridColumns}`}
      controller={controller}
      sheetOpen={sheetOpen}
    />
  );
});

const HistorySheetGrid = memo(function HistorySheetGrid({
  controller,
  sheetOpen,
}: {
  controller: HistorySheetController;
  sheetOpen: boolean;
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
    gridColumns: columns,
    listEngine,
    getGridPosition,
    saveGridPosition,
    selectionMode,
    selection,
    busy,
    enterSelectionMode,
    beginDragSelection,
    updateDragSelection,
    endDragSelection,
    handleTilePress,
    handleActiveGenerationPress,
  } = controller;
  const tileSize = Math.floor(
    (width - GRID_PADDING * 2 - GRID_GAP * (columns - 1)) / columns,
  );
  const rowHeight = tileSize + GRID_GAP;
  const listData = useMemo<(GenerationRecord | null)[]>(
    () => (isLoading ? [null, ...generationHistory] : generationHistory),
    [generationHistory, isLoading],
  );
  const activeGenerationSelected = isLoading && isViewingActiveGeneration;
  // 초기 위치는 마운트(재오픈/열 수/엔진 변경) 때만 읽는다.
  const [initialPosition] = useState(() =>
    getGridPosition(listData, columns, rowHeight, GRID_PADDING),
  );
  const [listReady, setListReady] = useState(false);
  const restored = useRef(false);
  const restorationPending = useRef(true);
  const restoreTarget = useRef(initialPosition.offset);
  const handleListReady = useCallback(() => setListReady(true), []);
  const dragSelection = useHistoryDragSelection({
    listData,
    tileSize,
    columns,
    padding: GRID_PADDING,
    bottomInset: actionBarHeight + HISTORY_SELECTION_ACTIONS_HEIGHT,
    initialScrollY: initialPosition.offset,
    beginDragSelection,
    updateDragSelection,
    endDragSelection,
  });

  useEffect(() => {
    if (!sheetOpen) {
      restored.current = false;
      restorationPending.current = true;
      return;
    }
    if (!listReady || !restorationPending.current) return;
    // 초기 props는 시트의 잠금 중 덮어써질 수 있어, 완전히 열린 뒤 복원한다.
    const list = dragSelection.listRef.current;
    if (!list) return;
    restorationPending.current = false;
    // 닫기 애니메이션을 취소해 본문이 해제되지 않은 경우에도 마지막 위치를 쓴다.
    const { offset } = getGridPosition(
      listData,
      columns,
      rowHeight,
      GRID_PADDING,
    );
    restoreTarget.current = offset;
    restored.current = offset === 0;
    list.scrollToOffset({ offset, animated: false });
  }, [
    columns,
    dragSelection.listRef,
    getGridPosition,
    listData,
    listReady,
    rowHeight,
    sheetOpen,
  ]);

  const handleScroll = (event: {
    nativeEvent: { contentOffset: { y: number } };
  }) => {
    dragSelection.onScroll(event);
    const y = Math.max(0, event.nativeEvent.contentOffset.y);
    if (!sheetOpen) return;
    // 복원 전에 도착한 초기 위치(0) 이벤트로 저장된 위치를 지우지 않는다.
    if (!restored.current) {
      if (!listReady || Math.abs(y - restoreTarget.current) > 1) return;
      restored.current = true;
    }
    const row = Math.floor(Math.max(0, y - GRID_PADDING) / rowHeight);
    const index = row * columns;
    const anchor = listData[index] ?? listData[index + 1];
    saveGridPosition(
      y === 0 ? null : (anchor?.id ?? null),
      listData[index] === null ? index + 1 : index,
      y - GRID_PADDING - row * rowHeight,
    );
  };

  return (
    <GestureDetector gesture={dragSelection.gesture}>
      <View
        collapsable={false}
        style={styles.gridViewport}
        onLayout={dragSelection.onLayout}
      >
        <HistoryGridList
          engine={listEngine}
          listRef={dragSelection.listRef}
          data={listData}
          extraData={controller}
          columns={columns}
          tileSize={tileSize}
          gridWidth={width - GRID_PADDING * 2}
          padding={GRID_PADDING}
          initialRow={initialPosition.row}
          initialScrollOffset={initialPosition.offset}
          onReady={handleListReady}
          onScrollBeginDrag={() => {
            // 삭제로 내용이 짧아져 복원 위치가 네이티브에서 제한된 경우에도 조작을 재개한다.
            restored.current = true;
          }}
          onScroll={handleScroll}
          onContentSizeChange={dragSelection.onContentSizeChange}
          onEndReached={() => {
            void loadMoreHistory();
          }}
          contentContainerStyle={[
            styles.gridContent,
            {
              paddingBottom:
                actionBarHeight +
                HISTORY_SELECTION_ACTIONS_HEIGHT +
                HISTORY_SCROLL_BOTTOM_GAP,
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
          renderTile={(item, index) =>
            item === null ? (
              <ActiveGenerationTile
                index={index}
                columns={columns}
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
                columns={columns}
                size={tileSize}
                selectionMode={selectionMode}
                selection={selection}
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
      </View>
    </GestureDetector>
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
    selection,
    busy,
    saving,
    deleting,
    saveSelected,
    deleteSelected,
  } = controller;
  const hasSelection = useStore(selection, (state) => state.ids.size > 0);

  return (
    <BottomSheetFooter
      animatedFooterPosition={animatedFooterPosition}
      // 액션바 밑으로 1 겹쳐 그라데이션과 액션바 사이에 틈이 생기지 않게 한다.
      bottomInset={actionBarHeight - 1}
      // 알약 바깥의 터치는 아래 그리드로 넘긴다.
      style={styles.footer}
    >
      {selectionMode ? (
        <View pointerEvents="box-none" style={styles.selectionActions}>
          {/* 이미지 위에서도 알약이 보이도록 그리드 아래쪽을 어둡게 한다. */}
          <LinearGradient
            pointerEvents="none"
            colors={["rgba(8,8,10,0)", "rgba(8,8,10,0.55)", "rgba(8,8,10,0.9)"]}
            locations={[0, 0.55, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.selectionPill}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="선택 이미지 저장"
              accessibilityState={{ disabled: !hasSelection || busy }}
              disabled={!hasSelection || busy}
              onPress={() => void saveSelected()}
              style={({ pressed }) => [
                styles.actionButton,
                (!hasSelection || busy) && styles.disabled,
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
                  size={19}
                  color={tokens.color.textTertiary}
                />
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="선택 이미지 삭제"
              accessibilityState={{ disabled: !hasSelection || busy }}
              disabled={!hasSelection || busy}
              onPress={() => void deleteSelected()}
              style={({ pressed }) => [
                styles.actionButton,
                (!hasSelection || busy) && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              {deleting ? (
                <ActivityIndicator color={tokens.color.negative} size="small" />
              ) : (
                <Ionicons
                  name="trash-outline"
                  size={19}
                  color={tokens.color.negative}
                />
              )}
            </Pressable>
          </View>
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
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.color.borderSubtle,
    backgroundColor: tokens.color.cardAlt,
  },
  // 좌우 칸을 같은 너비로 두어 제목이 항상 가운데에 온다.
  headerSide: {
    flex: 1,
    alignItems: "flex-start",
  },
  headerSideEnd: {
    alignItems: "flex-end",
  },
  title: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: 16,
    letterSpacing: -0.3,
    // 글자 높이 중심을 닫기 아이콘 중심에 맞춘다.
    top: -1,
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
  headerButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  closeButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  gridButton: {
    borderRadius: 17,
    backgroundColor: tokens.color.raised,
  },
  gridViewport: {
    flex: 1,
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
  footer: {
    pointerEvents: "box-none",
  },
  selectionActions: {
    height: HISTORY_SELECTION_FADE_HEIGHT,
    paddingBottom: HISTORY_SELECTION_PILL_GAP + 1,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  selectionPill: {
    height: HISTORY_SELECTION_PILL_HEIGHT,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.raised,
    ...tokens.shadow.floatMd,
  },
  emptyFooter: {
    height: 0,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
