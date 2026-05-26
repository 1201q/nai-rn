import { Text, TouchableOpacity, View } from "react-native";

import { styles } from "./styles";

export type MainPageIndex = 0 | 1;

export function MainScreenHeader({
  activeIndex,
  onSelect,
}: {
  activeIndex: MainPageIndex;
  onSelect: (index: MainPageIndex) => void;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerSide} />
      <View style={styles.segmentedControl}>
        <SegmentButton
          label="Create"
          active={activeIndex === 0}
          onPress={() => onSelect(0)}
        />
        <SegmentButton
          label="History"
          active={activeIndex === 1}
          onPress={() => onSelect(1)}
        />
      </View>
      <View style={styles.headerSide} />
    </View>
  );
}

function SegmentButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.segmentButton, active && styles.segmentButtonActive]}
      activeOpacity={0.78}
      onPress={onPress}
    >
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}
