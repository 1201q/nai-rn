import { memo, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { tokens } from "../../styles/tokens";

type IconName = keyof typeof Ionicons.glyphMap;

export const RendraIconButton = memo(function RendraIconButton({
  icon,
  label,
  onPress,
  disabled = false,
  active = false,
  size = 48,
  style,
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  active?: boolean;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: active }}
      disabled={disabled}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        { width: size, height: size, borderRadius: size / 2 },
        active && styles.iconButtonActive,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <Ionicons
        name={icon}
        size={size <= 40 ? 18 : 21}
        color={active ? tokens.color.onAccent : tokens.color.textPrimary}
      />
    </Pressable>
  );
});

export const RendraPrimaryButton = memo(function RendraPrimaryButton({
  label,
  icon,
  loading = false,
  disabled = false,
  onPress,
  background,
}: {
  label: string;
  icon?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
  background?: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        disabled && styles.primaryDisabled,
        pressed && !disabled && styles.primaryPressed,
      ]}
    >
      {background}
      <View style={styles.primaryContent}>
        {loading ? (
          <ActivityIndicator size="small" color={tokens.color.onAccent} />
        ) : (
          icon
        )}
        <Text
          style={[styles.primaryLabel, disabled && styles.primaryLabelDisabled]}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  iconButton: {
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    backgroundColor: tokens.color.overlay,
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    ...tokens.shadow.floatMd,
  },
  iconButtonActive: {
    backgroundColor: tokens.color.accent,
  },
  disabled: {
    opacity: 0.38,
  },
  pressed: {
    opacity: 0.72,
  },
  primaryButton: {
    flex: 1,
    height: 52,
    overflow: "hidden",
    borderRadius: tokens.radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.accent,
    ...tokens.shadow.floatMd,
  },
  primaryPressed: {
    opacity: 0.78,
  },
  primaryDisabled: {
    backgroundColor: tokens.color.raised,
    opacity: 0.55,
  },
  primaryContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.space[4],
    zIndex: 1,
  },
  primaryLabel: {
    color: tokens.color.onAccent,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type.md,
  },
  primaryLabelDisabled: {
    color: tokens.color.textMuted,
  },
});
