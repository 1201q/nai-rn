import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Animated,
  type LayoutChangeEvent,
  Pressable,
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
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { tokens } from "../../styles/tokens";
import {
  RENDRA_DETAIL_HEADER_TOP_OFFSET,
  RendraDetailHeaderOverlay,
  RendraDetailScrollTitle,
} from "./RendraDetailScrollHeader";
import { RendraToggle } from "./RendraFormControls";

const CARD_BODY_TIMING = {
  duration: 180,
  easing: Easing.out(Easing.cubic),
};
const DISABLED_CARD_SCRIM_OPACITY = 0.5;

type RendraReferenceStatusTone = "cost" | "cached";

type RendraReferenceCardStatus = {
  label: string;
  tone: RendraReferenceStatusTone;
};

export function RendraReferenceDetailLayout({
  title,
  enabled,
  unavailableReason,
  onToggle,
  children,
}: {
  title: string;
  enabled: boolean;
  unavailableReason?: string;
  onToggle: (value: boolean) => void;
  children: ReactNode;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <Animated.ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + RENDRA_DETAIL_HEADER_TOP_OFFSET,
            paddingBottom: insets.bottom + 32,
          },
        ]}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        <RendraDetailScrollTitle title={title} scrollY={scrollY} />

        {unavailableReason ? (
          <View style={styles.unavailableCard}>
            <View style={styles.unavailableCopy}>
              <Text style={styles.unavailableTitle}>{title}</Text>
              <Text style={styles.unavailableDescription}>
                {unavailableReason}
              </Text>
            </View>
            <RendraToggle
              value={enabled}
              label={title}
              disabled={!enabled}
              onChange={onToggle}
            />
          </View>
        ) : (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>{title}</Text>
            <View style={styles.summaryControl}>
              <Text style={styles.summaryState}>
                {enabled ? "켜짐" : "꺼짐"}
              </Text>
              <RendraToggle value={enabled} label={title} onChange={onToggle} />
            </View>
          </View>
        )}

        {children}
      </Animated.ScrollView>

      <RendraDetailHeaderOverlay
        scrollY={scrollY}
        topInset={insets.top}
        onBack={() => router.back()}
      />
    </View>
  );
}

export const RendraReferenceUsageNotice = memo(
  function RendraReferenceUsageNotice({
    tone,
    title,
    description,
  }: {
    tone: RendraReferenceStatusTone;
    title: string;
    description: string;
  }) {
    const isCost = tone === "cost";
    const color = isCost ? tokens.color.accent : tokens.color.textTertiary;

    return (
      <View style={styles.usageNotice}>
        <Ionicons
          name={isCost ? "diamond-outline" : "checkmark-circle-outline"}
          size={18}
          color={color}
        />
        <View style={styles.usageNoticeCopy}>
          <Text
            style={[
              styles.usageNoticeTitle,
              isCost && styles.usageNoticeTitleCost,
            ]}
          >
            {title}
          </Text>
          <Text style={styles.usageNoticeDescription}>{description}</Text>
        </View>
      </View>
    );
  },
);

