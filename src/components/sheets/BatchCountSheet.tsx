import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Reanimated, {
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useGenerationStore } from "../../store/generationStore";
import { tokens } from "../../styles/tokens";

const AnimatedTextInput = Reanimated.createAnimatedComponent(TextInput);
const TICK_SPACING = 20;
const BATCH_COUNT_CONFIG = { min: 1, max: 100 } as const;
const MAX_INDEX = BATCH_COUNT_CONFIG.max - BATCH_COUNT_CONFIG.min;
const MIN_TRANSLATE_X = -MAX_INDEX * TICK_SPACING;
const COUNTS = Array.from(
  { length: MAX_INDEX + 1 },
  (_, index) => BATCH_COUNT_CONFIG.min + index,
);

function clampIndex(value: number) {
  "worklet";
  return Math.min(MAX_INDEX, Math.max(0, value));
}

function indexForCount(value: number) {
  return clampIndex(Math.round(value - BATCH_COUNT_CONFIG.min));
}

function hapticTick() {
  Haptics.selectionAsync().catch(() => {});
}

export const BatchCountSheet = memo(function BatchCountSheet() {
  const batchCount = useGenerationStore((state) => state.batchCount);
  const setBatchCount = useGenerationStore((state) => state.setBatchCount);
  const initialIndex = useRef(indexForCount(batchCount)).current;
  const translateX = useSharedValue(-initialIndex * TICK_SPACING);
  const dragStartX = useSharedValue(-initialIndex * TICK_SPACING);
  const selectedIndex = useSharedValue(initialIndex);

  useEffect(() => {
    const nextIndex = indexForCount(batchCount);
    selectedIndex.value = nextIndex;
    translateX.value = -nextIndex * TICK_SPACING;
  }, [batchCount, selectedIndex, translateX]);

  const commitIndex = useCallback(
    (index: number) => {
      setBatchCount(BATCH_COUNT_CONFIG.min + clampIndex(index));
    },
    [setBatchCount],
  );

  const selectCount = useCallback(
    (count: number) => {
      const nextIndex = indexForCount(count);
      if (nextIndex !== indexForCount(batchCount)) hapticTick();
      selectedIndex.value = nextIndex;
      translateX.value = withTiming(-nextIndex * TICK_SPACING, {
        duration: 140,
      });
      commitIndex(nextIndex);
    },
    [batchCount, commitIndex, selectedIndex, translateX],
  );

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-6, 6])
        .failOffsetY([-12, 12])
        .onStart(() => {
          dragStartX.value = translateX.value;
        })
        .onUpdate((event) => {
          const nextX = Math.min(
            0,
            Math.max(MIN_TRANSLATE_X, dragStartX.value + event.translationX),
          );
          translateX.value = nextX;
          const nextIndex = clampIndex(
            Math.round(-nextX / TICK_SPACING),
          );
          if (nextIndex !== selectedIndex.value) {
            selectedIndex.value = nextIndex;
            runOnJS(hapticTick)();
          }
        })
        .onEnd((event) => {
          const projectedX = Math.min(
            0,
            Math.max(
              MIN_TRANSLATE_X,
              translateX.value + event.velocityX * 0.06,
            ),
          );
          const nextIndex = clampIndex(Math.round(-projectedX / TICK_SPACING));
          selectedIndex.value = nextIndex;
          translateX.value = withTiming(-nextIndex * TICK_SPACING, {
            duration: 140,
          });
          runOnJS(commitIndex)(nextIndex);
        }),
    [commitIndex, dragStartX, selectedIndex, translateX],
  );

  const rulerTrackStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));
  const valueAnimatedProps = useAnimatedProps(() => {
    const text = String(BATCH_COUNT_CONFIG.min + selectedIndex.value);
    return { text, defaultValue: text } as object;
  });

  return (
    <View style={styles.content}>
      <View style={styles.valueRow}>
        <AnimatedTextInput
          editable={false}
          pointerEvents="none"
          defaultValue={String(batchCount)}
          animatedProps={valueAnimatedProps}
          style={styles.value}
        />
        <Text style={styles.unit}>IMAGES</Text>
      </View>

      <GestureDetector gesture={panGesture}>
        <Reanimated.View
          accessibilityRole="adjustable"
          accessibilityLabel="Batch Count"
          accessibilityValue={{
            min: BATCH_COUNT_CONFIG.min,
            max: BATCH_COUNT_CONFIG.max,
            now: batchCount,
            text: `${batchCount} images`,
          }}
          accessibilityActions={[
            { name: "increment", label: "Increase batch count" },
            { name: "decrement", label: "Decrease batch count" },
          ]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === "increment") {
              selectCount(batchCount + 1);
            } else if (event.nativeEvent.actionName === "decrement") {
              selectCount(batchCount - 1);
            }
          }}
          style={styles.rulerWindow}
        >
          <Reanimated.View
            pointerEvents="none"
            style={[styles.rulerTrack, rulerTrackStyle]}
          >
            {COUNTS.map((count) => {
              const major = count === 1 || count % 5 === 0;
              return (
                <View key={count} style={styles.tickSlot}>
                  <View style={styles.tickArea}>
                    <View style={[styles.tick, major && styles.majorTick]} />
                  </View>
                  <Text style={styles.tickLabel}>{major ? count : ""}</Text>
                </View>
              );
            })}
          </Reanimated.View>
          <View pointerEvents="none" style={styles.centerMarker} />
        </Reanimated.View>
      </GestureDetector>
    </View>
  );
});

const styles = StyleSheet.create({
  content: {
    width: "100%",
    paddingTop: tokens.space[4],
  },
  valueRow: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.space[4],
  },
  value: {
    width: 72,
    height: 60,
    padding: 0,
    color: tokens.color.accent,
    fontFamily: tokens.font.semibold,
    fontSize: 52,
    lineHeight: 60,
    letterSpacing: -1.2,
    textAlign: "right",
  },
  unit: {
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type["3xs"],
    letterSpacing: tokens.tracking.wide,
  },
  rulerWindow: {
    height: 76,
    marginTop: tokens.space[8],
    overflow: "hidden",
  },
  rulerTrack: {
    position: "absolute",
    top: 0,
    left: "50%",
    marginLeft: -TICK_SPACING / 2,
    flexDirection: "row",
  },
  tickSlot: {
    width: TICK_SPACING,
    alignItems: "center",
  },
  tickArea: {
    height: 42,
    justifyContent: "flex-start",
  },
  tick: {
    width: 1,
    height: 16,
    backgroundColor: tokens.color.textMuted,
  },
  majorTick: {
    height: 26,
    backgroundColor: tokens.color.textTertiary,
  },
  tickLabel: {
    height: 20,
    color: tokens.color.textMuted,
    fontFamily: tokens.font.medium,
    fontSize: tokens.type["3xs"],
    lineHeight: 16,
  },
  centerMarker: {
    position: "absolute",
    top: 0,
    left: "50%",
    width: 2,
    height: 34,
    marginLeft: -1,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.accent,
  },
});
