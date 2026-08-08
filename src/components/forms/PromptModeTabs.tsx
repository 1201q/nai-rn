import { memo, useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Reanimated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { tokens } from "../../styles/tokens";

export type PromptMode = "base" | "negative";

const MODES = [
  { value: "base", label: "Base" },
  { value: "negative", label: "Negative" },
] as const;

const BASE_WIDTH = 46;
const NEGATIVE_WIDTH = 68;

export const PromptModeTabs = memo(function PromptModeTabs({
  value,
  onChange,
}: {
  value: PromptMode;
  onChange: (value: PromptMode) => void;
}) {
  const progress = useSharedValue(value === "negative" ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(value === "negative" ? 1 : 0, {
      duration: 150,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, value]);

  const indicatorStyle = useAnimatedStyle(() => ({
    width: interpolate(progress.value, [0, 1], [BASE_WIDTH, NEGATIVE_WIDTH]),
    transform: [{ translateX: progress.value * BASE_WIDTH }],
  }));

  return (
    <View style={styles.container}>
      <Reanimated.View
        pointerEvents="none"
        style={[styles.indicator, indicatorStyle]}
      />
      {MODES.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.tab,
              option.value === "base" ? styles.baseTab : styles.negativeTab,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: "relative",
    width: BASE_WIDTH + NEGATIVE_WIDTH + 6,
    height: 32,
    padding: 3,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.app,
  },
  indicator: {
    position: "absolute",
    top: 3,
    left: 3,
    width: BASE_WIDTH,
    height: 26,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.accent,
  },
  tab: {
    height: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  baseTab: {
    width: BASE_WIDTH,
  },
  negativeTab: {
    width: NEGATIVE_WIDTH,
  },
  label: {
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.medium,
    fontSize: tokens.type["3xs"],
  },
  labelActive: {
    color: tokens.color.onAccent,
    fontFamily: tokens.font.semibold,
  },
  pressed: {
    opacity: 0.65,
  },
});
