import { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";

import {
  type CharacterPrompt,
  useGenerationStore,
} from "../../store/generationStore";
import { tokens } from "../../styles/tokens";
import { CHARACTER_BADGE_COLORS } from "../generation/CharacterCard";

const GRID_SIZE = 5;
const GRID_INDEXES = Array.from({ length: GRID_SIZE }, (_, index) => index);

type CellCharacter = {
  item: CharacterPrompt;
  index: number;
};

function coordinateFor(index: number) {
  return (index + 0.5) / GRID_SIZE;
}

function gridIndexFor(value: number) {
  return Math.max(
    0,
    Math.min(GRID_SIZE - 1, Math.floor(value * GRID_SIZE)),
  );
}

function cellIndexFor(position: CharacterPrompt["position"]) {
  return gridIndexFor(position.y) * GRID_SIZE + gridIndexFor(position.x);
}

function badgeColorFor(index: number) {
  return CHARACTER_BADGE_COLORS[
    index % CHARACTER_BADGE_COLORS.length
  ];
}

export function CharacterPositionSheet({
  characterId,
}: {
  characterId: string;
}) {
  const characterPrompts = useGenerationStore((state) => state.characterPrompts);
  const setCharacterPromptPosition = useGenerationStore(
    (state) => state.setCharacterPromptPosition,
  );
  const activeIndex = characterPrompts.findIndex(
    (character) => character.id === characterId,
  );
  const activeCharacter = characterPrompts[activeIndex];

  const selectCell = useCallback(
    (row: number, column: number) => {
      setCharacterPromptPosition(
        characterId,
        coordinateFor(column),
        coordinateFor(row),
      );
      Haptics.selectionAsync().catch(() => {});
    },
    [characterId, setCharacterPromptPosition],
  );

  if (!activeCharacter) {
    return <Text style={styles.emptyText}>Character not found.</Text>;
  }

  const activeCellIndex = cellIndexFor(activeCharacter.position);
  const activeColor = badgeColorFor(activeIndex);
  const activeName = activeCharacter.name?.trim() || `Character ${activeIndex + 1}`;
  const charactersByCell: CellCharacter[][] = Array.from(
    { length: GRID_SIZE * GRID_SIZE },
    () => [],
  );

  characterPrompts.forEach((item, index) => {
    charactersByCell[cellIndexFor(item.position)].push({ item, index });
  });

  return (
    <View style={styles.content}>
      <View style={styles.characterSummary}>
        <View style={[styles.summaryBadge, { backgroundColor: activeColor }]}>
          <Text style={styles.summaryBadgeText}>{activeIndex + 1}</Text>
        </View>
        <View style={styles.summaryTextGroup}>
          <Text style={styles.summaryTitle} numberOfLines={1}>
            {activeName}
          </Text>
          <Text style={styles.summaryCoordinates}>
            X {activeCharacter.position.x.toFixed(1)} / Y{" "}
            {activeCharacter.position.y.toFixed(1)}
          </Text>
        </View>
      </View>

      <View style={styles.grid}>
        {GRID_INDEXES.map((row) => (
          <View key={`row-${row}`} style={styles.gridRow}>
            {GRID_INDEXES.map((column) => {
              const cellIndex = row * GRID_SIZE + column;
              const cellCharacters = charactersByCell[cellIndex];
              const active = cellIndex === activeCellIndex;
              const x = coordinateFor(column);
              const y = coordinateFor(row);

              return (
                <Pressable
                  key={`cell-${row}-${column}`}
                  accessibilityRole="button"
                  accessibilityLabel={`X ${x.toFixed(1)}, Y ${y.toFixed(1)}`}
                  accessibilityState={{ selected: active }}
                  onPress={() => selectCell(row, column)}
                  style={({ pressed }) => [
                    styles.cell,
                    active && { backgroundColor: activeColor },
                    pressed && styles.cellPressed,
                  ]}
                >
                  <View style={styles.cellCharacters}>
                    {cellCharacters.map(({ item, index }) => {
                      const isActiveCharacter = item.id === characterId;
                      return (
                        <View
                          key={item.id}
                          style={[
                            styles.characterMarker,
                            { backgroundColor: badgeColorFor(index) },
                            isActiveCharacter && styles.activeCharacterMarker,
                            !item.enabled && styles.characterMarkerDisabled,
                          ]}
                        >
                          <Text
                            style={[
                              styles.characterMarkerText,
                              isActiveCharacter &&
                                styles.activeCharacterMarkerText,
                            ]}
                          >
                            {index + 1}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: tokens.space[8],
    paddingHorizontal: tokens.space[2],
  },
  characterSummary: {
    minHeight: 48,
    paddingHorizontal: tokens.space[4],
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space[6],
  },
  summaryBadge: {
    width: 32,
    height: 32,
    borderRadius: tokens.radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryBadgeText: {
    color: tokens.color.onAccent,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type.sm,
  },
  summaryTextGroup: {
    flex: 1,
    minWidth: 0,
    gap: tokens.space[1],
  },
  summaryTitle: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type.base,
  },
  summaryCoordinates: {
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.regular,
    fontSize: tokens.type.xs,
  },
  grid: {
    width: "100%",
    aspectRatio: 1,
    gap: tokens.space[5],
  },
  gridRow: {
    flex: 1,
    flexDirection: "row",
    gap: tokens.space[5],
  },
  cell: {
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    borderRadius: tokens.radius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.raised,
  },
  cellPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.97 }],
  },
  cellCharacters: {
    padding: tokens.space[2],
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.space[1],
  },
  characterMarker: {
    width: 20,
    height: 20,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  activeCharacterMarker: {
    width: 26,
    height: 26,
    backgroundColor: "transparent",
  },
  characterMarkerDisabled: {
    opacity: 0.45,
  },
  characterMarkerText: {
    color: tokens.color.onAccent,
    fontFamily: tokens.font.semibold,
    fontSize: 10,
    lineHeight: 12,
  },
  activeCharacterMarkerText: {
    fontSize: tokens.type.sm,
    lineHeight: 18,
  },
  emptyText: {
    paddingHorizontal: tokens.space[8],
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.regular,
    fontSize: tokens.type.sm,
  },
});
