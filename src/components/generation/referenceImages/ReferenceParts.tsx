import type { ComponentProps, ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import Reanimated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { tokens } from "../../../styles/tokens";
import { Toggle } from "../../forms/FormControls";
import { SheetSliderControls } from "../../forms/SheetSliderControls";

type IconName = ComponentProps<typeof Ionicons>["name"];

const REFERENCE_TIMING = {
  duration: 220,
  easing: Easing.out(Easing.cubic),
  reduceMotion: ReduceMotion.System,
};

export function ReferenceSlider({
  label,
  value,
  min,
  max,
  step,
  precision,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  precision: number;
  onChange: (value: number) => void;
}) {
  return (
    <View style={styles.sliderBlock}>
      <Text style={styles.sliderLabel}>{label}</Text>
      <SheetSliderControls
        label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        precision={precision}
        onChange={onChange}
      />
    </View>
  );
}

function ReferenceIconButton({
  label,
  icon,
  onPress,
  disabled = false,
  busy = false,
  destructive = false,
  standalone = false,
  compact = false,
  borderless = false,
}: {
  label: string;
  icon: IconName;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  destructive?: boolean;
  standalone?: boolean;
  compact?: boolean;
  borderless?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      hitSlop={compact ? { top: 3, bottom: 3 } : undefined}
      style={({ pressed }) => [
        styles.iconButton,
        standalone && styles.addButton,
        compact && styles.compactIconButton,
        borderless && styles.borderlessIconButton,
        (pressed || disabled || busy) && styles.dimmed,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={tokens.color.textTertiary} />
      ) : (
        <Ionicons
          name={icon}
          size={16}
          color={
            destructive ? tokens.color.negative : tokens.color.textTertiary
          }
        />
      )}
    </Pressable>
  );
}

export function ReferenceSection({
  title,
  description,
  icon,
  count,
  activeCount = count,
  busy,
  limit,
  onAdd,
  onReplace,
  children,
  group = false,
}: {
  title: string;
  description: string;
  icon: IconName;
  count: number;
  activeCount?: number;
  busy: boolean;
  limit: number;
  onAdd: () => void;
  onReplace?: () => void;
  children?: ReactNode;
  group?: boolean;
}) {
  const filled = count > 0;
  const countLabel =
    activeCount < count ? `${activeCount}/${count}` : `${count}`;
  const headerHeight = useSharedValue(filled ? 47 : 60);
  const contentHeight = useSharedValue(0);
  const headerStyle = useAnimatedStyle(() => ({
    marginHorizontal: withTiming(filled ? 8 : 0, REFERENCE_TIMING),
    height: withTiming(headerHeight.value, REFERENCE_TIMING),
  }));
  const contentStyle = useAnimatedStyle(() => ({
    height: withTiming(filled ? contentHeight.value : 0, REFERENCE_TIMING),
    opacity: withTiming(filled ? 1 : 0, REFERENCE_TIMING),
  }));
  if (group) {
    return (
      <View key="filled-group">
        <Reanimated.View
          testID={`${title}-header`}
          collapsable={false}
          style={[
            styles.card,
            styles.emptyCard,
            styles.groupHeaderFrame,
            filled ? styles.groupHeaderFilled : styles.groupHeaderEmpty,
            headerStyle,
          ]}
        >
          <View
            key={filled ? "filled-header" : "empty-header"}
            collapsable={false}
            onLayout={(event) => {
              headerHeight.value =
                event.nativeEvent.layout.height + (filled ? 1 : 2);
            }}
            style={[
              styles.header,
              styles.emptyHeader,
              styles.measuredContent,
              styles.groupHeaderSurface,
              filled && styles.groupHeaderRow,
            ]}
          >
            <Ionicons
              name={icon}
              size={22}
              color={tokens.color.textTertiary}
              style={styles.headerIcon}
            />
            <View style={styles.copy}>
              <Text style={styles.title}>
                {title}
                {filled ? (
                  <Text style={styles.groupCount}>{` (${countLabel})`}</Text>
                ) : null}
              </Text>
              {!filled ? (
                <Text style={styles.description}>{description}</Text>
              ) : null}
            </View>
            <ReferenceIconButton
              label={
                filled && onReplace ? "I2I 이미지 교체" : `${title} 이미지 추가`
              }
              icon={filled && !onReplace ? "add" : "cloud-upload-outline"}
              busy={busy}
              disabled={count >= limit && !onReplace}
              standalone
              compact={filled}
              onPress={filled && onReplace ? onReplace : onAdd}
            />
          </View>
        </Reanimated.View>
        <Reanimated.View
          collapsable={false}
          pointerEvents={filled ? "auto" : "none"}
          accessibilityElementsHidden={!filled}
          importantForAccessibility={filled ? "auto" : "no-hide-descendants"}
          style={[styles.clipped, contentStyle]}
        >
          {filled ? (
            <View
              testID={`${title}-images`}
              onLayout={(event) => {
                contentHeight.value = event.nativeEvent.layout.height;
              }}
              style={[styles.card, styles.measuredContent]}
            >
              {children}
            </View>
          ) : null}
        </Reanimated.View>
      </View>
    );
  }
  return (
    <View
      key="empty-section"
      testID={group ? `${title}-header` : undefined}
      style={[styles.card, count === 0 && styles.emptyCard]}
    >
      <View style={[styles.header, count === 0 && styles.emptyHeader]}>
        <Ionicons
          name={icon}
          size={22}
          color={tokens.color.textTertiary}
          style={styles.headerIcon}
        />
        <View style={styles.copy}>
          <Text style={styles.title}>
            {title}
            {count > 0 ? ` (${countLabel})` : ""}
          </Text>
          {count === 0 ? (
            <Text style={styles.description}>{description}</Text>
          ) : null}
        </View>
        <ReferenceIconButton
          label={`${title} 이미지 추가`}
          icon={count ? "add" : "cloud-upload-outline"}
          busy={busy}
          disabled={count >= limit}
          standalone={count === 0}
          onPress={onAdd}
        />
      </View>
      {children}
    </View>
  );
}

export function ReferenceItem({
  name,
  uri,
  enabled,
  cost,
  onToggle,
  onRemove,
  children,
  note,
  first = false,
}: {
  name: string;
  uri: string | null | undefined;
  enabled: boolean;
  cost?: string;
  onToggle: (value: boolean) => void;
  onRemove: () => void;
  children: ReactNode;
  note?: string;
  first?: boolean;
}) {
  return (
    <View style={[styles.item, first && styles.firstItem]}>
      <View style={styles.itemRow}>
        <View style={styles.thumbnailColumn}>
          <Image
            source={uri ? { uri } : undefined}
            accessibilityLabel={name}
            contentFit="contain"
            style={[styles.thumbnail, !enabled && styles.dimmed]}
          />
          <View style={styles.imageActions}>
            <ReferenceIconButton
              label={`${name} 삭제`}
              icon="trash-outline"
              destructive
              borderless
              onPress={onRemove}
            />
          </View>
        </View>
        <View style={styles.controls}>
          <View style={styles.itemHeading}>
            <Text numberOfLines={1} style={styles.name}>
              {name}
            </Text>
            {cost ? <Text style={styles.cost}>{cost}</Text> : null}
            <Toggle
              size="small"
              label={`${name} 사용`}
              value={enabled}
              onChange={onToggle}
            />
          </View>
          {children}
        </View>
      </View>
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sliderBlock: { gap: 7 },
  sliderLabel: {
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.medium,
    fontSize: 13,
  },
  card: {
    borderWidth: 1,
    borderColor: tokens.color.promptBorder,
    borderRadius: 16,
    backgroundColor: tokens.color.promptSurface,
    overflow: "hidden",
  },
  header: {
    minHeight: 40,
    paddingLeft: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: tokens.color.raised,
  },
  emptyCard: { backgroundColor: tokens.color.card },
  emptyHeader: {
    paddingVertical: 8,
    paddingRight: 12,
    backgroundColor: tokens.color.card,
  },
  groupHeaderFilled: {
    borderBottomWidth: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  groupHeaderEmpty: {
    borderBottomWidth: 1,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  groupHeaderFrame: { overflow: "visible" },
  groupHeaderSurface: { backgroundColor: "transparent" },
  groupHeaderRow: {
    paddingVertical: 2,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  clipped: { overflow: "hidden" },
  measuredContent: { position: "absolute", top: 0, left: 0, right: 0 },
  groupCount: {
    color: tokens.color.textMuted,
    fontFamily: tokens.font.regular,
    fontSize: 14,
  },
  addButton: {
    width: 42,
    height: 42,
    borderLeftWidth: 0,
    borderRadius: 12,
    backgroundColor: tokens.color.raised,
  },
  compactIconButton: { height: 28 },
  borderlessIconButton: { borderLeftWidth: 0 },
  headerIcon: { marginRight: 2 },
  copy: { flex: 1, minWidth: 0 },
  title: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: 15,
  },
  description: {
    marginTop: 1,
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.regular,
    fontSize: 13,
    lineHeight: 19,
  },
  iconButton: {
    width: 40,
    height: 40,
    flexShrink: 0,
    borderLeftWidth: 1,
    borderLeftColor: tokens.color.promptBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  dimmed: { opacity: 0.5 },
  item: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: tokens.color.promptBorder,
  },
  firstItem: { borderTopWidth: 0 },
  itemRow: { flexDirection: "row", alignItems: "flex-start", gap: 13 },
  thumbnailColumn: { width: 88, gap: 8 },
  thumbnail: {
    width: 88,
    height: 112,
    borderWidth: 1,
    borderColor: tokens.color.promptBorder,
    borderRadius: 10,
    backgroundColor: tokens.color.sunken,
  },
  imageActions: { flexDirection: "row", justifyContent: "center" },
  controls: { flex: 1, minWidth: 0, gap: 12 },
  itemHeading: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: {
    flex: 1,
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: 15,
  },
  cost: {
    borderRadius: 9,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: tokens.color.card,
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.semibold,
    fontSize: 12,
  },
  note: {
    marginTop: 12,
    color: tokens.color.textMuted,
    fontFamily: tokens.font.regular,
    fontSize: 12,
    lineHeight: 18,
  },
});
