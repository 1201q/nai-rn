import { useEffect, useRef } from "react";
import { Animated, TouchableOpacity, View } from "react-native";

import { MAIN_SEGMENT_BUTTON_WIDTH, styles } from "./styles";

export type MainPageIndex = 0 | 1;

export function MainScreenHeader({
  activeIndex,
  onSelect,
}: {
  activeIndex: MainPageIndex;
  onSelect: (index: MainPageIndex) => void;
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
      <View style={styles.headerSide} />
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
      {icon === "create" ? <CreateIcon active={active} /> : null}
      {icon === "history" ? <HistoryIcon active={active} /> : null}
    </TouchableOpacity>
  );
}

function CreateIcon({ active }: { active: boolean }) {
  return (
    <View style={styles.createIcon}>
      <View
        style={[
          styles.createIconBody,
          active && styles.segmentIconActive,
        ]}
      />
      <View
        style={[
          styles.createIconTip,
          active && styles.segmentIconActive,
        ]}
      />
    </View>
  );
}

function HistoryIcon({ active }: { active: boolean }) {
  return (
    <View style={[styles.historyIcon, active && styles.historyIconActive]}>
      <View
        style={[
          styles.historyIconHourHand,
          active && styles.segmentIconActive,
        ]}
      />
      <View
        style={[
          styles.historyIconMinuteHand,
          active && styles.segmentIconActive,
        ]}
      />
    </View>
  );
}
