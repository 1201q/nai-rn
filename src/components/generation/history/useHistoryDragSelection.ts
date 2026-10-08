import { useCallback, useEffect, useMemo, useState } from "react";
import type { LayoutChangeEvent } from "react-native";
import type { BottomSheetFlatListMethods } from "@gorhom/bottom-sheet";
import { Gesture } from "react-native-gesture-handler";
import {
  runOnJS,
  scrollTo,
  type SharedValue,
  useAnimatedRef,
  useFrameCallback,
  useSharedValue,
} from "react-native-reanimated";

import type { GenerationRecord } from "../../../lib/generationHistory";
import { GRID_GAP } from "./HistoryTiles";

const LONG_PRESS_MS = 180;
const EDGE_SIZE = 72;
const MAX_SCROLL_SPEED = 1100;
const ARM_DISTANCE = 10;

type DragSelectionOptions = {
  listData: (GenerationRecord | null)[];
  tileSize: number;
  columns: number;
  padding: number;
  // 그리드 아래쪽을 가리는 푸터 높이
  bottomInset: number;
  beginDragSelection: (id: string) => boolean;
  updateDragSelection: (id: string) => void;
  endDragSelection: () => void;
};

type DragSelectionBridgeOptions = DragSelectionOptions & {
  dragging: SharedValue<boolean>;
  setScrolling: (active: boolean) => void;
};

// UI 스레드의 제스처가 넘겨준 그리드 인덱스를 선택 변경으로 바꾼다.
class HistoryDragSelectionBridge {
  constructor(private options: DragSelectionBridgeOptions) {}

  setOptions = (options: DragSelectionBridgeOptions) => {
    this.options = options;
  };

  begin = (index: number) => {
    const { listData, beginDragSelection, dragging, setScrolling } =
      this.options;
    const id = listData[index]?.id;
    if (id === undefined || !beginDragSelection(id)) {
      dragging.value = false;
      return;
    }
    setScrolling(true);
  };

  update = (index: number) => {
    const { listData, updateDragSelection } = this.options;
    const last = Math.min(index, listData.length - 1);
    // 생성 중 타일(null)은 선택 대상이 아니므로 바로 다음 항목으로 본다.
    const id = (listData[last] ?? listData[last + 1])?.id;
    if (id !== undefined) updateDragSelection(id);
  };

  end = () => {
    this.options.setScrolling(false);
    this.options.endDragSelection();
  };
}

