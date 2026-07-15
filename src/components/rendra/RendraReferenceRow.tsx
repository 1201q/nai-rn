import { memo, useLayoutEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import Reanimated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { tokens } from "../../styles/tokens";
import { RendraToggle } from "./RendraFormControls";

type IconName = keyof typeof Ionicons.glyphMap;

const IMAGE_SCRIM_ENABLED_OPACITY = 0.62;
const IMAGE_SCRIM_DISABLED_OPACITY = 0.8;

export const RendraReferenceRow = memo(function RendraReferenceRow({
  icon,
  label,
  enabled,
  stateLabel,
  thumbnailUri,
  onPress,
  onToggle,
}: {
  icon: IconName;
  label: string;
  enabled?: boolean;
  stateLabel?: string;
  thumbnailUri?: string;
  onPress: () => void;
  onToggle?: (value: boolean) => void;
}) {
  const hasToggle = enabled !== undefined && onToggle !== undefined;
  const imageScrimOpacity = useSharedValue(
    enabled
      ? IMAGE_SCRIM_ENABLED_OPACITY
      : IMAGE_SCRIM_DISABLED_OPACITY,
  );
  const imageScrimAnimatedStyle = useAnimatedStyle(() => ({
    opacity: imageScrimOpacity.value,
  }));

  useLayoutEffect(() => {
    imageScrimOpacity.value = withTiming(
      enabled
        ? IMAGE_SCRIM_ENABLED_OPACITY
        : IMAGE_SCRIM_DISABLED_OPACITY,
      {
        duration: 180,
        easing: Easing.out(Easing.cubic),
      },
    );
  }, [enabled, imageScrimOpacity]);

  return (
    <View style={[styles.row, !hasToggle && styles.rowCompact]}>
      {thumbnailUri ? (
        <>
          <ExpoImage
            pointerEvents="none"
            source={{ uri: thumbnailUri }}
            contentFit="cover"
            transition={120}
            style={StyleSheet.absoluteFill}
          />
          <Reanimated.View
            pointerEvents="none"
            style={[styles.imageScrim, imageScrimAnimatedStyle]}
          />
        </>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label} 상세 설정`}
        onPress={onPress}
        style={({ pressed }) => [
          styles.rowMain,
          pressed && styles.pressed,
        ]}
      >
        <Ionicons name={icon} size={21} color={tokens.color.accent} />
        <View style={styles.copy}>
          <Text style={styles.label}>{label}</Text>
          {hasToggle ? (
            <Text style={styles.state}>
              {stateLabel ?? (enabled ? "켜짐" : "꺼짐")}
            </Text>
          ) : null}
        </View>
      </Pressable>

      {hasToggle ? (
        <View style={styles.trailing}>
          <RendraToggle
            value={enabled}
            label={`${label} ${enabled ? "끄기" : "켜기"}`}
            onChange={onToggle}
          />
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label} 열기`}
          hitSlop={8}
          onPress={onPress}
          style={({ pressed }) => [
            styles.chevronButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name="chevron-forward"
            size={18}
            color={tokens.color.textMuted}
          />
        </Pressable>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    height: 64,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.card,
  },
  rowCompact: {
    height: 56,
  },
  imageScrim: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: tokens.color.app,
  },
  rowMain: {
    flex: 1,
    height: "100%",
    paddingLeft: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type.base,
  },
  state: {
    marginTop: 2,
    color: tokens.color.textMuted,
    fontFamily: tokens.font.medium,
    fontSize: tokens.type["2xs"],
  },
  trailing: {
    paddingHorizontal: 14,
  },
  chevronButton: {
    width: 48,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.65,
  },
});
