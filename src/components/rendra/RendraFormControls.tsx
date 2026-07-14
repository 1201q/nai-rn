import {
  memo,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
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
  disabled = false,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
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
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={() => onChange(!value)}
      style={[
        styles.toggleTrack,
        value && styles.toggleTrackOn,
        disabled && styles.toggleDisabled,
      ]}
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

export const RendraPromptField = memo(function RendraPromptField({
  label,
  value,
  placeholder,
  minHeight,
  negative = false,
  onCommit,
}: {
  label: string;
  value: string;
  placeholder: string;
  minHeight: number;
  negative?: boolean;
  onCommit: (value: string) => void;
}) {
  const focusedRef = useRef(false);
  const latestRef = useRef(value);
  const [text, setText] = useState(value);

  useEffect(() => {
    if (focusedRef.current) return;
    latestRef.current = value;
    setText(value);
  }, [value]);

  useEffect(
    () => () => {
      onCommit(latestRef.current);
    },
    [onCommit],
  );

  return (
    <View style={styles.promptField}>
      <Text style={styles.promptLabel}>{label}</Text>
      <View
        style={[
          styles.promptCard,
          { minHeight },
          negative && styles.promptCardNegative,
        ]}
      >
        <TextInput
          accessibilityLabel={label}
          value={text}
          multiline
          textAlignVertical="top"
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={placeholder}
          placeholderTextColor={tokens.color.textMuted}
          onFocus={() => {
            focusedRef.current = true;
          }}
          onBlur={() => {
            focusedRef.current = false;
            onCommit(latestRef.current);
          }}
          onChangeText={(next) => {
            latestRef.current = next;
            setText(next);
          }}
          style={styles.promptInput}
        />
        <Text style={styles.promptCount}>{text.length}자</Text>
      </View>
    </View>
  );
});

export const RendraSegmentedControl = memo(function RendraSegmentedControl({
  options,
  value,
  onChange,
}: {
  options: readonly { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.segmentedControl}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.segment,
              active && styles.segmentActive,
              pressed && styles.segmentPressed,
            ]}
          >
            <Text
              style={[styles.segmentLabel, active && styles.segmentLabelActive]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
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
  toggleDisabled: {
    opacity: 0.4,
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
    fontFamily: tokens.font.medium,
    fontSize: tokens.type.base,
  },
  sliderValue: {
    minWidth: 48,
    padding: 0,
    textAlign: "right",
    color: tokens.color.accent,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type.md,
  },
  sliderTrack: {
    height: 14,
  },
  promptField: {
    gap: 12,
  },
  promptLabel: {
    paddingHorizontal: 4,
    color: tokens.color.textMuted,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type["3xs"],
    letterSpacing: tokens.tracking.wide,
    textTransform: "uppercase",
  },
  promptCard: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
    gap: 10,
    borderRadius: tokens.radius.xl,
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    backgroundColor: tokens.color.card,
  },
  promptCardNegative: {
    borderColor: tokens.color.borderNegative,
  },
  promptInput: {
    flex: 1,
    minHeight: 80,
    padding: 0,
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.regular,
    fontSize: tokens.type.base,
    lineHeight: 22,
  },
  promptCount: {
    alignSelf: "flex-end",
    color: tokens.color.textMuted,
    fontFamily: tokens.font.medium,
    fontSize: tokens.type["2xs"],
  },
  segmentedControl: {
    height: 32,
    padding: 3,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.card,
  },
  segment: {
    height: 26,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: tokens.radius.pill,
  },
  segmentActive: {
    backgroundColor: tokens.color.accent,
  },
  segmentPressed: {
    opacity: 0.7,
  },
  segmentLabel: {
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.medium,
    fontSize: tokens.type["3xs"],
  },
  segmentLabelActive: {
    color: tokens.color.onAccent,
    fontFamily: tokens.font.semibold,
  },
});