export function useHistoryDragSelection(options: DragSelectionOptions) {
  const { tileSize, columns, padding, bottomInset } = options;
  const listRef = useAnimatedRef();
  const metrics = useSharedValue({ tileSize, columns, padding, bottomInset });
  const scrollY = useSharedValue(0);
  const contentHeight = useSharedValue(0);
  const viewportHeight = useSharedValue(0);
  const dragging = useSharedValue(false);
  const armed = useSharedValue(false);
  const fingerX = useSharedValue(0);
  const fingerY = useSharedValue(0);
  const startY = useSharedValue(0);
  const lastIndex = useSharedValue(-1);

  useEffect(() => {
    metrics.value = { tileSize, columns, padding, bottomInset };
  }, [bottomInset, columns, metrics, padding, tileSize]);

  const [bridge] = useState(
    () =>
      new HistoryDragSelectionBridge({
        ...options,
        dragging,
        setScrolling: () => {},
      }),
  );
  const { begin, update, end } = bridge;

  const indexAt = useCallback(
    (x: number, y: number, clamp: boolean) => {
      "worklet";
      const { tileSize, columns, padding } = metrics.value;
      const stride = tileSize + GRID_GAP;
      let column = Math.floor((x - padding) / stride);
      let row = Math.floor((y + scrollY.value - padding) / stride);
      if (clamp) {
        column = Math.min(columns - 1, Math.max(0, column));
        row = Math.max(0, row);
      } else if (column < 0 || column >= columns || row < 0) {
        return -1;
      }
      return row * columns + column;
    },
    [metrics, scrollY],
  );

  const selectUnderFinger = useCallback(() => {
    "worklet";
    const index = indexAt(fingerX.value, fingerY.value, true);
    if (index === lastIndex.value) return;
    lastIndex.value = index;
    runOnJS(update)(index);
  }, [fingerX, fingerY, indexAt, lastIndex, update]);

  // 자동 스크롤은 JS 스레드가 리렌더링으로 바빠도 끊기지 않도록 UI 스레드에서 돈다.
  const scrollStep = useCallback(
    ({ timeSincePreviousFrame }: { timeSincePreviousFrame: number | null }) => {
      "worklet";
      if (!dragging.value || !armed.value) return;
      const y = fingerY.value;
      const bottom = viewportHeight.value - metrics.value.bottomInset;
      const depth =
        y < EDGE_SIZE
          ? y - EDGE_SIZE
          : y > bottom - EDGE_SIZE
            ? y - (bottom - EDGE_SIZE)
            : 0;
      if (depth === 0) return;
      const speed =
        Math.max(-1, Math.min(1, depth / EDGE_SIZE)) * MAX_SCROLL_SPEED;
      const elapsed = Math.min(timeSincePreviousFrame ?? 0, 50) / 1000;
      const maxScrollY = Math.max(
        0,
        contentHeight.value - viewportHeight.value,
      );
      const next = Math.max(
        0,
        Math.min(maxScrollY, scrollY.value + speed * elapsed),
      );
      if (next === scrollY.value) return;
      scrollY.value = next;
      scrollTo(listRef, 0, next, false);
      selectUnderFinger();
    },
    [
      armed,
      contentHeight,
      dragging,
      fingerY,
      listRef,
      metrics,
      scrollY,
      selectUnderFinger,
      viewportHeight,
    ],
  );
  const scrolling = useFrameCallback(scrollStep, false);

  useEffect(() => {
    bridge.setOptions({
      ...options,
      dragging,
      setScrolling: scrolling.setActive,
    });
  });
  useEffect(() => end, [end]);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .activateAfterLongPress(LONG_PRESS_MS)
        .maxPointers(1)
        .onStart((event) => {
          const index = indexAt(event.x, event.y, false);
          if (index < 0) return;
          dragging.value = true;
          armed.value = false;
          fingerX.value = event.x;
          fingerY.value = event.y;
          startY.value = event.y;
          lastIndex.value = index;
          runOnJS(begin)(index);
        })
        .onUpdate((event) => {
          if (!dragging.value) return;
          fingerX.value = event.x;
          fingerY.value = event.y;
          // 가장자리 줄을 길게 누르기만 했을 때 바로 스크롤되지 않게 한다.
          if (Math.abs(event.y - startY.value) > ARM_DISTANCE) {
            armed.value = true;
          }
          selectUnderFinger();
        })
        .onFinalize(() => {
          if (!dragging.value) return;
          dragging.value = false;
          runOnJS(end)();
        }),
    [
      armed,
      begin,
      dragging,
      end,
      fingerX,
      fingerY,
      indexAt,
      lastIndex,
      selectUnderFinger,
      startY,
    ],
  );

  const onScroll = useCallback(
    (event: { nativeEvent: { contentOffset: { y: number } } }) => {
      // 드래그 중에는 직접 정한 위치가 기준이다. 늦게 도착한 이벤트로 되돌리지 않는다.
      if (dragging.value) return;
      scrollY.value = event.nativeEvent.contentOffset.y;
    },
    [dragging, scrollY],
  );

  const onContentSizeChange = useCallback(
    (_width: number, height: number) => {
      contentHeight.value = height;
    },
    [contentHeight],
  );

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      viewportHeight.value = event.nativeEvent.layout.height;
    },
    [viewportHeight],
  );

  return {
    gesture,
    listRef: listRef as unknown as React.Ref<BottomSheetFlatListMethods>,
    onScroll,
    onContentSizeChange,
    onLayout,
  };
}
