import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";

import { tokens } from "../../styles/tokens";
import { RendraToggle } from "./RendraFormControls";

type IconName = keyof typeof Ionicons.glyphMap;

export const RendraReferenceRow = memo(function RendraReferenceRow({
  icon,
  label,
  enabled,
  thumbnailUri,
  onPress,
  onToggle,
}: {
  icon: IconName;
  label: string;
  enabled?: boolean;
  thumbnailUri?: string;
  onPress: () => void;
  onToggle?: (value: boolean) => void;
}) {
  const hasToggle = enabled !== undefined && onToggle !== undefined;

  return (
    <View style={styles.row}>
      {thumbnailUri ? (
        <>
          <ExpoImage
            pointerEvents="none"
            source={{ uri: thumbnailUri }}
            contentFit="cover"
            transition={120}
            style={StyleSheet.absoluteFill}
          />
          <View pointerEvents="none" style={styles.imageScrim} />
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
            <Text style={styles.state}>{enabled ? "켜짐" : "꺼짐"}</Text>
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
    height: 72,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.card,
  },
  imageScrim: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(10,10,11,0.72)",
  },
  rowMain: {
    flex: 1,
    height: "100%",
    paddingLeft: 18,
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
    fontFamily: tokens.font.bold,
    fontSize: tokens.type.base,
  },
  state: {
    marginTop: 2,
    color: tokens.color.textMuted,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type["2xs"],
  },
  trailing: {
    paddingHorizontal: 18,
  },
  chevronButton: {
    width: 56,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.65,
  },
});
