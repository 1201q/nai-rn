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
import {
  TAP_FEEDBACK_OVERLAY_COLOR,
  useTapFeedback,
} from "../common/TapFeedbackPressable";
import { Toggle } from "../forms/FormControls";

type IconName = keyof typeof Ionicons.glyphMap;

const IMAGE_SCRIM_ENABLED_OPACITY = 0.62;
const IMAGE_SCRIM_DISABLED_OPACITY = 0.8;

export const ReferenceRow = memo(function ReferenceRow({
  icon,
  label,
  variant,
  enabled,
  stateLabel,
  toggleDisabled = false,
  thumbnailUri,
  onPress,
  onToggle,
}: {
  icon?: IconName;
  label: string;
  variant: "grouped" | "pill";
  enabled?: boolean;
  stateLabel?: string;
  toggleDisabled?: boolean;
  thumbnailUri?: string;
  onPress: () => void;
  onToggle?: (value: boolean) => void;
}) {
  const hasToggle = enabled !== undefined && onToggle !== undefined;
  const secondaryText =
    stateLabel ?? (hasToggle ? (enabled ? "켜짐" : "꺼짐") : undefined);
  const hasSecondary = secondaryText !== undefined;
  const imageScrimOpacity = useSharedValue(
    enabled
      ? IMAGE_SCRIM_ENABLED_OPACITY
      : IMAGE_SCRIM_DISABLED_OPACITY,
  );
  const imageScrimAnimatedStyle = useAnimatedStyle(() => ({
    opacity: imageScrimOpacity.value,
  }));
  const {
    contentAnimatedStyle,
    endFeedback,
    overlayStyle,
    startFeedback,
  } = useTapFeedback();

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
    <View
      style={[
        styles.row,
        variant === "grouped" ? styles.rowGrouped : styles.rowPill,
        hasSecondary && styles.rowWithSecondary,
      ]}
    >
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

      <Reanimated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          styles.tapOverlay,
          overlayStyle,
        ]}
      />

      <Reanimated.View
        pointerEvents="box-none"
        style={[styles.rowTapContent, contentAnimatedStyle]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label} 상세 설정`}
          onPress={onPress}
          onPressIn={startFeedback}
          onPressOut={endFeedback}
          style={styles.rowMain}
        >
          {icon ? (
            <Ionicons name={icon} size={21} color={tokens.color.accent} />
          ) : null}
          <View style={styles.copy}>
            <Text style={styles.label}>{label}</Text>
            {hasSecondary ? (
              <Text style={styles.state}>{secondaryText}</Text>
            ) : null}
          </View>
        </Pressable>

        {hasToggle ? (
          <View style={styles.trailing}>
            <Toggle
              value={enabled}
              label={`${label} ${enabled ? "끄기" : "켜기"}`}
              disabled={toggleDisabled && !enabled}
              onChange={onToggle}
            />
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${label} 열기`}
            hitSlop={8}
            onPress={onPress}
            onPressIn={startFeedback}
            onPressOut={endFeedback}
            style={styles.chevronButton}
          >
            <Ionicons
              name="chevron-forward"
              size={18}
              color={tokens.color.textMuted}
            />
          </Pressable>
        )}
      </Reanimated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
  },
  rowGrouped: {
    minHeight: 58,
    backgroundColor: "transparent",
  },
  rowWithSecondary: {
    minHeight: 76,
    paddingVertical: 15,
  },
  rowPill: {
    minHeight: 58,
    paddingVertical: 10,
    borderRadius: tokens.radius["2xl"],
    backgroundColor: tokens.color.card,
  },
  imageScrim: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: tokens.color.app,
  },
  tapOverlay: {
    backgroundColor: TAP_FEEDBACK_OVERLAY_COLOR,
  },
  rowTapContent: {
    flex: 1,
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
  },
  rowMain: {
    flex: 1,
    alignSelf: "stretch",
    paddingLeft: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.regular,
    fontSize: 17,
    lineHeight: 22,
  },
  state: {
    marginTop: 4,
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.regular,
    fontSize: tokens.type.sm,
    lineHeight: 20,
  },
  trailing: {
    paddingLeft: 14,
    paddingRight: 18,
  },
  chevronButton: {
    width: 48,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
  },
});
