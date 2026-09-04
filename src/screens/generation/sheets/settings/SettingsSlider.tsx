import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import Reanimated, {
  useAnimatedProps,
  useSharedValue,
} from "react-native-reanimated";

import { Slider } from "../../../../components/forms/Slider";
import {
  useGenerationInputCommit,
  useGenerationInputCommitRegistration,
} from "../../../../context/GenerationInputCommitContext";
import { tokens } from "../../../../styles/tokens";

export type SettingsHelpKey =
  | "steps"
  | "promptGuidance"
  | "rescale"
  | "variety";

const SETTINGS_HELP: Record<SettingsHelpKey, string> = {
  steps:
    "이미지를 정제하는 반복 횟수입니다. 낮으면 빠르게 구도를 시험할 수 있고, 높으면 시간과 비용이 늘지만 항상 더 좋아지지는 않습니다.",
  promptGuidance:
    "프롬프트를 따르는 강도입니다. 낮으면 더 자유롭고 부드러우며, 높으면 지시와 세부 표현이 강해집니다.",
  rescale:
    "높은 Prompt Guidance에서 색이 지나치게 진하거나 경계가 거칠어질 때 완화합니다.",
  variety:
    "초기 구도 단계의 프롬프트 제약을 줄여 포즈와 배경의 다양성을 높입니다.",
};

const AnimatedBottomSheetTextInput =
  Reanimated.createAnimatedComponent(BottomSheetTextInput);

function formatSliderValue(value: number, precision: number) {
  return Number(value.toFixed(precision)).toString();
}

