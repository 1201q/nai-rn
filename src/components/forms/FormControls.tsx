import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Reanimated, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { Slider } from "./Slider";
import { TapFeedbackPressable } from "../common/TapFeedbackPressable";
import {
  PromptHighlightTextInput,
  type PromptHighlightTextInputHandle,
} from "./PromptHighlightTextInput";
import { PromptModeTabs, type PromptMode } from "./PromptModeTabs";
import { usePromptAutocomplete } from "../../hooks/usePromptAutocomplete";
import { tokens } from "../../styles/tokens";
import { PromptTokenCounter } from "./PromptTokenCounter";

const AnimatedTextInput = Reanimated.createAnimatedComponent(TextInput);

export const Toggle = memo(function Toggle({
  value,
  onChange,
  label,
  disabled = false,
  onPressIn,
  onPressOut,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
  onPressIn?: PressableProps["onPressIn"];
  onPressOut?: PressableProps["onPressOut"];
}) {
  const progress = useSharedValue(value ? 1 : 0);

  useLayoutEffect(() => {
    progress.value = withTiming(value ? 1 : 0, { duration: 180 });
  }, [progress, value]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * 18 }],
  }));

  const handlePress = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    onChange(!value);
  }, [onChange, value]);

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
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

export const ParameterSlider = memo(function ParameterSlider({
  label,
  labelAccessory,
  value,
  min,
  max,
  step,
  precision,
  onChange,
  settingsCard = false,
}: {
  label: string;
  labelAccessory?: ReactNode;
  value: number;
  min: number;
  max: number;
  step: number;
  precision: number;
  onChange: (value: number) => void;
  settingsCard?: boolean;
}) {
  const display = useSharedValue(value);

  useLayoutEffect(() => {
    display.value = value;
  }, [display, value]);

  const animatedProps = useAnimatedProps(() => {
    const text = Number(display.value.toFixed(precision)).toString();
    return { text, defaultValue: text } as object;
  });

  const changeByStep = (direction: -1 | 1) => {
    const next = Number(
      Math.min(max, Math.max(min, value + direction * step)).toFixed(precision),
    );
    if (next !== value) {
      Haptics.selectionAsync().catch(() => {});
      onChange(next);
    }
  };

  return (
    <View
      style={[
        styles.sliderBlock,
        settingsCard && styles.settingsSliderBlock,
      ]}
    >
      <View style={styles.sliderHeader}>
        <View style={styles.sliderLabelRow}>
          <Text
            style={[
              styles.sliderLabel,
              settingsCard && styles.settingsSliderLabel,
            ]}
          >
            {label}
          </Text>
          {labelAccessory}
        </View>
        <AnimatedTextInput
          editable={false}
          pointerEvents="none"
          defaultValue={Number(value.toFixed(precision)).toString()}
          animatedProps={animatedProps}
          style={[
            styles.sliderValue,
            settingsCard && styles.settingsSliderValue,
          ]}
        />
      </View>
      <View style={settingsCard ? styles.settingsSliderControls : undefined}>
        {settingsCard ? (
          <TapFeedbackPressable
            accessibilityRole="button"
            accessibilityLabel={`${label} decrease`}
            disabled={value <= min}
            hitSlop={8}
            onPress={() => changeByStep(-1)}
            style={[
              styles.sliderStepButton,
              value <= min && styles.sliderStepButtonDisabled,
            ]}
            contentStyle={styles.sliderStepButtonContent}
          >
            <Ionicons
              name="remove"
              size={21}
              color={tokens.color.textMuted}
            />
          </TapFeedbackPressable>
        ) : null}
        <Slider
          value={value}
          min={min}
          max={max}
          step={step}
          precision={precision}
          display={display}
          trackHeight={3}
          thumbSize={14}
          trackBg={
            settingsCard ? tokens.color.raised : tokens.color.borderSubtle
          }
          trackFill={tokens.color.accent}
          thumbColor={tokens.color.accent}
          thumbBorderColor={tokens.color.accent}
          thumbBorderWidth={0}
          onSlidingComplete={onChange}
          style={[
            styles.sliderTrack,
            settingsCard && styles.settingsSliderTrack,
          ]}
        />
        {settingsCard ? (
          <TapFeedbackPressable
            accessibilityRole="button"
            accessibilityLabel={`${label} increase`}
            disabled={value >= max}
            hitSlop={8}
            onPress={() => changeByStep(1)}
            style={[
              styles.sliderStepButton,
              value >= max && styles.sliderStepButtonDisabled,
            ]}
            contentStyle={styles.sliderStepButtonContent}
          >
            <Ionicons
              name="add"
              size={21}
              color={tokens.color.textMuted}
            />
          </TapFeedbackPressable>
        ) : null}
      </View>
    </View>
  );
});

