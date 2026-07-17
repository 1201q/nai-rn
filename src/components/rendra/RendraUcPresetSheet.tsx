import { memo, useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Reanimated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import {
  UC_PRESET_OPTIONS,
  type SelectableUcPresetIndex,
} from "../../lib/naiPresets";
import { useGenerationStore } from "../../store/generationStore";
import { tokens } from "../../styles/tokens";

const PRESS_IN_TIMING = { duration: 90 };
const PRESS_OUT_TIMING = { duration: 130 };

const UcPresetOption = memo(function UcPresetOption({
  label,
  value,
  selected,
  onSelect,
}: {
  label: string;
  value: SelectableUcPresetIndex;
  selected: boolean;
  onSelect: (value: SelectableUcPresetIndex) => void;
}) {
  const pressProgress = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      pressProgress.value,
      [0, 1],
      ["rgba(255,255,255,0)", "rgba(255,255,255,0.06)"],
    ),
    transform: [{ scale: 1 - pressProgress.value * 0.02 }],
  }));

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPressIn={() => {
        pressProgress.value = withTiming(1, PRESS_IN_TIMING);
      }}
      onPressOut={() => {
        pressProgress.value = withTiming(0, PRESS_OUT_TIMING);
      }}
      onPress={() => onSelect(value)}
    >
      <Reanimated.View style={[styles.option, animatedStyle]}>
        <Text style={[styles.label, selected && styles.labelSelected]}>
          {label}
        </Text>
        {selected ? (
          <Ionicons name="checkmark" size={22} color={tokens.color.accent} />
        ) : null}
      </Reanimated.View>
    </Pressable>
  );
});

export const RendraUcPresetSheet = memo(function RendraUcPresetSheet({
  onSelect,
}: {
  onSelect: () => void;
}) {
  const selectedPreset = useGenerationStore((state) => state.ucPreset);
  const setUcPreset = useGenerationStore((state) => state.setUcPreset);

  const handleSelect = useCallback(
    (value: SelectableUcPresetIndex) => {
      setUcPreset(value);
      onSelect();
    },
    [onSelect, setUcPreset],
  );

  return (
    <View style={styles.options}>
      {UC_PRESET_OPTIONS.map((option) => (
        <UcPresetOption
          key={option.value}
          label={option.label}
          value={option.value}
          selected={option.value === selectedPreset}
          onSelect={handleSelect}
        />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  options: {
    width: "100%",
  },
  option: {
    minHeight: 56,
    paddingHorizontal: tokens.space[6],
    borderRadius: tokens.radius.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    color: tokens.color.textSecondary,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type.md,
  },
  labelSelected: {
    color: tokens.color.accent,
  },
});
