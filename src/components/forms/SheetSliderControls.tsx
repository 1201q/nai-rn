import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import Reanimated, { useAnimatedProps, useSharedValue } from "react-native-reanimated";

import { Slider } from "./Slider";
import { useGenerationInputCommit, useGenerationInputCommitRegistration } from "../../context/GenerationInputCommitContext";
import { tokens } from "../../styles/tokens";

const AnimatedBottomSheetTextInput = Reanimated.createAnimatedComponent(BottomSheetTextInput);

function formatSliderValue(value: number, precision: number) {
  return Number(value.toFixed(precision)).toString();
}

export function SheetSliderControls({ label, value, min, max, step, precision, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  precision: number;
  onChange: (value: number) => void;
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
  );
}

const styles = StyleSheet.create({
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
});
