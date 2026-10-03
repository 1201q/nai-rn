import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";

import { getModelCapabilities } from "../../constants/models";
import {
  POSITION_GRID_SIZE,
  gridCoordinate,
  overlappingPositionIndexes,
  positionCellIndex,
} from "../../lib/characterPosition";
import {
  type CharacterPrompt,
  useGenerationStore,
} from "../../store/generationStore";
import { tokens } from "../../styles/tokens";
import { CharacterPositionBoard } from "./CharacterPositionBoard";

const GRID_INDEXES = Array.from(
  { length: POSITION_GRID_SIZE },
  (_, index) => index,
);

// 캐릭터가 이보다 많으면 칩이 그리드를 밀어내지 않도록 번호만 보여준다.
const MAX_CAPTIONED_CHIPS = 6;

type CellCharacter = {
  item: CharacterPrompt;
  index: number;
};

export function CharacterPositionEditor({
  initialCharacterId,
  onFinish,
}: {
  initialCharacterId: string | null;
  onFinish: () => void;
}) {
  const characterPrompts = useGenerationStore(
    (state) => state.characterPrompts,
  );
  const setCharacterPromptPosition = useGenerationStore(
    (state) => state.setCharacterPromptPosition,
  );
  // 공식 웹과 동일: V5는 자유 배치, 그 외는 5x5 그리드.
  const freePlacement = useGenerationStore(
    (state) => getModelCapabilities(state.model).v5Request,
  );
  const [selectedId, setSelectedId] = useState(initialCharacterId);
  const [gridSize, setGridSize] = useState(0);
  const activeCharacter =
    characterPrompts.find((item) => item.id === selectedId) ??
    characterPrompts[0];
  const activeCellIndex = activeCharacter
    ? positionCellIndex(activeCharacter.position)
    : -1;
  const charactersByCell: CellCharacter[][] = Array.from(
    { length: POSITION_GRID_SIZE * POSITION_GRID_SIZE },
    () => [],
  );

  const overlappingIndexes = overlappingPositionIndexes(characterPrompts);

  characterPrompts.forEach((item, index) => {
    charactersByCell[positionCellIndex(item.position)].push({ item, index });
  });

  function selectCell(row: number, column: number) {
    if (!activeCharacter) return;
    setCharacterPromptPosition(
      activeCharacter.id,
      gridCoordinate(column),
      gridCoordinate(row),
    );
    Haptics.selectionAsync().catch(() => {});
  }

  return (
    <View style={styles.section}>
      <View style={styles.chips}>
        {characterPrompts.map((item, index) => {
          const selected = item.id === activeCharacter?.id;
          const name = item.name?.trim();
          const caption =
            characterPrompts.length > MAX_CAPTIONED_CHIPS
              ? ""
              : name || item.prompt.trim().replace(/\s+/g, " ");
          return (
            <Pressable
              key={item.id}
              accessibilityRole="radio"
              accessibilityLabel={`${name || `Character ${index + 1}`} 선택`}
              accessibilityState={{ selected }}
              onPress={() => setSelectedId(item.id)}
              style={({ pressed }) => [
                styles.chip,
                selected && styles.chipSelected,
                !item.enabled && styles.characterDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[styles.chipLabel, selected && styles.chipLabelSelected]}
                numberOfLines={1}
              >
                {caption ? `${index + 1}  ${caption}` : index + 1}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {freePlacement ? (
        <CharacterPositionBoard
          characters={characterPrompts}
          selectedId={activeCharacter?.id}
          onSelect={setSelectedId}
        />
      ) : (
        <View
          style={styles.gridArea}
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            setGridSize(Math.min(width, height));
          }}
        >
          <View style={[styles.grid, { width: gridSize, height: gridSize }]}>
            {GRID_INDEXES.map((row) => (
              <View key={`row-${row}`} style={styles.gridRow}>
                {GRID_INDEXES.map((column) => {
                  const cellIndex = row * POSITION_GRID_SIZE + column;
                  const active = cellIndex === activeCellIndex;
                  const x = gridCoordinate(column);
                  const y = gridCoordinate(row);

                  return (
                    <Pressable
                      key={`cell-${row}-${column}`}
                      accessibilityRole="button"
                      accessibilityLabel={`X ${x.toFixed(1)}, Y ${y.toFixed(1)}`}
                      accessibilityState={{ selected: active }}
                      onPress={() => selectCell(row, column)}
                      style={({ pressed }) => [
                        styles.cell,
                        active && styles.cellActive,
                        pressed && styles.pressed,
                      ]}
                    >
                      {charactersByCell[cellIndex].map(({ item, index }) => {
                        const selected = item.id === activeCharacter?.id;
                        return (
                          <View
                            key={item.id}
                            style={[
                              styles.marker,
                              selected && styles.markerSelected,
                              overlappingIndexes.has(index) &&
                                styles.markerOverlapping,
                              !item.enabled && styles.characterDisabled,
                            ]}
                          >
                            <Text
                              style={[
                                styles.markerText,
                                selected && styles.markerTextSelected,
                              ]}
                            >
                              {index + 1}
                            </Text>
                          </View>
                        );
                      })}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="캐릭터 위치 저장"
          onPress={onFinish}
          style={({ pressed }) => [
            styles.saveButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.saveLabel}>저장</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    flex: 1,
    minHeight: 0,
    gap: tokens.space[5],
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: tokens.space[3],
  },
  chip: {
    maxWidth: 180,
    minWidth: 40,
    height: 36,
    paddingHorizontal: tokens.space[6],
    alignItems: "center",
    justifyContent: "center",
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.color.card,
  },
  chipSelected: {
    backgroundColor: tokens.color.textPrimary,
  },
  chipLabel: {
    color: tokens.color.textSecondary,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type.sm,
  },
  chipLabelSelected: {
    color: tokens.color.app,
  },
  gridArea: {
    flex: 1,
    minHeight: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  grid: {
    gap: tokens.space[3],
  },
  gridRow: {
    flex: 1,
    flexDirection: "row",
    gap: tokens.space[3],
  },
  cell: {
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    alignContent: "center",
    justifyContent: "center",
    gap: tokens.space[1],
    borderWidth: 1,
    borderColor: tokens.color.promptBorder,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.color.sunken,
  },
  cellActive: {
    borderColor: tokens.color.textPrimary,
    backgroundColor: tokens.color.toast,
  },
  marker: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: tokens.color.borderSubtleStrong,
    borderRadius: 12,
    backgroundColor: tokens.color.card,
  },
  markerSelected: {
    borderColor: tokens.color.textPrimary,
    backgroundColor: tokens.color.textPrimary,
  },
  markerOverlapping: {
    borderColor: tokens.color.negative,
  },
  markerText: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type["2xs"],
  },
  markerTextSelected: {
    color: tokens.color.app,
  },
  characterDisabled: {
    opacity: 0.45,
  },
  footer: {
    height: 42,
    marginBottom: tokens.space[4],
    alignItems: "flex-end",
  },
  saveButton: {
    height: 42,
    paddingHorizontal: tokens.space[10],
    alignItems: "center",
    justifyContent: "center",
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.accent,
  },
  saveLabel: {
    color: tokens.color.onAccent,
    fontFamily: tokens.font.bold,
    fontSize: tokens.type.sm,
  },
  pressed: {
    opacity: tokens.opacity.pressed,
  },
});
