import { memo, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import Reanimated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { tokens } from "../../styles/tokens";
import { RendraToggle } from "./RendraFormControls";

const CARD_LAYOUT = LinearTransition.duration(180).easing(
  Easing.out(Easing.cubic),
);

export function RendraReferenceDetailLayout({
  title,
  enabled,
  onToggle,
  children,
}: {
  title: string;
  enabled: boolean;
  onToggle: (value: boolean) => void;
  children: ReactNode;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 14,
            paddingBottom: insets.bottom + 32,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="뒤로"
            hitSlop={6}
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name="chevron-back"
              size={18}
              color={tokens.color.textPrimary}
            />
          </Pressable>
          <Text style={styles.title}>{title}</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>{title}</Text>
          <View style={styles.summaryControl}>
            <Text style={styles.summaryState}>{enabled ? "켜짐" : "꺼짐"}</Text>
            <RendraToggle value={enabled} label={title} onChange={onToggle} />
          </View>
        </View>

        {children}
      </ScrollView>
    </View>
  );
}

export const RendraReferenceImageCard = memo(
  function RendraReferenceImageCard({
    index,
    imageUri,
    subtitle,
    enabled,
    expanded,
    busy,
    enableDisabled = false,
    onToggleExpanded,
    onToggleEnabled,
    onReplace,
    onRemove,
    children,
  }: {
    index: number;
    imageUri: string;
    subtitle: string;
    enabled: boolean;
    expanded: boolean;
    busy: boolean;
    enableDisabled?: boolean;
    onToggleExpanded: () => void;
    onToggleEnabled: (value: boolean) => void;
    onReplace: () => void;
    onRemove: () => void;
    children: ReactNode;
  }) {
    return (
      <Reanimated.View layout={CARD_LAYOUT} style={styles.referenceCard}>
        <View style={styles.cardHeader}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Reference ${index + 1} ${expanded ? "접기" : "펼치기"}`}
            accessibilityState={{ expanded }}
            onPress={onToggleExpanded}
            style={({ pressed }) => [
              styles.cardHeaderMain,
              pressed && styles.pressed,
            ]}
          >
            <ExpoImage
              source={{ uri: imageUri }}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={120}
              style={styles.thumbnail}
            />
            <View style={styles.cardCopy}>
              <Text style={styles.cardTitle}>Reference {index + 1}</Text>
              <Text style={styles.cardSubtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            </View>
          </Pressable>
          <View>
            <RendraToggle
              value={enabled}
              label={`Reference ${index + 1}`}
              disabled={enableDisabled && !enabled}
              onChange={onToggleEnabled}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={expanded ? "참조 이미지 접기" : "참조 이미지 펼치기"}
            onPress={onToggleExpanded}
            style={({ pressed }) => [
              styles.chevronButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name={expanded ? "chevron-up" : "chevron-down"}
              size={18}
              color={tokens.color.textMuted}
            />
          </Pressable>
        </View>

        {expanded ? (
          <Reanimated.View
            entering={FadeIn.duration(140)}
            exiting={FadeOut.duration(90)}
            layout={CARD_LAYOUT}
            style={styles.expandedBody}
          >
            <View style={styles.previewCard}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Reference ${index + 1} 이미지 교체`}
                disabled={busy}
                onPress={onReplace}
                style={StyleSheet.absoluteFill}
              >
                <ExpoImage
                  source={{ uri: imageUri }}
                  contentFit="cover"
                  contentPosition="center"
                  cachePolicy="memory-disk"
                  transition={120}
                  style={StyleSheet.absoluteFill}
                />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Reference ${index + 1} 삭제`}
                disabled={busy}
                hitSlop={5}
                onPress={onRemove}
                style={({ pressed }) => [
                  styles.removeButton,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name="trash-outline"
                  size={16}
                  color={tokens.color.negative}
                />
              </Pressable>
              {busy ? (
                <View pointerEvents="none" style={styles.busyOverlay}>
                  <ActivityIndicator color={tokens.color.textPrimary} />
                </View>
              ) : null}
            </View>
            <View style={styles.controls}>{children}</View>
          </Reanimated.View>
        ) : null}
      </Reanimated.View>
    );
  },
);

export const RendraAddReferenceButton = memo(
  function RendraAddReferenceButton({
    disabled,
    busy,
    onPress,
  }: {
    disabled: boolean;
    busy: boolean;
    onPress: () => void;
  }) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="참조 이미지 추가"
        accessibilityState={{ disabled: disabled || busy }}
        disabled={disabled || busy}
        onPress={onPress}
        style={({ pressed }) => [
          styles.addButton,
          disabled && styles.disabled,
          pressed && styles.pressed,
        ]}
      >
        {busy ? (
          <ActivityIndicator color={tokens.color.textPrimary} />
        ) : (
          <Ionicons name="add" size={20} color={tokens.color.textPrimary} />
        )}
        <Text style={styles.addButtonLabel}>Add Reference Image</Text>
      </Pressable>
    );
  },
);

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: tokens.color.app,
  },
  content: {
    paddingHorizontal: tokens.space[10],
  },
  header: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.card,
  },
  title: {
    flex: 1,
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type.xl,
    letterSpacing: tokens.tracking.tight,
  },
  summaryCard: {
    height: 56,
    marginTop: 24,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.card,
  },
  summaryLabel: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type.base,
  },
  summaryControl: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  summaryState: {
    color: tokens.color.textMuted,
    fontFamily: tokens.font.medium,
    fontSize: tokens.type["2xs"],
  },
  referenceCard: {
    overflow: "hidden",
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.card,
  },
  cardHeader: {
    height: 64,
    paddingLeft: 12,
    paddingRight: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  cardHeaderMain: {
    flex: 1,
    minWidth: 0,
    height: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  thumbnail: {
    width: 44,
    height: 44,
    borderRadius: 11,
    backgroundColor: tokens.color.sunken,
  },
  cardCopy: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type.base,
  },
  cardSubtitle: {
    marginTop: 2,
    color: tokens.color.textMuted,
    fontFamily: tokens.font.medium,
    fontSize: tokens.type["2xs"],
  },
  chevronButton: {
    width: 34,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  expandedBody: {
    paddingHorizontal: 12,
    paddingBottom: 18,
  },
  previewCard: {
    width: "100%",
    aspectRatio: 2.4,
    overflow: "hidden",
    borderRadius: 14,
    backgroundColor: tokens.color.sunken,
  },
  removeButton: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    backgroundColor: "rgba(23,23,26,0.86)",
  },
  busyOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.scrim,
  },
  controls: {
    marginTop: 22,
    gap: 24,
  },
  addButton: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    backgroundColor: tokens.color.card,
  },
  addButtonLabel: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.medium,
    fontSize: tokens.type.sm,
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.68,
  },
});
