import { memo, useEffect, useRef, type ReactNode } from "react";
import {
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Reanimated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { tokens } from "../../styles/tokens";

type IconName = keyof typeof Ionicons.glyphMap;

const TAB_TIMING = {
  duration: 180,
  easing: Easing.out(Easing.cubic),
};

export const OptionCard = memo(function OptionCard({
  icon,
  label,
  value,
  onPress,
}: {
  icon: IconName;
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${value}`}
      onPress={onPress}
      style={({ pressed }) => [styles.optionCard, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={21} color={tokens.color.accent} />
      <View style={styles.optionCardText}>
        <Text style={styles.optionCardLabel}>{label}</Text>
        <Text style={styles.optionCardValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </Pressable>
  );
});

export const SettingsRow = memo(function SettingsRow({
  icon,
  label,
  value,
  onPress,
  trailing,
  showChevron = false,
}: {
  icon: IconName;
  label: string;
  value?: string;
  onPress?: () => void;
  trailing?: ReactNode;
  showChevron?: boolean;
}) {
  const content = (
    <>
      <Ionicons name={icon} size={19} color={tokens.color.textTertiary} />
      <Text style={styles.rowLabel}>{label}</Text>
      {value ? (
        <Text style={styles.rowValue} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {trailing ??
        (onPress || showChevron ? (
          <Ionicons
            name="chevron-forward"
            size={16}
            color={tokens.color.textMuted}
          />
        ) : null)}
    </>
  );

  if (!onPress) {
    return <View style={styles.row}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}${value ? `, ${value}` : ""}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
});

export type SettingsTab = {
  key: string;
  label: string;
  icon: IconName;
};

export const SettingsTabBar = memo(function SettingsTabBar({
  tabs,
  activeKey,
  onChange,
}: {
  tabs: readonly SettingsTab[];
  activeKey: string;
  onChange: (key: string) => void;
}) {
  const pillX = useSharedValue(0);
  const pillWidth = useSharedValue(0);
  const pillOpacity = useSharedValue(0);
  const pillReady = useRef(false);
  const tabLayouts = useRef<Record<string, { x: number; width: number }>>({});

  const pillStyle = useAnimatedStyle(() => ({
    left: pillX.value,
    width: pillWidth.value,
    opacity: pillOpacity.value,
  }));

  useEffect(() => {
    const layout = tabLayouts.current[activeKey];
    if (!layout) return;

    pillX.value = withTiming(layout.x, TAB_TIMING);
    pillWidth.value = withTiming(layout.width, TAB_TIMING);
    pillOpacity.value = withTiming(1, { duration: 80 });
  }, [activeKey, pillOpacity, pillWidth, pillX]);

  const handleTabLayout = (key: string) => (event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    tabLayouts.current[key] = { x, width };
    if (key !== activeKey) return;

    if (!pillReady.current) {
      pillReady.current = true;
      pillX.value = x;
      pillWidth.value = width;
      pillOpacity.value = 1;
      return;
    }

    pillX.value = withTiming(x, TAB_TIMING);
    pillWidth.value = withTiming(width, TAB_TIMING);
    pillOpacity.value = withTiming(1, { duration: 80 });
  };

  return (
    <View style={styles.tabBarShadow}>
      <View style={styles.tabBar}>
        <View style={styles.tabBarContent}>
          <Reanimated.View
            pointerEvents="none"
            style={[styles.slidingPill, pillStyle]}
          />
          {tabs.map((tab) => {
            const active = tab.key === activeKey;
            return (
              <Reanimated.View
                key={tab.key}
                onLayout={handleTabLayout(tab.key)}
                style={styles.tabSlot}
              >
                <Pressable
                  accessibilityRole="tab"
                  accessibilityLabel={tab.label}
                  accessibilityState={{ selected: active }}
                  onPress={() => onChange(tab.key)}
                  style={({ pressed }) => [
                    styles.tab,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons
                    name={tab.icon}
                    size={18}
                    color={
                      active
                        ? tokens.color.onAccent
                        : tokens.color.textSecondary
                    }
                  />
                  <Text
                    style={[
                      styles.tabLabel,
                      !active && styles.tabLabelInactive,
                    ]}
                    numberOfLines={1}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              </Reanimated.View>
            );
          })}
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  optionCard: {
    flex: 1,
    height: 132,
    minWidth: 0,
    padding: 20,
    borderRadius: tokens.radius["2xl"],
    justifyContent: "space-between",
    backgroundColor: tokens.color.card,
  },
  optionCardText: {
    gap: 4,
  },
  optionCardLabel: {
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.medium,
    fontSize: tokens.type["2xs"],
  },
  optionCardValue: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type.lg,
    letterSpacing: -0.3,
  },
  row: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 4,
  },
  rowLabel: {
    flex: 1,
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.medium,
    fontSize: tokens.type.md,
  },
  rowValue: {
    maxWidth: "48%",
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.regular,
    fontSize: tokens.type.base,
  },
  pressed: {
    opacity: 0.65,
  },
  tabBarShadow: {
    flex: 1,
    height: 52,
    borderRadius: tokens.radius.pill,
    shadowColor: tokens.color.raised,
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  tabBar: {
    flex: 1,
    overflow: "hidden",
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    backgroundColor: tokens.color.card,
  },
  tabBarContent: {
    position: "absolute",
    top: 4,
    right: 4,
    bottom: 4,
    left: 4,
    flexDirection: "row",
    alignItems: "stretch",
    gap: 2,
  },
  slidingPill: {
    position: "absolute",
    top: 0,
    bottom: 0,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.accent,
  },
  tabSlot: {
    flex: 1,
    zIndex: 1,
  },
  tab: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
    borderRadius: tokens.radius.pill,
  },
  tabLabel: {
    color: tokens.color.onAccent,
    fontFamily: tokens.font.semibold,
    fontSize: 9,
    lineHeight: 10,
  },
  tabLabelInactive: {
    color: tokens.color.textTertiary,
  },
});
