import { useEffect, type ComponentProps, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Reanimated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useGenerationChromeMetrics } from "../../hooks/useGenerationChromeMetrics";
import { tokens } from "../../styles/tokens";

// 시트 위에 항상 떠 있는 하단 바. 생성 화면과 업스케일 화면이 같이 쓴다.
export function ActionBar({
  testID,
  children,
}: {
  testID?: string;
  children: ReactNode;
}) {
  const { actionBarHeight, bottomInset } = useGenerationChromeMetrics();
  return (
    <View
      testID={testID}
      style={[
        styles.actionBar,
        { height: actionBarHeight, paddingBottom: bottomInset },
      ]}
    >
      {children}
    </View>
  );
}

export function ActionIconButton({
  icon,
  label,
  active,
  onPress,
}: {
  icon: "settings-sharp" | "time-outline";
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionIconButton,
        active && styles.actionIconButtonActive,
        pressed && styles.actionPressed,
      ]}
    >
      <Ionicons name={icon} size={20} color={tokens.color.textPrimary} />
    </Pressable>
  );
}

// 가운데 주 버튼. loading 동안은 percent(0~1)만큼 배경이 채워진다.
export function ActionProgressButton({
  label,
  icon,
  loading,
  percent,
  disabled = false,
  accessibilityHint,
  onPress,
  children,
}: {
  label: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  loading: boolean;
  percent: number;
  disabled?: boolean;
  accessibilityHint?: string;
  onPress: () => void;
  children?: ReactNode;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = loading
      ? withTiming(percent, { duration: 300, easing: Easing.linear })
      : 0;
  }, [loading, percent, progress]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));
  const contentColor = disabled
    ? tokens.color.textMuted
    : tokens.color.onAccent;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.progressButton,
        disabled && styles.progressButtonDisabled,
        pressed && styles.actionPressed,
      ]}
    >
      {loading ? (
        <Reanimated.View style={[styles.progressFill, progressStyle]} />
      ) : null}
      <View style={styles.progressButtonContent}>
        <Ionicons name={icon} size={16} color={contentColor} />
        <Text style={[styles.progressButtonLabel, { color: contentColor }]}>
          {label}
        </Text>
      </View>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actionBar: {
    position: "absolute",
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 90,
    elevation: 90,
    paddingTop: 12,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.color.borderSubtle,
    backgroundColor: tokens.color.cardAlt,
  },
  actionIconButton: {
    width: 48,
    height: 48,
    borderWidth: 2,
    borderColor: "transparent",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.raised,
  },
  actionIconButtonActive: {
    borderColor: tokens.color.accent,
  },
  progressButton: {
    flex: 1,
    height: 48,
    overflow: "hidden",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.accent,
  },
  progressButtonDisabled: {
    opacity: 0.55,
    backgroundColor: tokens.color.raised,
  },
  progressButtonContent: {
    zIndex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  progressButtonLabel: {
    fontFamily: tokens.font.bold,
    fontSize: 16,
    letterSpacing: -0.2,
  },
  actionPressed: {
    opacity: tokens.opacity.pressed,
  },
  progressFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: tokens.color.accentActive,
  },
});
