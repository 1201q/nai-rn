import { memo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import {
  useSuggestionBarActions,
  useSuggestionBarActive,
  useSuggestions,
} from "../../context/SuggestionBarContext";
import type { TagSuggestion, TagType } from "../../lib/tagDb";
import { tokens } from "../../styles/tokens";

const TAG_TYPE_COLORS: Record<TagType, string> = {
  general: tokens.color.accent,
  artist: tokens.color.badge2,
  character: tokens.color.badge3,
  copyright: tokens.color.badge4,
};

const SuggestionChip = memo(function SuggestionChip({
  item,
  onPress,
}: {
  item: TagSuggestion;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.label}, ${item.type}`}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
    >
      <View
        style={[styles.typeDot, { backgroundColor: TAG_TYPE_COLORS[item.type] }]}
      />
      <Text style={styles.chipText} numberOfLines={1}>
        {item.label}
      </Text>
    </Pressable>
  );
});

export function RendraSuggestionBar() {
  const suggestions = useSuggestions();
  const active = useSuggestionBarActive();
  const actions = useSuggestionBarActions();

  if (!active || !actions) return null;

  return (
    <View style={styles.container}>
      {suggestions.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          contentContainerStyle={styles.scrollContent}
        >
          {suggestions.map((item) => (
            <SuggestionChip
              key={`${item.type}:${item.value}`}
              item={item}
              onPress={() => actions.pickRef.current?.(item)}
            />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 57,
    paddingVertical: tokens.space[5],
    borderTopWidth: 1,
    borderTopColor: tokens.color.borderSubtle,
    backgroundColor: tokens.color.app,
  },
  scrollContent: {
    paddingHorizontal: tokens.space[8],
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space[4],
  },
  chip: {
    height: 36,
    maxWidth: 200,
    paddingHorizontal: tokens.space[6],
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space[3],
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    backgroundColor: tokens.color.raised,
  },
  chipPressed: {
    opacity: 0.68,
    transform: [{ scale: 0.98 }],
  },
  typeDot: {
    width: 7,
    height: 7,
    borderRadius: tokens.radius.pill,
  },
  chipText: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.medium,
    fontSize: tokens.type.sm,
  },
});
