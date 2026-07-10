import { useLayoutEffect, useState, type ComponentType } from "react";
import {
  Pressable,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Reanimated, {
  useAnimatedProps,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";

import { light, styles } from "./styles";
import { ScalePressable } from "./primitives";
import { CustomSlider } from "./CustomSlider";
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
  value,
  onCommit,
  cfg,
}: {
  display: SharedValue<number>;
  value: number;
  onCommit: (v: number) => void;
  cfg: NumericConfig;
}) {
  return (
    <CustomSlider
      style={styles.stepsNativeSlider}
      value={value}
      min={cfg.min}
      max={cfg.max}
      step={cfg.step}
      precision={cfg.precision}
      display={display}
      pill
      onSlidingComplete={onCommit}
    />
  );
}

export function NumericSheetContent({
  value,
  onChange,
  cfg,
  showTitle = true,
  compact = false,
  // 페이지에선 기본 TextInput, 바텀시트(batchCount)에선 BottomSheetTextInput 주입.
  InputComponent = TextInput,
}: {
  value: number;
  onChange: (v: number) => void;
  cfg: NumericConfig;
  showTitle?: boolean;
  compact?: boolean;
  InputComponent?: ComponentType<TextInputProps>;
}) {
  const [inputText, setInputText] = useState(
    formatNumeric(value, cfg.precision),
  );
  const [editing, setEditing] = useState(false);

  // 드래그 중 표시값은 UI 스레드에서 직접 구동(재렌더 없음).
  // 외부 변경(+/- · 수동입력 · 초기값)은 여기서 동기화.
  const display = useSharedValue(value);
  useLayoutEffect(() => {
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

  const valueField = editing ? (
    <InputComponent
      style={compact ? styles.numCompactValue : styles.stepsValueInput}
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
        key={cfg.title}
        style={
          compact ? styles.numCompactValue : [styles.stepsValueInput, { padding: 0 }]
        }
        editable={false}
        pointerEvents="none"
        defaultValue={formatNumeric(value, cfg.precision)}
        animatedProps={animatedProps}
      />
    </Pressable>
  );

  if (compact) {
    return (
      <>
        <View style={styles.numCompactHeader}>
          <Text style={styles.numCompactLabel}>{cfg.title}</Text>
          <View style={styles.numCompactControls}>
            <ScalePressable
              style={[
                styles.numCompactButton,
                value <= cfg.min && styles.stepsButtonDisabled,
              ]}
              onPress={() => step(-cfg.step)}
            >
              <Ionicons name="remove" size={16} color={light.accent} />
            </ScalePressable>
            {valueField}
            <ScalePressable
              style={[
                styles.numCompactButton,
                value >= cfg.max && styles.stepsButtonDisabled,
              ]}
              onPress={() => step(cfg.step)}
            >
              <Ionicons name="add" size={16} color={light.accent} />
            </ScalePressable>
          </View>
        </View>
        <CustomSlider
          value={value}
          min={cfg.min}
          max={cfg.max}
          step={cfg.step}
          precision={cfg.precision}
          display={display}
          trackHeight={5}
          thumbSize={18}
          pill
          onSlidingComplete={onChange}
        />
      </>
    );
  }

  return (
    <>
      {showTitle ? <Text style={styles.sheetTitle}>{cfg.title}</Text> : null}

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
          {valueField}
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

      <NumericSlider
        display={display}
        value={value}
        onCommit={onChange}
        cfg={cfg}
      />
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
