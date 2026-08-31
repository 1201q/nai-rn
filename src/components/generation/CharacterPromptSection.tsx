import { memo, useCallback, useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { MAX_CHARACTER_PROMPTS } from "../../constants/generation";
import { useAppSheet } from "../../context/AppSheetContext";
import {
  type CharacterPrompt,
  useGenerationStore,
} from "../../store/generationStore";
import { tokens } from "../../styles/tokens";
import { CharacterPromptEditorCard } from "./CharacterPromptEditorCard";

function createCharacterPrompt(index: number): CharacterPrompt {
  return {
    id: `character-${Date.now()}-${index}`,
    prompt: "",
    negativePrompt: "",
    enabled: true,
    position: { x: 0.5, y: 0.5 },
  };
}

export const CharacterPromptSection = memo(function CharacterPromptSection({
  active,
  editingCharacterId,
  onEditingCharacterChange,
}: {
  active: boolean;
  editingCharacterId: string | null;
  onEditingCharacterChange: (id: string | null) => void;
}) {
  const { openCharacterPosition } = useAppSheet();
  const characterPrompts = useGenerationStore(
    (state) => state.characterPrompts,
  );
  const setCharacterPrompts = useGenerationStore(
    (state) => state.setCharacterPrompts,
  );
  const expandedIds = useGenerationStore(
    (state) => state.characterPromptExpandedIds,
  );
  const setExpandedIds = useGenerationStore(
    (state) => state.setCharacterPromptExpandedIds,
  );
  const positionEnabled = useGenerationStore(
    (state) => state.characterPositionEnabled,
  );
  const setPositionEnabled = useGenerationStore(
    (state) => state.setCharacterPositionEnabled,
  );

  useEffect(() => {
    const validIds = new Set(characterPrompts.map((item) => item.id));
    const validExpandedIds = expandedIds.filter(
      (id, index) => validIds.has(id) && expandedIds.indexOf(id) === index,
    );
    const nextIds = validExpandedIds;
    if (
      nextIds.length !== expandedIds.length ||
      nextIds.some((id, index) => id !== expandedIds[index])
    ) {
      setExpandedIds(nextIds);
    }
  }, [characterPrompts, expandedIds, setExpandedIds]);

  useEffect(() => {
    if (!active && editingCharacterId !== null) {
      onEditingCharacterChange(null);
    }
  }, [active, editingCharacterId, onEditingCharacterChange]);

  const updateCharacter = useCallback(
    (id: string, values: Partial<Omit<CharacterPrompt, "id">>) => {
      const current = useGenerationStore.getState().characterPrompts;
      setCharacterPrompts(
        current.map((item) => (item.id === id ? { ...item, ...values } : item)),
      );
    },
    [setCharacterPrompts],
  );

  const addCharacter = useCallback(() => {
    const state = useGenerationStore.getState();
    if (state.characterPrompts.length >= MAX_CHARACTER_PROMPTS) return;
    const character = createCharacterPrompt(state.characterPrompts.length);
    state.setCharacterPrompts([...state.characterPrompts, character]);
    state.setCharacterPromptExpandedIds([
      ...state.characterPromptExpandedIds,
      character.id,
    ]);
  }, []);

  const toggleExpanded = useCallback(
    (id: string) => {
      const current = useGenerationStore.getState().characterPromptExpandedIds;
      const next = current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id];
      setExpandedIds(next);
      if (current.includes(id) && editingCharacterId === id) {
        onEditingCharacterChange(null);
      }
    },
    [editingCharacterId, onEditingCharacterChange, setExpandedIds],
  );

  const moveCharacter = useCallback(
    (id: string, direction: -1 | 1) => {
      const current = useGenerationStore.getState().characterPrompts;
      const sourceIndex = current.findIndex((item) => item.id === id);
      const targetIndex = sourceIndex + direction;
      if (
        sourceIndex < 0 ||
        targetIndex < 0 ||
        targetIndex >= current.length
      ) {
        return;
      }
      const next = [...current];
      [next[sourceIndex], next[targetIndex]] = [
        next[targetIndex],
        next[sourceIndex],
      ];
      setCharacterPrompts(next);
    },
    [setCharacterPrompts],
  );

  const deleteCharacter = useCallback(
    (id: string) => {
      const state = useGenerationStore.getState();
      state.setCharacterPrompts(
        state.characterPrompts.filter((item) => item.id !== id),
      );
      state.setCharacterPromptExpandedIds(
        state.characterPromptExpandedIds.filter((value) => value !== id),
      );
      if (editingCharacterId === id) onEditingCharacterChange(null);
    },
    [editingCharacterId, onEditingCharacterChange],
  );

  const openPosition = useCallback(
    (id: string) => {
      setPositionEnabled(true);
      openCharacterPosition(id);
    },
    [openCharacterPosition, setPositionEnabled],
  );

  const canAdd = characterPrompts.length < MAX_CHARACTER_PROMPTS;

  return (
    <View style={styles.section}>
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleGroup}>
            <Text style={styles.sectionTitle}>
              {`Character Prompts (${characterPrompts.length}/${MAX_CHARACTER_PROMPTS})`}
            </Text>
            <Text style={styles.sectionDescription}>
              장면 속 캐릭터별로 프롬프트를 지정합니다.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`캐릭터 프롬프트 추가, ${characterPrompts.length} / ${MAX_CHARACTER_PROMPTS}`}
            accessibilityState={{ disabled: !canAdd }}
            disabled={!canAdd}
            onPress={addCharacter}
            style={({ pressed }) => [
              styles.addButton,
              !canAdd && styles.addButtonDisabled,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name="add"
              size={20}
              color={tokens.color.textPrimary}
            />
          </Pressable>
        </View>

        <View style={styles.positionRow}>
          <Text style={styles.positionLabel}>Position</Text>
          <View style={styles.positionControl}>
            <Pressable
              accessibilityRole="radio"
              accessibilityLabel="AI's Choice"
              accessibilityState={{ selected: !positionEnabled }}
              onPress={() => setPositionEnabled(false)}
              style={({ pressed }) => [
                styles.positionOption,
                !positionEnabled && styles.positionOptionActive,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.positionOptionLabel,
                  !positionEnabled && styles.positionOptionLabelActive,
                ]}
              >
                AI&apos;s Choice
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="radio"
              accessibilityLabel="Custom position"
              accessibilityState={{ selected: positionEnabled }}
              onPress={() => setPositionEnabled(true)}
              style={({ pressed }) => [
                styles.positionOption,
                positionEnabled && styles.positionOptionActive,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.positionOptionLabel,
                  positionEnabled && styles.positionOptionLabelActive,
                ]}
              >
                Custom
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {characterPrompts.map((item, index) => (
        <CharacterPromptEditorCard
          key={item.id}
          item={item}
          index={index}
          active={active}
          expanded={
            expandedIds.includes(item.id) || editingCharacterId === item.id
          }
          persistentlyExpanded={expandedIds.includes(item.id)}
          positionEnabled={positionEnabled}
          canMoveDown={index < characterPrompts.length - 1}
          onToggleExpanded={toggleExpanded}
          onBeginEditing={onEditingCharacterChange}
          onUpdate={updateCharacter}
          onMove={moveCharacter}
          onDelete={deleteCharacter}
          onOpenPosition={openPosition}
        />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  section: {
    gap: 12,
  },
  sectionCard: {
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: tokens.color.promptBorder,
    borderRadius: 20,
    backgroundColor: tokens.color.card,
  },
  sectionHeader: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  sectionTitleGroup: {
    minWidth: 0,
    flex: 1,
  },
  sectionTitle: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: 17,
    letterSpacing: -0.2,
  },
  sectionDescription: {
    marginTop: 4,
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.regular,
    fontSize: 13,
    lineHeight: 19,
  },
  addButton: {
    width: 42,
    height: 42,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: tokens.color.raised,
  },
  addButtonDisabled: {
    opacity: 0.4,
  },
  positionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  positionLabel: {
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.medium,
    fontSize: 14,
  },
  positionControl: {
    height: 42,
    padding: 4,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 12,
    backgroundColor: tokens.color.sunken,
  },
  positionOption: {
    height: 34,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
  },
  positionOptionActive: {
    backgroundColor: tokens.color.toast,
  },
  positionOptionLabel: {
    color: tokens.color.textMuted,
    fontFamily: tokens.font.semibold,
    fontSize: 13,
  },
  positionOptionLabelActive: {
    color: tokens.color.textPrimary,
  },
  pressed: {
    opacity: 0.65,
  },
});
