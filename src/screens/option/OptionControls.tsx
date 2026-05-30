import { useCallback, useEffect, useRef, useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { colors } from "../../styles/colors";
import { SEEK_THUMB_TOUCH_SIZE, SEEK_THUMB_WIDTH, styles } from "./styles";

const MIN_HAPTIC_INTERVAL_MS = 35;
const TOGGLE_WIDTH = 56;
const TOGGLE_HEIGHT = 32;
const TOGGLE_PADDING = 3;
const TOGGLE_THUMB_SIZE = TOGGLE_HEIGHT - TOGGLE_PADDING * 2;

export function SelectOption({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.selectOption}
      activeOpacity={0.78}
      onPress={onPress}
    >
      <Text style={styles.optionLabel}>{label}</Text>
      <View style={styles.selectValueWrap}>
        <Text style={styles.optionValue} numberOfLines={1} ellipsizeMode="tail">
          {value}
        </Text>
        <Ionicons
          name="chevron-forward"
          size={20}
          color={colors.colorTextTertiary}
        />
      </View>
    </TouchableOpacity>
  );
}

export function SelectionSheetItem({
  label,
  active,
  onPress,
  disabled,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.sheetItem,
        active && styles.sheetItemActive,
        disabled && styles.sheetItemDisabled,
      ]}
      activeOpacity={0.78}
      disabled={disabled}
      onPress={onPress}
    >
      <Text
        style={[
          styles.sheetItemText,
          active && styles.sheetItemTextActive,
          disabled && styles.sheetItemTextDisabled,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function ToggleOption({
  title,
  value,
  onValueChange,
}: {
  title: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, { duration: 180 });
  }, [progress, value]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [colors.colorBackgroundTertiary, colors.colorBackgroundInverse],
    ),
    borderColor: interpolateColor(
      progress.value,
      [0, 1],
      [colors.colorBorderTertiary, colors.colorBackgroundInverse],
    ),
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX:
          progress.value *
          (TOGGLE_WIDTH - TOGGLE_THUMB_SIZE - TOGGLE_PADDING * 2),
      },
    ],
  }));

  return (
    <View style={styles.toggleOptionRow}>
      <View style={styles.toggleOptionText}>
        <Text style={styles.toggleOptionTitle}>{title}</Text>
      </View>
      <TouchableOpacity
        activeOpacity={0.82}
        accessibilityRole="switch"
        accessibilityState={{ checked: value }}
        onPress={() => onValueChange(!value)}
      >
        <Animated.View style={[styles.toggleSwitchTrack, trackStyle]}>
          <Animated.View style={[styles.toggleSwitchThumb, thumbStyle]} />
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

export function StepperRow({
  label,
  value,
  valueText,
  seekMin,
  seekMax,
  seekStep,
  seekPrecision,
  onSeekChange,
}: {
  label: string;
  value: number;
  valueText?: string;
  seekMin: number;
  seekMax: number;
  seekStep: number;
  seekPrecision?: number;
  onSeekChange: (v: number) => void;
}) {
  const precision = seekPrecision ?? 0;
  const [inputText, setInputText] = useState(valueText ?? String(value));

  useEffect(() => {
    setInputText(valueText ?? String(value));
  }, [value, valueText]);

  function commitInput() {
    const parsedValue = Number(inputText);
    if (!Number.isFinite(parsedValue)) {
      setInputText(valueText ?? String(value));
      return;
    }

    const stepIndex = Math.round((parsedValue - seekMin) / seekStep);
    const steppedValue = seekMin + stepIndex * seekStep;
    const nextValue = Number(
      Math.min(seekMax, Math.max(seekMin, steppedValue)).toFixed(precision),
    );

    onSeekChange(nextValue);
    setInputText(formatStepperInput(nextValue, precision));
  }

  return (
    <View style={styles.seekOptionRow}>
      <View style={styles.seekOptionMain}>
        <Text style={[styles.optionLabel, styles.stepperLabel]}>{label}</Text>
        <SteppedSeekBar
          value={value}
          min={seekMin}
          max={seekMax}
          step={seekStep}
          precision={precision}
          onChange={onSeekChange}
        />
      </View>
      <TextInput
        value={inputText}
        onChangeText={(text) => setInputText(text.replace(/[^0-9.]/g, ""))}
        onBlur={commitInput}
        onSubmitEditing={commitInput}
        keyboardType={precision > 0 ? "decimal-pad" : "number-pad"}
        style={styles.seekValueInput}
      />
    </View>
  );
}

function formatStepperInput(value: number, precision: number) {
  if (precision <= 0) {
    return String(value);
  }
  return value.toFixed(precision).replace(/\.?0+$/, "");
}

export function SteppedSeekBar({
  value,
  min,
  max,
  step,
  precision,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  precision: number;
  onChange: (v: number) => void;
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const stepCount = Math.round((max - min) / step);
  const initialIndex = Math.min(
    stepCount,
    Math.max(0, Math.round((value - min) / step)),
  );
  const initialProgress = stepCount > 0 ? initialIndex / stepCount : 0;
  const progress = useSharedValue(initialProgress);
  const dragStartProgress = useSharedValue(initialProgress);
  const lastIndex = useSharedValue(initialIndex);
  const hasSyncedInitialValue = useRef(false);
  const hapticAtRef = useRef(0);

  const valueToIndex = useCallback(
    (nextValue: number) =>
      Math.min(stepCount, Math.max(0, Math.round((nextValue - min) / step))),
    [min, step, stepCount],
  );

  const indexToValue = useCallback(
    (index: number) => Number((min + index * step).toFixed(precision)),
    [min, precision, step],
  );

  const commitIndex = useCallback(
    (index: number) => {
      const nextValue = indexToValue(index);
      onChange(nextValue);

      const now = Date.now();
      if (now - hapticAtRef.current < MIN_HAPTIC_INTERVAL_MS) {
        return;
      }
      hapticAtRef.current = now;
      Haptics.selectionAsync().catch(() => {});
    },
    [indexToValue, onChange],
  );

  useEffect(() => {
    const nextIndex = valueToIndex(value);
    const nextProgress = stepCount > 0 ? nextIndex / stepCount : 0;
    lastIndex.value = nextIndex;
    if (!hasSyncedInitialValue.current) {
      hasSyncedInitialValue.current = true;
      progress.value = nextProgress;
      return;
    }
    progress.value = withTiming(nextProgress, { duration: 120 });
  }, [lastIndex, progress, stepCount, value, valueToIndex]);

  const panGesture = Gesture.Pan()
    .minDistance(0)
    .onBegin(() => {
      dragStartProgress.value = progress.value;
      lastIndex.value = Math.round(progress.value * stepCount);
    })
    .onUpdate((event) => {
      if (trackWidth <= SEEK_THUMB_WIDTH || stepCount <= 0) {
        return;
      }

      const usableWidth = trackWidth - SEEK_THUMB_WIDTH;
      const nextProgress = Math.min(
        1,
        Math.max(0, dragStartProgress.value + event.translationX / usableWidth),
      );
      const nextIndex = Math.min(
        stepCount,
        Math.max(0, Math.round(nextProgress * stepCount)),
      );

      progress.value = nextIndex / stepCount;
      if (nextIndex !== lastIndex.value) {
        lastIndex.value = nextIndex;
        runOnJS(commitIndex)(nextIndex);
      }
    });

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX:
          progress.value * Math.max(0, trackWidth - SEEK_THUMB_WIDTH) -
          (SEEK_THUMB_TOUCH_SIZE - SEEK_THUMB_WIDTH) / 2,
      },
    ],
  }));

  return (
    <View style={styles.seekContainer}>
      <View
        style={styles.seekTrackWrap}
        onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
      >
        <View pointerEvents="none" style={styles.seekTrack} />
        {trackWidth > 0 ? (
          <GestureDetector gesture={panGesture}>
            <Animated.View style={[styles.seekThumbTouch, thumbStyle]}>
              <View style={styles.seekThumb} />
            </Animated.View>
          </GestureDetector>
        ) : null}
      </View>
    </View>
  );
}
