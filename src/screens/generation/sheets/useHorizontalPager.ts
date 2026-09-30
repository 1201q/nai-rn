import { useCallback, useEffect, useMemo, useState } from "react";
import { useWindowDimensions } from "react-native";
import { Gesture } from "react-native-gesture-handler";
import {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { SHEET_EASING } from "./sheetChrome";

const PAGE_SWIPE_THRESHOLD = 0.18;
const PAGE_VELOCITY_THRESHOLD = 650;
const PAGE_ANIMATION_DURATION = 260;
const EDGE_RESISTANCE = 0.2;

// 시트 안의 가로 탭 페이저. 탭 누름과 스와이프가 같은 규칙으로 페이지를 바꾼다.
// onPageChange는 탭 상태를 바꾸기 직전에 호출된다 (같은 페이지로 돌아와도 호출).
export function useHorizontalPager<K extends string>(
  pages: readonly { key: K }[],
  {
    enabled = true,
    onPageChange,
  }: { enabled?: boolean; onPageChange?: (key: K) => void } = {},
) {
  const { width: windowWidth } = useWindowDimensions();
  const [tab, setTab] = useState<K>(pages[0].key);
  const pageIndex = useSharedValue(0);
  const pageTranslateX = useSharedValue(0);
  const pageDragStartX = useSharedValue(0);
  const pageCount = pages.length;

  const selectPage = useCallback(
    (index: number) => {
      const nextTab = pages[index]?.key;
      if (!nextTab) return;
      onPageChange?.(nextTab);
      setTab(nextTab);
    },
    [onPageChange, pages],
  );
  const changeTab = useCallback(
    (nextTab: K) => {
      const nextIndex = pages.findIndex((item) => item.key === nextTab);
      if (nextIndex < 0) return;
      onPageChange?.(nextTab);
      setTab(nextTab);
      pageIndex.value = nextIndex;
      pageTranslateX.value = withTiming(-nextIndex * windowWidth, {
        duration: PAGE_ANIMATION_DURATION,
        easing: SHEET_EASING,
      });
    },
    [onPageChange, pageIndex, pageTranslateX, pages, windowWidth],
  );
  const pageGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(enabled)
        .activeOffsetX([-18, 18])
        .failOffsetY([-10, 10])
        .shouldCancelWhenOutside(false)
        .onStart(() => {
          cancelAnimation(pageTranslateX);
          pageDragStartX.value = pageTranslateX.value;
        })
        .onUpdate((event) => {
          const minimumTranslateX = -windowWidth * (pageCount - 1);
          const nextTranslateX = pageDragStartX.value + event.translationX;

          if (nextTranslateX > 0) {
            pageTranslateX.value = nextTranslateX * EDGE_RESISTANCE;
          } else if (nextTranslateX < minimumTranslateX) {
            pageTranslateX.value =
              minimumTranslateX +
              (nextTranslateX - minimumTranslateX) * EDGE_RESISTANCE;
          } else {
            pageTranslateX.value = nextTranslateX;
          }
        })
        .onEnd((event) => {
          const currentIndex = pageIndex.value;
          const movedToNext =
            event.translationX < -windowWidth * PAGE_SWIPE_THRESHOLD ||
            event.velocityX < -PAGE_VELOCITY_THRESHOLD;
          const movedToPrevious =
            event.translationX > windowWidth * PAGE_SWIPE_THRESHOLD ||
            event.velocityX > PAGE_VELOCITY_THRESHOLD;
          const nextIndex = Math.min(
            pageCount - 1,
            Math.max(
              0,
              currentIndex + (movedToNext ? 1 : movedToPrevious ? -1 : 0),
            ),
          );

          pageIndex.value = nextIndex;
          pageTranslateX.value = withTiming(-nextIndex * windowWidth, {
            duration: PAGE_ANIMATION_DURATION,
            easing: SHEET_EASING,
          });
          runOnJS(selectPage)(nextIndex);
        })
        .onFinalize((_event, success) => {
          if (success) return;
          pageTranslateX.value = withTiming(-pageIndex.value * windowWidth, {
            duration: PAGE_ANIMATION_DURATION,
            easing: SHEET_EASING,
          });
        }),
    [
      enabled,
      pageCount,
      pageDragStartX,
      pageIndex,
      pageTranslateX,
      selectPage,
      windowWidth,
    ],
  );
  const pageTrackStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pageTranslateX.value }],
  }));

  useEffect(() => {
    pageTranslateX.value = -pageIndex.value * windowWidth;
  }, [pageIndex, pageTranslateX, windowWidth]);

  return { tab, changeTab, pageGesture, pageTrackStyle, windowWidth };
}
