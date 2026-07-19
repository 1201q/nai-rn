import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Reanimated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { tokens } from "../../styles/tokens";

const PRESS_IN_TIMING = { duration: 90 };
const PRESS_OUT_TIMING = { duration: 130 };

export type SelectionOption<T extends string | number> = {
  value: T;
  label: string;
  recommended?: boolean;
};

function SelectionOptionRow<T extends string | number>({
  option,
  selected,
  onSelect,
}: {
  option: SelectionOption<T>;
  selected: boolean;
  onSelect: (value: T) => void;
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
      accessibilityLabel={option.label}
      onPressIn={() => {
        pressProgress.value = withTiming(1, PRESS_IN_TIMING);
      }}
      onPressOut={() => {
        pressProgress.value = withTiming(0, PRESS_OUT_TIMING);
      }}
      onPress={() => onSelect(option.value)}
    >
      <Reanimated.View style={[styles.option, animatedStyle]}>
        <View style={styles.labelRow}>
          <Text style={[styles.label, selected && styles.labelSelected]}>
            {option.label}
          </Text>
          {option.recommended ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>권장</Text>
            </View>
          ) : null}
        </View>
        {selected ? (
          <Ionicons name="checkmark" size={22} color={tokens.color.accent} />
        ) : null}
      </Reanimated.View>
    </Pressable>
  );
}

export function SelectionSheet<T extends string | number>({
  options,
  selectedValue,
  onSelect,
}: {
  options: readonly SelectionOption<T>[];
  selectedValue: string | number;
  onSelect: (value: T) => void;
}) {
  return (
    <View style={styles.options}>
      {options.map((option) => (
        <SelectionOptionRow
          key={option.value}
          option={option}
          selected={option.value === selectedValue}
          onSelect={onSelect}
        />
      ))}
    </View>
  );
}

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
  labelRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space[7],
  },
  label: {
    color: tokens.color.textSecondary,
    fontFamily: tokens.font.medium,
    fontSize: 17,
    lineHeight: 22,
  },
  labelSelected: {
    color: tokens.color.accent,
  },
  badge: {
    minHeight: 20,
    borderRadius: tokens.space[3],
    paddingHorizontal: tokens.space[5],
    paddingVertical: tokens.space[1],
    backgroundColor: tokens.color.sunken,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.bold,
    fontSize: tokens.type["2xs"],
    lineHeight: 14,
  },
});
