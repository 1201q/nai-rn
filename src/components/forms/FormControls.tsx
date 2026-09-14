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
});
