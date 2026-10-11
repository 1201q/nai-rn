import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { useGenerationChromeMetrics } from "../../../../hooks/useGenerationChromeMetrics";
import { tokens } from "../../../../styles/tokens";

const BUTTON_HEIGHT = 48;
const BUTTON_GAP = 12;
const FADE_HEIGHT = 120;

// 버튼 아래로 마지막 내용이 가려지지 않게 스크롤 콘텐츠가 비워 둘 높이.
export function useMetadataFloatingInset() {
  const { actionBarHeight } = useGenerationChromeMetrics();
  return actionBarHeight + BUTTON_GAP + BUTTON_HEIGHT + 24;
}

// 액션바 바로 위에 떠 있는 버튼. 내용은 시트 색으로 옅어지며 버튼 뒤로 사라진다.
export function MetadataFloatingButton({
  label,
  icon,
  primary = false,
  disabled = false,
  onPress,
}: {
  label: string;
  icon?: ComponentProps<typeof Ionicons>["name"];
  primary?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { actionBarHeight } = useGenerationChromeMetrics();
  const color = disabled
    ? tokens.color.textMuted
    : primary
      ? tokens.color.app
      : tokens.color.textPrimary;

  return (
    <>
      <LinearGradient
        pointerEvents="none"
        colors={[
          "rgba(25,24,30,0)",
          "rgba(25,24,30,0.7)",
          "rgba(25,24,30,0.96)",
        ]}
        locations={[0, 0.55, 1]}
        style={[styles.fade, { bottom: actionBarHeight }]}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.button,
          { bottom: actionBarHeight + BUTTON_GAP },
          primary && !disabled && styles.buttonPrimary,
          pressed && styles.pressed,
        ]}
      >
        {icon ? <Ionicons name={icon} size={18} color={color} /> : null}
        <Text style={[styles.label, { color }]}>{label}</Text>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  fade: {
    position: "absolute",
    right: 0,
    left: 0,
    height: FADE_HEIGHT,
  },
  button: {
    position: "absolute",
    right: tokens.space[8],
    left: tokens.space[8],
    height: BUTTON_HEIGHT,
    borderRadius: tokens.radius.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.space[4],
    backgroundColor: tokens.color.toast,
    ...tokens.shadow.floatSm,
  },
  buttonPrimary: {
    backgroundColor: tokens.color.textPrimary,
  },
  label: {
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type.base,
  },
  pressed: {
    opacity: tokens.opacity.pressed,
  },
});
