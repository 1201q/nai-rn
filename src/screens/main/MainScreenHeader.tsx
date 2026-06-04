import { useEffect, useRef } from "react";
import { Animated, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors } from "../../styles/colors";
import { MAIN_SEGMENT_BUTTON_WIDTH, styles } from "./styles";

export type MainPageIndex = 0 | 1;

export function MainScreenHeader({
  activeIndex,
  onSelect,
  onOpenSettings,
  onOpenAssistant,
}: {
  activeIndex: MainPageIndex;
  onSelect: (index: MainPageIndex) => void;
  onOpenSettings: () => void;
  onOpenAssistant: () => void;
}) {
  const indicatorX = useRef(
    new Animated.Value(activeIndex * MAIN_SEGMENT_BUTTON_WIDTH),
  ).current;

  useEffect(() => {
    Animated.timing(indicatorX, {
      toValue: activeIndex * MAIN_SEGMENT_BUTTON_WIDTH,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [activeIndex, indicatorX]);

  return (
    <View style={styles.header}>
      <View style={styles.headerSide} />
      <View style={styles.segmentedControl}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.segmentIndicator,
            { transform: [{ translateX: indicatorX }] },
          ]}
        />
        <SegmentButton
          icon="create"
          accessibilityLabel="Create"
          active={activeIndex === 0}
          onPress={() => onSelect(0)}
        />
        <SegmentButton
          icon="history"
          accessibilityLabel="History"
          active={activeIndex === 1}
          onPress={() => onSelect(1)}
        />
      </View>
      <View style={styles.headerRight}>
        <TouchableOpacity
          style={styles.headerIconButton}
          activeOpacity={0.78}
          accessibilityRole="button"
          accessibilityLabel="Assistant"
          onPress={onOpenAssistant}
        >
          <Ionicons
            name="flask-outline"
            size={21}
            color={colors.colorTextPrimary}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerIconButton}
          activeOpacity={0.78}
          accessibilityRole="button"
          accessibilityLabel="Settings"
          onPress={onOpenSettings}
        >
          <Ionicons
            name="settings-outline"
            size={21}
            color={colors.colorTextPrimary}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function SegmentButton({
  icon,
  accessibilityLabel,
  active,
  onPress,
}: {
  icon: "create" | "history";
  accessibilityLabel: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.segmentButton}
      activeOpacity={0.78}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
    >
      <Ionicons
        name={icon === "create" ? "create-outline" : "time-outline"}
        size={20}
        color={active ? colors.colorTextPrimary : colors.colorTextTertiary}
      />
    </TouchableOpacity>
  );
}