export const PromptEditor = memo(function PromptEditor({
  prompt,
  negativePrompt,
  onCommitPrompt,
  onCommitNegativePrompt,
}: {
  prompt: string;
  negativePrompt: string;
  onCommitPrompt: (value: string) => void;
  onCommitNegativePrompt: (value: string) => void;
}) {
  const inputRef = useRef<PromptHighlightTextInputHandle>(null);
  const focusedRef = useRef(false);
  const promptRef = useRef(prompt);
  const negativePromptRef = useRef(negativePrompt);
  const committedPromptRef = useRef(prompt);
  const committedNegativePromptRef = useRef(negativePrompt);
  const onCommitPromptRef = useRef(onCommitPrompt);
  const onCommitNegativePromptRef = useRef(onCommitNegativePrompt);
  const [mode, setMode] = useState<PromptMode>("base");
  const [promptText, setPromptText] = useState(prompt);
  const [negativePromptText, setNegativePromptText] = useState(negativePrompt);
  committedPromptRef.current = prompt;
  committedNegativePromptRef.current = negativePrompt;
  onCommitPromptRef.current = onCommitPrompt;
  onCommitNegativePromptRef.current = onCommitNegativePrompt;

  const activeText = mode === "base" ? promptText : negativePromptText;

  const handleTextChange = useCallback(
    (next: string) => {
      if (mode === "base") {
        promptRef.current = next;
        setPromptText(next);
      } else {
        negativePromptRef.current = next;
        setNegativePromptText(next);
      }
    },
    [mode],
  );
  const autocomplete = usePromptAutocomplete({
    value: activeText,
    onChangeText: handleTextChange,
    inputRef,
  });

  useEffect(() => {
    if (focusedRef.current) return;
    promptRef.current = prompt;
    negativePromptRef.current = negativePrompt;
    setPromptText(prompt);
    setNegativePromptText(negativePrompt);
  }, [negativePrompt, prompt]);

  useEffect(
    () => () => {
      if (promptRef.current !== committedPromptRef.current) {
        onCommitPromptRef.current(promptRef.current);
      }
      if (
        negativePromptRef.current !== committedNegativePromptRef.current
      ) {
        onCommitNegativePromptRef.current(negativePromptRef.current);
      }
    },
    [],
  );

  function commitMode(targetMode: PromptMode) {
    if (
      targetMode === "base" &&
      promptRef.current !== committedPromptRef.current
    ) {
      onCommitPromptRef.current(promptRef.current);
    }
    if (
      targetMode === "negative" &&
      negativePromptRef.current !== committedNegativePromptRef.current
    ) {
      onCommitNegativePromptRef.current(negativePromptRef.current);
    }
  }

  function changeMode(next: PromptMode) {
    if (next === mode) return;
    commitMode(mode);
    autocomplete.clearSuggestions();
    setMode(next);
  }

  return (
    <View
      style={[
        styles.promptCard,
        mode === "negative" && styles.promptCardNegative,
      ]}
    >
      <PromptHighlightTextInput
        ref={inputRef}
        accessibilityLabel={
          mode === "base" ? "Base prompt" : "Negative prompt"
        }
        multiline
        textAlignVertical="top"
        autoCapitalize="none"
        autoCorrect={false}
        placeholder={mode === "base" ? "1girl, ..." : "lowres, bad anatomy, ..."}
        placeholderTextColor={tokens.color.textMuted}
        onFocus={() => {
          focusedRef.current = true;
          autocomplete.activateSuggestions();
        }}
        onBlur={() => {
          focusedRef.current = false;
          commitMode(mode);
          autocomplete.deactivateSuggestions();
        }}
        onChangeText={autocomplete.handleChangeText}
        onSelectionChange={autocomplete.handleSelectionChange}
        value={activeText}
        style={styles.promptInput}
      />
      <View style={styles.promptFooter}>
        <PromptModeTabs value={mode} onChange={changeMode} />
        <PromptTokenCounter
          target={{
            scope: "base",
            channel: mode === "base" ? "positive" : "negative",
          }}
          draftText={activeText}
          style={styles.promptTokenCounter}
        />
      </View>
    </View>
  );
});

export const SegmentedControl = memo(function SegmentedControl({
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
  settingsSliderBlock: {
    gap: 10,
  },
  sliderHeader: {
    minHeight: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sliderLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space[2],
  },
  sliderLabel: {
    color: tokens.color.textSecondary,
    fontFamily: tokens.font.medium,
    fontSize: tokens.type.base,
  },
  settingsSliderLabel: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.regular,
    fontSize: 17,
  },
  sliderValue: {
    height: 24,
    minWidth: 48,
    padding: 0,
    textAlign: "right",
    textAlignVertical: "center",
    color: tokens.color.accent,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type.md,
    lineHeight: 24,
    includeFontPadding: false,
  },
  settingsSliderValue: {
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.regular,
    fontSize: 17,
  },
  sliderTrack: {
    height: 14,
  },
  settingsSliderControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  settingsSliderTrack: {
    flex: 1,
  },
  sliderStepButton: {
    width: 30,
    height: 30,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
  },
  sliderStepButtonContent: {
    alignItems: "center",
    justifyContent: "center",
  },
  sliderStepButtonDisabled: {
    opacity: 0.45,
  },
  promptCard: {
    height: 420,
    paddingHorizontal: tokens.space[8],
    paddingTop: 16,
    paddingBottom: 16,
    borderRadius: tokens.radius.settings,
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
  promptFooter: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  promptTokenCounter: {
    marginLeft: "auto",
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
