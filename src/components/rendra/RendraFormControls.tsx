import { memo, useLayoutEffect } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Reanimated, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { CustomSlider } from "../../screens/home/CustomSlider";
import { tokens } from "../../styles/tokens";

const AnimatedTextInput = Reanimated.createAnimatedComponent(TextInput);

export const RendraToggle = memo(function RendraToggle({
  value,
  onChange,
  label,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  const progress = useSharedValue(value ? 1 : 0);

  useLayoutEffect(() => {
    progress.value = withTiming(value ? 1 : 0, { duration: 180 });
  }, [progress, value]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * 18 }],
  }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      hitSlop={8}
      onPress={() => onChange(!value)}
      style={[styles.toggleTrack, value && styles.toggleTrackOn]}
    >
      <Reanimated.View
        style={[
          styles.toggleThumb,
          value && styles.toggleThumbOn,
          thumbStyle,
        ]}
      />
    </Pressable>
  );
});

export const RendraParameterSlider = memo(function RendraParameterSlider({
  label,
  value,
  min,
  max,
  step,
  precision,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  precision: number;
  onChange: (value: number) => void;
}) {
  const display = useSharedValue(value);

  useLayoutEffect(() => {
    display.value = value;
  }, [display, value]);

  const animatedProps = useAnimatedProps(() => {
    const text = Number(display.value.toFixed(precision)).toString();
    return { text, defaultValue: text } as object;
  });

  return (
    <View style={styles.sliderBlock}>
      <View style={styles.sliderHeader}>
        <Text style={styles.sliderLabel}>{label}</Text>
        <AnimatedTextInput
          editable={false}
          pointerEvents="none"
          defaultValue={Number(value.toFixed(precision)).toString()}
          animatedProps={animatedProps}
          style={styles.sliderValue}
        />
      </View>
      <CustomSlider
        value={value}
        min={min}
        max={max}
        step={step}
        precision={precision}
        display={display}
        trackHeight={3}
        thumbSize={14}
        trackBg={tokens.color.borderSubtle}
        trackFill={tokens.color.accent}
        thumbColor={tokens.color.accent}
        thumbBorderColor={tokens.color.accent}
        thumbBorderWidth={0}
        onSlidingComplete={onChange}
        style={styles.sliderTrack}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  toggleTrack: {
    width: 44,
    height: 26,
    padding: 3,
    borderRadius: tokens.radius.pill,
    justifyContent: "center",
    backgroundColor: "#232326",
  },
  toggleTrackOn: {
    backgroundColor: tokens.color.accent,
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: tokens.color.textPrimary,
  },
  toggleThumbOn: {
    backgroundColor: tokens.color.onAccent,
  },
  sliderBlock: {
    gap: 8,
  },
  sliderHeader: {
    minHeight: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sliderLabel: {
    color: tokens.color.textSecondary,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type.base,
  },
  sliderValue: {
    minWidth: 48,
    padding: 0,
    textAlign: "right",
    color: tokens.color.accent,
    fontFamily: tokens.font.bold,
    fontSize: tokens.type.md,
  },
  sliderTrack: {
    height: 14,
  },
});
