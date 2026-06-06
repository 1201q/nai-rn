import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import Reanimated, {
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";

import { light, SLIDER_THUMB, styles } from "./styles";
import { hapticTick, ScalePressable } from "./primitives";
import type { NumericConfig } from "./constants";

const AnimatedTextInput = Reanimated.createAnimatedComponent(TextInput);

export function snapValue(v: number, cfg: NumericConfig) {
  "worklet";
  const idx = Math.round((v - cfg.min) / cfg.step);
  const stepped = cfg.min + idx * cfg.step;
  return Number(
    Math.min(cfg.max, Math.max(cfg.min, stepped)).toFixed(cfg.precision),
  );
}

export function formatNumeric(v: number, precision: number) {
  if (precision <= 0) return String(v);
  return v.toFixed(precision);
}

function NumericSlider({
  display,
  onCommit,
  cfg,
}: {
  display: SharedValue<number>;
  onCommit: (v: number) => void;
  cfg: NumericConfig;
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const range = cfg.max - cfg.min;
  const dragStart = useSharedValue(0);

  const panGesture = Gesture.Pan()
    .minDistance(0)
    .onBegin(() => {
      dragStart.value = (display.value - cfg.min) / range;
    })
    .onUpdate((event) => {
      if (trackWidth <= SLIDER_THUMB) return;
      const usableWidth = trackWidth - SLIDER_THUMB;
      const nextProgress = Math.min(
        1,
        Math.max(0, dragStart.value + event.translationX / usableWidth),
      );
      const nextValue = snapValue(cfg.min + nextProgress * range, cfg);
      if (nextValue !== display.value) {
        display.value = nextValue;
        runOnJS(hapticTick)();
      }
    })
    .onEnd(() => {
      runOnJS(onCommit)(display.value);
    });

  const fillStyle = useAnimatedStyle(() => ({
    width:
      ((display.value - cfg.min) / range) *
        Math.max(0, trackWidth - SLIDER_THUMB) +
      SLIDER_THUMB / 2,
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX:
          ((display.value - cfg.min) / range) *
          Math.max(0, trackWidth - SLIDER_THUMB),
      },
    ],
  }));

  return (
    <View
      style={styles.stepsSliderTrack}
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
    >
      <View style={styles.stepsSliderBase} />
      <Reanimated.View style={[styles.stepsSliderFill, fillStyle]} />
      {trackWidth > 0 ? (
        <GestureDetector gesture={panGesture}>
          <Reanimated.View style={[styles.stepsSliderThumb, thumbStyle]} />
        </GestureDetector>
      ) : null}
    </View>
  );
}

export function NumericSheetContent({
  value,
  onChange,
  cfg,
}: {
  value: number;
  onChange: (v: number) => void;
  cfg: NumericConfig;
}) {
  const [inputText, setInputText] = useState(
    formatNumeric(value, cfg.precision),
  );
  const [editing, setEditing] = useState(false);

  // 드래그 중 표시값은 UI 스레드에서 직접 구동(재렌더 없음).
  // 외부 변경(+/- · 수동입력 · 초기값)은 여기서 동기화.
  const display = useSharedValue(value);
  useEffect(() => {
    display.value = value;
    setInputText(formatNumeric(value, cfg.precision));
  }, [value, cfg.precision, display]);

  const animatedProps = useAnimatedProps(() => {
    const v = display.value;
    const text = cfg.precision <= 0 ? String(v) : v.toFixed(cfg.precision);
    return { text, defaultValue: text } as object;
  });

  const step = (delta: number) => {
    Haptics.selectionAsync().catch(() => {});
    onChange(snapValue(value + delta, cfg));
  };

  const commitInput = () => {
    setEditing(false);
    const parsed = Number(inputText);
    if (!Number.isFinite(parsed)) {
      setInputText(formatNumeric(value, cfg.precision));
      return;
    }
    const next = snapValue(parsed, cfg);
    onChange(next);
    setInputText(formatNumeric(next, cfg.precision));
  };

  const filter = cfg.precision > 0 ? /[^0-9.]/g : /[^0-9]/g;

  return (
    <>
      <Text style={styles.sheetTitle}>{cfg.title}</Text>

      <View style={styles.stepsValueRow}>
        <ScalePressable
          style={[
            styles.stepsButton,
            value <= cfg.min && styles.stepsButtonDisabled,
          ]}
          onPress={() => step(-cfg.step)}
        >
          <Ionicons name="remove" size={24} color={light.textPrimary} />
        </ScalePressable>

        <View style={styles.stepsValueCenter}>
          {editing ? (
            <BottomSheetTextInput
              style={styles.stepsValueInput}
              value={inputText}
              onChangeText={(t) => setInputText(t.replace(filter, ""))}
              onBlur={commitInput}
              onSubmitEditing={commitInput}
              keyboardType={cfg.precision > 0 ? "decimal-pad" : "number-pad"}
              maxLength={6}
              autoFocus
            />
          ) : (
            <Pressable onPress={() => setEditing(true)}>
              <AnimatedTextInput
                style={[styles.stepsValueInput, { padding: 0 }]}
                editable={false}
                pointerEvents="none"
                animatedProps={animatedProps}
              />
            </Pressable>
          )}
          <Text style={styles.stepsValueUnit}>{cfg.unit}</Text>
        </View>

        <ScalePressable
          style={[
            styles.stepsButton,
            value >= cfg.max && styles.stepsButtonDisabled,
          ]}
          onPress={() => step(cfg.step)}
        >
          <Ionicons name="add" size={24} color={light.textPrimary} />
        </ScalePressable>
      </View>

      <NumericSlider display={display} onCommit={onChange} cfg={cfg} />
      <View style={styles.stepsRangeRow}>
        <Text style={styles.stepsRangeLabel}>
          {formatNumeric(cfg.min, cfg.precision)}
        </Text>
        <Text style={styles.stepsRangeLabel}>
          {formatNumeric(cfg.max, cfg.precision)}
        </Text>
      </View>
    </>
  );
}
