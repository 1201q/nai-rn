import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { colors } from "../../styles/colors";
import {
  SEEK_THUMB_TOUCH_SIZE,
  SEEK_THUMB_WIDTH,
  styles,
} from "./styles";

const MIN_HAPTIC_INTERVAL_MS = 35;

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
        <Text style={styles.selectChevron}>›</Text>
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

export function LabeledInput({
  label,
  value,
  onChangeText,
  minHeight,
  count,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  minHeight: number;
  count: string;
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={[styles.textAreaWrap, { minHeight }]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          multiline
          textAlignVertical="top"
          placeholderTextColor={colors.grey500}
          style={styles.textArea}
        />
        <Text style={styles.countText}>{count}</Text>
      </View>
    </View>
  );
}

export function CollapsibleSection({
  title,
  expanded,
  onExpandedChange,
  children,
}: {
  title: string;
  expanded: boolean;
  onExpandedChange: (v: boolean) => void;
  children: ReactNode;
}) {
  const [contentHeight, setContentHeight] = useState(0);
  const progress = useSharedValue(expanded ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(expanded ? 1 : 0, { duration: 180 });
  }, [expanded, progress]);

  const animatedBodyStyle = useAnimatedStyle(() => ({
    height: contentHeight * progress.value,
    opacity: progress.value,
  }));

  return (
    <View style={styles.section}>
      <TouchableOpacity
        style={styles.sectionHeader}
        activeOpacity={0.78}
        onPress={() => onExpandedChange(!expanded)}
      >
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionChevron}>{expanded ? "−" : "+"}</Text>
      </TouchableOpacity>
      <Animated.View style={[styles.sectionBody, animatedBodyStyle]}>
        <View
          style={styles.sectionContent}
          onLayout={(event) => {
            setContentHeight(event.nativeEvent.layout.height);
          }}
        >
          {children}
        </View>
      </Animated.View>
    </View>
  );
}

export function StepperRow({
  label,
  value,
  valueText,
  onMinus,
  onPlus,
  seekMin,
  seekMax,
  seekStep,
  seekPrecision,
  onSeekChange,
}: {
  label: string;
  value: number;
  valueText?: string;
  onMinus: () => void;
  onPlus: () => void;
  seekMin?: number;
  seekMax?: number;
  seekStep?: number;
  seekPrecision?: number;
  onSeekChange?: (v: number) => void;
}) {
  const shouldShowSeekBar =
    seekMin !== undefined &&
    seekMax !== undefined &&
    seekStep !== undefined &&
    onSeekChange !== undefined;

  return (
    <View style={styles.stepperRow}>
      <View style={styles.stepperTopRow}>
        <Text style={[styles.optionLabel, styles.stepperLabel]}>{label}</Text>
        <View style={styles.stepper}>
          <TouchableOpacity
            style={styles.stepButton}
            activeOpacity={0.78}
            onPress={onMinus}
          >
            <Text style={styles.stepButtonText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.stepValue}>{valueText ?? value}</Text>
          <TouchableOpacity
            style={styles.stepButton}
            activeOpacity={0.78}
            onPress={onPlus}
          >
            <Text style={styles.stepButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
      {shouldShowSeekBar ? (
        <SteppedSeekBar
          value={value}
          min={seekMin}
          max={seekMax}
          step={seekStep}
          precision={seekPrecision ?? 0}
          onChange={onSeekChange}
        />
      ) : null}
    </View>
  );
}

function SteppedSeekBar({
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
