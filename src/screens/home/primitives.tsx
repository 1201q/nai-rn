import React, { useRef } from "react";
import { Animated, Pressable, Text, TouchableOpacity, View } from "react-native";
import Reanimated, {
  interpolateColor,
  useAnimatedStyle,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { light, styles } from "./styles";
import type { ChipValue } from "./constants";
import { useScalePress } from "./useScalePress";

export function hapticTick() {
  Haptics.selectionAsync().catch(() => {});
}

export function ScalePressable({
  children,
  style,
  onPress,
}: {
  children: React.ReactNode;
  style?: object | object[];
  onPress?: () => void;
}) {
  const anim = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(anim, {
      toValue: 0.93,
      useNativeDriver: true,
      speed: 60,
      bounciness: 0,
    }).start();

  const onPressOut = () =>
    Animated.spring(anim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 0,
    }).start();

  return (
    <Pressable onPressIn={onPressIn} onPressOut={onPressOut} onPress={onPress}>
      <Animated.View style={[style, { transform: [{ scale: anim }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

export function VarietyChip({
  active,
  onPress,
}: {
  active: boolean;
  onPress: () => void;
}) {
  const { onPressIn, onPressOut, scaleStyle } = useScalePress();

  return (
    <Pressable
      onPressIn={onPressIn}
      onPressOut={() => {
        onPressOut();
        onPress();
      }}
    >
      <Reanimated.View
        style={[
          styles.optionChip,
          active ? styles.optionChipActive : null,
          scaleStyle,
        ]}
      >
        <Ionicons
          name="sparkles-outline"
          size={16}
          color={active ? light.accentText : light.textSecondary}
        />
        <Text
          style={[styles.optionChipText, active && styles.optionChipTextActive]}
        >
          Variety+
        </Text>
      </Reanimated.View>
    </Pressable>
  );
}

export function ImageActionChip({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
}) {
  const { progress, onPressIn, onPressOut, scaleStyle } = useScalePress();
  const bgStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [light.bg, light.surfaceAlt],
    ),
  }));

  return (
    <Pressable onPressIn={onPressIn} onPressOut={onPressOut} onPress={onPress}>
      <Reanimated.View style={[styles.optionChip, scaleStyle, bgStyle]}>
        <Ionicons name={icon} size={16} color={light.textSecondary} />
        <Text style={styles.optionChipText}>{label}</Text>
      </Reanimated.View>
    </Pressable>
  );
}

export const OptionChip = React.memo(function OptionChip({
  opt,
  value,
  onPress,
}: {
  opt: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap };
  value: ChipValue;
  onPress?: () => void;
}) {
  const { progress, onPressIn, onPressOut, scaleStyle } = useScalePress();
  const bgStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [light.bg, light.surfaceAlt],
    ),
  }));

  return (
    <Pressable onPressIn={onPressIn} onPressOut={onPressOut} onPress={onPress}>
      <Reanimated.View style={[styles.optionChip, scaleStyle, bgStyle]}>
        <Ionicons name={opt.icon} size={16} color={light.textSecondary} />
        {value.unitBefore && value.unit ? (
          <Text style={styles.optionChipUnit}>{value.unit}</Text>
        ) : null}
        <Text style={styles.optionChipText}>{value.text}</Text>
        {!value.unitBefore && value.unit ? (
          <Text style={styles.optionChipUnit}>{value.unit}</Text>
        ) : null}
        <Ionicons name="chevron-down" size={14} color={light.textSecondary} />
      </Reanimated.View>
    </Pressable>
  );
});

export function PromptModePill({
  mode,
  onChange,
}: {
  mode: "base" | "negative";
  onChange: (m: "base" | "negative") => void;
}) {
  const leftAnim = useRef(new Animated.Value(0)).current;
  const widthAnim = useRef(new Animated.Value(0)).current;
  const layouts = useRef<{ x: number; width: number }[]>([]);
  const initialized = useRef(false);

  const animateTo = (index: number) => {
    const layout = layouts.current[index];
    if (!layout) return;
    Animated.spring(leftAnim, {
      toValue: layout.x,
      useNativeDriver: false,
      speed: 25,
      bounciness: 5,
    }).start();
    Animated.spring(widthAnim, {
      toValue: layout.width,
      useNativeDriver: false,
      speed: 25,
      bounciness: 5,
    }).start();
  };

  const handleLayout = (index: number, x: number, width: number) => {
    layouts.current[index] = { x, width };
    if (!initialized.current && layouts.current[0] && layouts.current[1]) {
      initialized.current = true;
      const initial = layouts.current[mode === "base" ? 0 : 1];
      leftAnim.setValue(initial.x);
      widthAnim.setValue(initial.width);
    }
  };

  const handlePress = (next: "base" | "negative") => {
    animateTo(next === "base" ? 0 : 1);
    onChange(next);
  };

  return (
    <View style={styles.promptModePill}>
      <Animated.View
        style={[styles.promptModeThumb, { left: leftAnim, width: widthAnim }]}
      />
      <Pressable
        onLayout={(e) =>
          handleLayout(0, e.nativeEvent.layout.x, e.nativeEvent.layout.width)
        }
        onPress={() => handlePress("base")}
        style={styles.promptModeSegment}
      >
        <Text
          style={[
            styles.promptModeText,
            mode === "base" && styles.promptModeTextActive,
          ]}
        >
          Base
        </Text>
      </Pressable>
      <Pressable
        onLayout={(e) =>
          handleLayout(1, e.nativeEvent.layout.x, e.nativeEvent.layout.width)
        }
        onPress={() => handlePress("negative")}
        style={styles.promptModeSegment}
      >
        <Text
          style={[
            styles.promptModeText,
            mode === "negative" && styles.promptModeTextActive,
          ]}
        >
          Negative
        </Text>
      </Pressable>
    </View>
  );
}

export function SheetItem({
  item,
  isActive,
  onPress,
  recommendedValue,
}: {
  item: { value: string; label: string; description?: string };
  isActive: boolean;
  onPress: () => void;
  recommendedValue?: string;
}) {
  const { progress, onPressIn, onPressOut, scaleStyle } = useScalePress({
    scaleTo: 0.96,
  });
  const bgStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      ["rgba(25,27,49,0)", light.surface],
    ),
  }));

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={onPress}
    >
      <Reanimated.View style={[styles.sheetModelItem, scaleStyle, bgStyle]}>
        <View style={styles.sheetModelItemContent}>
          <View style={styles.sheetModelItemLabelRow}>
            <Text
              style={[
                styles.sheetModelItemLabel,
                isActive && styles.sheetModelItemLabelActive,
              ]}
            >
              {item.label}
            </Text>
            {item.value === recommendedValue && (
              <View style={styles.sheetModelItemBadge}>
                <Text style={styles.sheetModelItemBadgeText}>권장</Text>
              </View>
            )}
          </View>
          {item.description && (
            <Text style={styles.sheetModelItemDescription}>
              {item.description}
            </Text>
          )}
        </View>
        {isActive && (
          <Ionicons name="checkmark" size={20} color={light.accent} />
        )}
      </Reanimated.View>
    </TouchableOpacity>
  );
}
