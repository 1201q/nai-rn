import { memo, useCallback, useLayoutEffect } from "react";
import { Pressable, StyleSheet, type PressableProps } from "react-native";
import * as Haptics from "expo-haptics";
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { tokens } from "../../styles/tokens";

export const Toggle = memo(function Toggle({
  value,
  onChange,
  label,
  disabled = false,
  size = "default",
  onPressIn,
  onPressOut,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
  size?: "default" | "small";
  onPressIn?: PressableProps["onPressIn"];
  onPressOut?: PressableProps["onPressOut"];
}) {
  const small = size === "small";
  const progress = useSharedValue(value ? 1 : 0);

  useLayoutEffect(() => {
    progress.value = withTiming(value ? 1 : 0, { duration: 180 });
  }, [progress, value]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * (small ? 14 : 18) }],
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
        small && styles.toggleTrackSmall,
        value && styles.toggleTrackOn,
        disabled && styles.toggleDisabled,
      ]}
    >
      <Reanimated.View
        style={[
          styles.toggleThumb,
          small && styles.toggleThumbSmall,
          value && styles.toggleThumbOn,
          thumbStyle,
        ]}
      />
    </Pressable>
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
  toggleTrackSmall: {
    width: 36,
    height: 22,
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
  toggleThumbSmall: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  toggleThumbOn: {
    backgroundColor: tokens.color.onAccent,
  },
  toggleDisabled: {
    opacity: 0.4,
  },
});