export const RendraReferenceImageCard = memo(
  function RendraReferenceImageCard({
    index,
    imageUri,
    thumbnailUri,
    subtitle,
    status,
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
    thumbnailUri: string;
    subtitle: string;
    status?: RendraReferenceCardStatus;
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
    const [bodyMeasured, setBodyMeasured] = useState(false);
    const [bodyContentHeight, setBodyContentHeight] = useState(0);
    const bodyHeight = useSharedValue(0);
    const bodyOpacity = useSharedValue(expanded ? 1 : 0);
    const cardScrimOpacity = useSharedValue(
      enabled ? 0 : DISABLED_CARD_SCRIM_OPACITY,
    );
    const bodyAnimatedStyle = useAnimatedStyle(() => ({
      height: bodyMeasured
        ? bodyHeight.value
        : expanded
          ? undefined
          : 0,
      opacity: bodyOpacity.value,
    }));
    const cardScrimAnimatedStyle = useAnimatedStyle(() => ({
      opacity: cardScrimOpacity.value,
    }));

    useEffect(() => {
      if (!bodyMeasured || bodyContentHeight <= 0) return;
      bodyHeight.value = withTiming(
        expanded ? bodyContentHeight : 0,
        CARD_BODY_TIMING,
      );
      bodyOpacity.value = withTiming(expanded ? 1 : 0, {
        duration: expanded ? 140 : 100,
      });
    }, [bodyContentHeight, bodyHeight, bodyMeasured, bodyOpacity, expanded]);

    useEffect(() => {
      cardScrimOpacity.value = withTiming(
        enabled ? 0 : DISABLED_CARD_SCRIM_OPACITY,
        {
          duration: 180,
          easing: Easing.out(Easing.cubic),
        },
      );
    }, [cardScrimOpacity, enabled]);

    function handleBodyLayout(event: LayoutChangeEvent) {
      const nextHeight = Math.ceil(event.nativeEvent.layout.height);
      if (nextHeight <= 0 || nextHeight === bodyContentHeight) return;

      if (!bodyMeasured) {
        bodyHeight.value = expanded ? nextHeight : 0;
        bodyOpacity.value = expanded ? 1 : 0;
        setBodyMeasured(true);
      }
      setBodyContentHeight(nextHeight);
    }

    return (
      <View style={styles.referenceCard}>
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
              source={{ uri: thumbnailUri }}
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
          {status ? (
            <View style={styles.statusBadge}>
              <Ionicons
                name={
                  status.tone === "cost"
                    ? "diamond-outline"
                    : "checkmark-circle-outline"
                }
                size={12}
                color={
                  status.tone === "cost"
                    ? tokens.color.accent
                    : tokens.color.textTertiary
                }
              />
              <Text
                style={[
                  styles.statusBadgeLabel,
                  status.tone === "cost" && styles.statusBadgeLabelCost,
                ]}
              >
                {status.label}
              </Text>
            </View>
          ) : null}
          <View style={styles.toggleSlot}>
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

        <Reanimated.View
          accessibilityElementsHidden={!expanded}
          importantForAccessibility={expanded ? "auto" : "no-hide-descendants"}
          pointerEvents={expanded ? "auto" : "none"}
          style={[styles.bodyClip, bodyAnimatedStyle]}
        >
          <View
            onLayout={handleBodyLayout}
            style={[
              styles.expandedBody,
              (bodyMeasured || !expanded) && styles.expandedBodyMeasured,
            ]}
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
          </View>
        </Reanimated.View>

        <Reanimated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            styles.disabledCardScrim,
            cardScrimAnimatedStyle,
          ]}
        />
      </View>
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
    paddingHorizontal: tokens.space[8],
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
  unavailableCard: {
    marginTop: 24,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.card,
  },
  unavailableCopy: {
    flex: 1,
    minWidth: 0,
  },
  unavailableTitle: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.medium,
    fontSize: tokens.type.sm,
  },
  unavailableDescription: {
    marginTop: 4,
    color: tokens.color.textMuted,
    fontFamily: tokens.font.regular,
    fontSize: tokens.type["2xs"],
    lineHeight: 17,
  },
  referenceCard: {
    position: "relative",
    overflow: "hidden",
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.card,
  },
  cardHeader: {
    height: 58,
    paddingLeft: 12,
    paddingRight: 4,
    flexDirection: "row",
    alignItems: "center",
  },
  cardHeaderMain: {
    flex: 1,
    minWidth: 0,
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  thumbnail: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: tokens.color.sunken,
  },
  cardCopy: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type.md,
    lineHeight: 19,
  },
  cardSubtitle: {
    marginTop: 1,
    color: tokens.color.textMuted,
    fontFamily: tokens.font.regular,
    fontSize: tokens.type["2xs"],
    lineHeight: 15,
  },
  statusBadge: {
    height: 24,
    paddingHorizontal: tokens.space[3],
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space[1],
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.sunken,
  },
  statusBadgeLabel: {
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type["3xs"],
  },
  statusBadgeLabelCost: {
    color: tokens.color.accent,
  },
  toggleSlot: {
    width: 52,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  chevronButton: {
    width: 42,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  bodyClip: {
    width: "100%",
    overflow: "hidden",
  },
  expandedBody: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  expandedBodyMeasured: {
    position: "absolute",
    top: 0,
    right: 0,
    left: 0,
  },
  previewCard: {
    width: "100%",
    aspectRatio: 2.4,
    overflow: "hidden",
    borderRadius: 12,
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
  usageNotice: {
    minHeight: 58,
    paddingHorizontal: tokens.space[6],
    paddingVertical: tokens.space[5],
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space[5],
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.sunken,
  },
  usageNoticeCopy: {
    flex: 1,
    gap: tokens.space[1],
  },
  usageNoticeTitle: {
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type.xs,
  },
  usageNoticeTitleCost: {
    color: tokens.color.accent,
  },
  usageNoticeDescription: {
    color: tokens.color.textMuted,
    fontFamily: tokens.font.regular,
    fontSize: tokens.type["2xs"],
    lineHeight: 17,
  },
  disabledCardScrim: {
    zIndex: 2,
    backgroundColor: tokens.color.app,
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