export function SettingsHelpButton({
  helpKey,
  open,
  alignRight = false,
  onToggle,
}: {
  helpKey: SettingsHelpKey;
  open: boolean;
  alignRight?: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.settingsHelpAnchor}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${helpKey} 설명`}
        accessibilityState={{ expanded: open }}
        hitSlop={6}
        onPress={onToggle}
        style={({ pressed }) => [
          styles.settingsHelpButton,
          open && styles.settingsHelpButtonOpen,
          pressed && styles.pressed,
        ]}
      >
        <Ionicons
          name="information"
          size={12}
          color={open ? tokens.color.onAccent : tokens.color.textMuted}
        />
      </Pressable>
      {open ? (
        <View
          style={[
            styles.settingsHelpTooltip,
            alignRight && styles.settingsHelpTooltipRight,
          ]}
        >
          <Text style={styles.settingsHelpTooltipText}>
            {SETTINGS_HELP[helpKey]}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export function SettingsSlider({
  label,
  helpKey,
  helpOpen,
  value,
  min,
  max,
  step,
  precision,
  onHelpToggle,
  onChange,
  trailing,
  overlayOpen = false,
}: {
  label: string;
  helpKey: SettingsHelpKey;
  helpOpen: boolean;
  value: number;
  min: number;
  max: number;
  step: number;
  precision: number;
  onHelpToggle: () => void;
  onChange: (value: number) => void;
  trailing?: ReactNode;
  overlayOpen?: boolean;
}) {
  const inputFocusedRef = useRef(false);
  const [draftValue, setDraftValue] = useState(() =>
    formatSliderValue(value, precision),
  );
  const draftValueRef = useRef(draftValue);
  const slidingRef = useRef(false);
  const { commitPendingInput } = useGenerationInputCommit();
  const display = useSharedValue(value);
  const editing = useSharedValue(false);
  const animatedInputProps = useAnimatedProps(() => {
    if (editing.value) return {};
    const text = String(Number(display.value.toFixed(precision)));
    return { text, defaultValue: text } as object;
  });

  useEffect(() => {
    if (!inputFocusedRef.current && !slidingRef.current) {
      const next = formatSliderValue(value, precision);
      draftValueRef.current = next;
      setDraftValue(next);
      display.value = value;
    }
  }, [display, precision, value]);

  const commitDraft = useCallback(() => {
    const parsed = slidingRef.current
      ? display.value
      : Number(draftValueRef.current.trim().replace(",", "."));
    if (!Number.isFinite(parsed)) {
      const fallback = formatSliderValue(value, precision);
      draftValueRef.current = fallback;
      setDraftValue(fallback);
      display.value = value;
      return;
    }

    const clamped = Math.min(max, Math.max(min, parsed));
    const stepped = min + Math.round((clamped - min) / step) * step;
    const next = Number(
      Math.min(max, Math.max(min, stepped)).toFixed(precision),
    );
    const formatted = formatSliderValue(next, precision);
    draftValueRef.current = formatted;
    setDraftValue(formatted);
    display.value = next;
    onChange(next);
  }, [display, max, min, onChange, precision, step, value]);
  const inputCommit = useGenerationInputCommitRegistration(commitDraft);

  function handleSliderComplete(next: number) {
    const formatted = formatSliderValue(next, precision);
    slidingRef.current = false;
    draftValueRef.current = formatted;
    inputCommit.commitAndDeactivate();
  }

  return (
    <View
      style={[
        styles.settingsSliderField,
        (helpOpen || overlayOpen) && styles.settingsSliderFieldOverlayOpen,
      ]}
    >
      <View style={styles.settingsSliderHeader}>
        <View style={styles.settingsFieldLabelRow}>
          <Text style={styles.settingsFieldLabel}>{label}</Text>
          <SettingsHelpButton
            helpKey={helpKey}
            open={helpOpen}
            onToggle={onHelpToggle}
          />
        </View>
        {trailing}
      </View>
      <View style={styles.settingsSliderControls}>
        <View style={styles.settingsSliderValueBox}>
          <AnimatedBottomSheetTextInput
            accessibilityLabel={`${label} 값`}
            value={draftValue}
            animatedProps={animatedInputProps}
            onChangeText={(next) => {
              editing.value = true;
              draftValueRef.current = next;
              setDraftValue(next);
            }}
            onFocus={() => {
              inputFocusedRef.current = true;
              editing.value = true;
              const next = formatSliderValue(display.value, precision);
              draftValueRef.current = next;
              setDraftValue(next);
              inputCommit.activate();
            }}
            onBlur={() => {
              inputFocusedRef.current = false;
              editing.value = false;
              inputCommit.commitAndDeactivate();
              if (slidingRef.current) inputCommit.activate();
            }}
            onSubmitEditing={commitDraft}
            keyboardType={precision === 0 ? "number-pad" : "decimal-pad"}
            returnKeyType="done"
            submitBehavior="blurAndSubmit"
            selectTextOnFocus
            style={styles.settingsSliderValue}
          />
        </View>
        <Slider
          accessibilityLabel={label}
          value={value}
          min={min}
          max={max}
          step={step}
          precision={precision}
          display={display}
          trackHeight={6}
          thumbSize={24}
          pill
          jumpOnTap
          onSlidingStart={() => {
            slidingRef.current = true;
            editing.value = false;
            commitPendingInput();
            inputCommit.activate();
          }}
          trackBg={tokens.color.sunken}
          thumbBorderWidth={0}
          onSlidingComplete={handleSliderComplete}
          style={styles.settingsSliderTrack}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  settingsFieldLabel: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.medium,
    fontSize: 15,
  },
  settingsFieldLabelRow: {
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  settingsHelpAnchor: {
    position: "relative",
    zIndex: 30,
  },
  settingsHelpButton: {
    width: 19,
    height: 19,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.raised,
  },
  settingsHelpButtonOpen: {
    backgroundColor: tokens.color.accent,
  },
  settingsHelpTooltip: {
    position: "absolute",
    top: 26,
    left: -12,
    width: 280,
    zIndex: 30,
    paddingHorizontal: 15,
    paddingVertical: 13,
    borderRadius: 16,
    backgroundColor: tokens.color.toast,
    ...tokens.shadow.floatMd,
  },
  settingsHelpTooltipRight: {
    right: -54,
    left: undefined,
  },
  settingsHelpTooltipText: {
    color: tokens.color.textSecondary,
    fontFamily: tokens.font.regular,
    fontSize: 13,
    lineHeight: 19,
  },
  settingsSliderField: {
    gap: 10,
  },
  settingsSliderFieldOverlayOpen: {
    zIndex: 30,
  },
  settingsSliderHeader: {
    minHeight: 19,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    zIndex: 3,
  },
  settingsSliderControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  settingsSliderValueBox: {
    width: 64,
    height: 38,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    borderRadius: 12,
    backgroundColor: tokens.color.sunken,
  },
  settingsSliderValue: {
    width: "100%",
    height: "100%",
    padding: 0,
    textAlign: "center",
    textAlignVertical: "center",
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.medium,
    fontSize: 16,
    fontVariant: ["tabular-nums"],
  },
  settingsSliderTrack: {
    flex: 1,
  },
  pressed: {
    opacity: 0.65,
  },
});
