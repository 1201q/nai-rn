import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Reanimated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import type { GenerationRecord } from "../../../../lib/generationHistory";
import { tokens } from "../../../../styles/tokens";
import { PressableSurface } from "../SheetLayers";
import { MetadataImportContent } from "./MetadataImportContent";
import { MetadataSheetContent } from "./MetadataSheetContent";

type MetadataTab = "metadata" | "import";

const PAGE_SWIPE_THRESHOLD = 0.18;
const PAGE_VELOCITY_THRESHOLD = 650;
const PAGE_ANIMATION_DURATION = 260;
const TABS: Array<{ key: MetadataTab; label: string }> = [
  { key: "metadata", label: "Metadata" },
  { key: "import", label: "Import" },
];

export const MetadataSheetPager = memo(function MetadataSheetPager({
  generation,
  onClose,
  controller,
}: {
  generation: GenerationRecord;
  onClose: () => void;
  controller: MetadataSheetPagerController;
}) {
  const {
    tab,
    changeTab,
    pageGesture,
    pageTrackStyle,
    windowWidth,
  } = controller;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View accessibilityRole="tablist" style={styles.tabs}>
          {TABS.map((item) => {
            const active = item.key === tab;
            return (
              <Pressable
                key={item.key}
                accessibilityRole="tab"
                accessibilityLabel={item.label}
                accessibilityState={{ selected: active }}
                onPress={() => changeTab(item.key)}
                style={({ pressed }) => [
                  styles.tab,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                  {item.label}
                </Text>
                <View
                  style={[
                    styles.tabIndicator,
                    active && styles.tabIndicatorActive,
                  ]}
                />
              </Pressable>
            );
          })}
        </View>
        <PressableSurface
          accessibilityLabel="Metadata 닫기"
          onPress={onClose}
          style={styles.closeButton}
        >
          <Ionicons name="close" size={21} color={tokens.color.textPrimary} />
        </PressableSurface>
      </View>

      <GestureDetector gesture={pageGesture}>
        <View style={styles.pageViewport}>
          <Reanimated.View
            style={[
              styles.pageTrack,
              { width: windowWidth * TABS.length },
              pageTrackStyle,
            ]}
          >
            {TABS.map((item) => {
              const active = item.key === tab;
              return (
                <View
                  key={item.key}
                  testID={`metadata-page-${item.key}`}
                  accessibilityElementsHidden={!active}
                  importantForAccessibility={
                    active ? "auto" : "no-hide-descendants"
                  }
                  style={[styles.page, { width: windowWidth }]}
                >
                  {item.key === "metadata" ? (
                    <MetadataSheetContent generation={generation} />
                  ) : (
                    <MetadataImportContent
                      generation={generation}
                      onImported={onClose}
                    />
                  )}
                </View>
              );
            })}
          </Reanimated.View>
        </View>
      </GestureDetector>
    </View>
  );
});

export function useMetadataSheetPagerController() {
  const { width: windowWidth } = useWindowDimensions();
  const [tab, setTab] = useState<MetadataTab>("metadata");
  const pageIndex = useSharedValue(0);
  const pageTranslateX = useSharedValue(0);
  const pageDragStartX = useSharedValue(0);

  const selectPage = useCallback((index: number) => {
    const nextTab = TABS[index]?.key;
    if (nextTab) setTab(nextTab);
  }, []);
  const changeTab = useCallback(
    (nextTab: MetadataTab) => {
      const nextIndex = TABS.findIndex((item) => item.key === nextTab);
      if (nextIndex < 0) return;
      setTab(nextTab);
      pageIndex.value = nextIndex;
      pageTranslateX.value = withTiming(-nextIndex * windowWidth, {
        duration: PAGE_ANIMATION_DURATION,
        easing: Easing.bezier(0.32, 0.72, 0, 1),
      });
    },
    [pageIndex, pageTranslateX, windowWidth],
  );
  const pageGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-18, 18])
        .failOffsetY([-10, 10])
        .shouldCancelWhenOutside(false)
        .onStart(() => {
          cancelAnimation(pageTranslateX);
          pageDragStartX.value = pageTranslateX.value;
        })
        .onUpdate((event) => {
          const minimumTranslateX = -windowWidth * (TABS.length - 1);
          const nextTranslateX = pageDragStartX.value + event.translationX;

          if (nextTranslateX > 0) {
            pageTranslateX.value = nextTranslateX * 0.2;
          } else if (nextTranslateX < minimumTranslateX) {
            pageTranslateX.value =
              minimumTranslateX + (nextTranslateX - minimumTranslateX) * 0.2;
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
            TABS.length - 1,
            Math.max(
              0,
              currentIndex + (movedToNext ? 1 : movedToPrevious ? -1 : 0),
            ),
          );

          pageIndex.value = nextIndex;
          pageTranslateX.value = withTiming(-nextIndex * windowWidth, {
            duration: PAGE_ANIMATION_DURATION,
            easing: Easing.bezier(0.32, 0.72, 0, 1),
          });
          runOnJS(selectPage)(nextIndex);
        })
        .onFinalize((_event, success) => {
          if (success) return;
          pageTranslateX.value = withTiming(-pageIndex.value * windowWidth, {
            duration: PAGE_ANIMATION_DURATION,
            easing: Easing.bezier(0.32, 0.72, 0, 1),
          });
        }),
    [
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

export type MetadataSheetPagerController = ReturnType<
  typeof useMetadataSheetPagerController
>;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 46,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.color.borderSubtle,
    flexDirection: "row",
    alignItems: "stretch",
  },
  tabs: {
    flex: 1,
    flexDirection: "row",
    overflow: "hidden",
  },
  tab: {
    minWidth: 0,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  tabLabel: {
    color: tokens.color.textMuted,
    fontFamily: tokens.font.semibold,
    fontSize: 15,
  },
  tabLabelActive: {
    color: tokens.color.textPrimary,
  },
  tabIndicator: {
    position: "absolute",
    right: 12,
    bottom: 0,
    left: 12,
    height: 2,
    backgroundColor: "transparent",
  },
  tabIndicatorActive: {
    backgroundColor: tokens.color.accent,
  },
  closeButton: {
    width: 34,
    height: 34,
    marginTop: 2,
    marginLeft: 4,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.raised,
  },
  pageViewport: {
    flex: 1,
    overflow: "hidden",
  },
  pageTrack: {
    flex: 1,
    flexDirection: "row",
  },
  page: {
    height: "100%",
  },
  pressed: {
    opacity: 0.65,
  },
});
