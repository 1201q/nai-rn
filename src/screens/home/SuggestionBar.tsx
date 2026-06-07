import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRef } from "react";

import {
  useSuggestionBarActions,
  useSuggestions,
} from "../../context/SuggestionBarContext";
import type { TagSuggestion, TagType } from "../../lib/tagDb";
import { colors } from "../../styles/colors";
import { light } from "./styles";

const TAG_TYPE_COLORS: Record<TagType, string> = {
  general: colors.blue500,
  artist: colors.orange500,
  character: colors.green500,
  copyright: colors.purple500,
};

function SuggestionChip({
  item,
  onPress,
}: {
  item: TagSuggestion;
  onPress: () => void;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  const onPressIn = () =>
    Animated.spring(anim, {
      toValue: 1,
      useNativeDriver: false,
      speed: 60,
      bounciness: 0,
    }).start();

  const onPressOut = () =>
    Animated.spring(anim, {
      toValue: 0,
      useNativeDriver: false,
      speed: 30,
      bounciness: 0,
    }).start();

  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.93] });
  const backgroundColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [light.surface, light.surfaceAlt],
  });

  return (
    <Pressable onPressIn={onPressIn} onPressOut={onPressOut} onPress={onPress}>
      <Animated.View style={[barStyles.chip, { transform: [{ scale }], backgroundColor }]}>
        <View style={[barStyles.dot, { backgroundColor: TAG_TYPE_COLORS[item.type] }]} />
        <Text style={barStyles.chipText} numberOfLines={1}>
          {item.label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

// MainScreen 칩 디자인에 맞춘 태그 추천 바. 데이터는 SuggestionBarProvider 에서.
export function SuggestionBar() {
  const suggestions = useSuggestions();
  const actions = useSuggestionBarActions();

  if (!suggestions.length || !actions) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={barStyles.scroll}
      keyboardShouldPersistTaps="always"
    >
      {suggestions.map((item, i) => (
        <SuggestionChip
          key={`${item.label}-${i}`}
          item={item}
          onPress={() => actions.pickRef.current?.(item)}
        />
      ))}
    </ScrollView>
  );
}

// 키보드 위 sticky 배치용(캐릭터 화면). 추천 없으면 줄째로 사라짐.
export function StickySuggestionBar() {
  const suggestions = useSuggestions();
  if (!suggestions.length) return null;
  return (
    <View style={barStyles.stickyContainer}>
      <SuggestionBar />
    </View>
  );
}

const barStyles = StyleSheet.create({
  stickyContainer: {
    paddingVertical: 10,
    backgroundColor: light.bg,
    borderTopWidth: 1,
    borderTopColor: light.border,
  },
  scroll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: light.surface,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chipText: {
    fontSize: 14,
    color: light.textPrimary,
    maxWidth: 180,
  },
});
