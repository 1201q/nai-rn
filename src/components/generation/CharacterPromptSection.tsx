import { memo, useCallback, useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { getModelCapabilities } from "../../constants/models";
import {
  hasOverlappingPositions,
  nextCharacterPosition,
} from "../../lib/characterPosition";
import {
  type CharacterPrompt,
  useGenerationStore,
} from "../../store/generationStore";
import { tokens } from "../../styles/tokens";
import { CharacterPromptEditorCard } from "./CharacterPromptEditorCard";

function createCharacterPrompt(
  index: number,
  position: CharacterPrompt["position"],
): CharacterPrompt {
  return {
    id: `character-${Date.now()}-${index}`,
    prompt: "",
    negativePrompt: "",
    enabled: true,
    position,
  };
}

export const CharacterPromptSection = memo(function CharacterPromptSection({
  active,
  editingCharacterId,
  onEditingCharacterChange,
  onEditPositions,
}: {
  active: boolean;
  editingCharacterId: string | null;
  onEditingCharacterChange: (id: string | null) => void;
  onEditPositions: (characterId: string | null) => void;
}) {
  const characterPrompts = useGenerationStore(
    (state) => state.characterPrompts,
  );
  const maxCharacters = useGenerationStore(
    (state) => getModelCapabilities(state.model).maxCharacters,
  );
  const minPositionCharacters = useGenerationStore(
    (state) => getModelCapabilities(state.model).minPositionCharacters,
  );
  const freePlacement = useGenerationStore(
    (state) => getModelCapabilities(state.model).v5Request,
  );
  const ucLocked = useGenerationStore(
    (state) => getModelCapabilities(state.model).fixedSettings !== undefined,
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
    if (
      state.characterPrompts.length >=
      getModelCapabilities(state.model).maxCharacters
    ) {
      return;
    }
    const character = createCharacterPrompt(
      state.characterPrompts.length,
      nextCharacterPosition(state.characterPrompts),
    );
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
      if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= current.length) {
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
    (id: string | null) => {
      setPositionEnabled(true);
      onEditPositions(id);
    },
    [onEditPositions, setPositionEnabled],
  );

  const canAdd = characterPrompts.length < maxCharacters;
  const activeCount = characterPrompts.filter(
    (item) => item.enabled && item.prompt.trim(),
  ).length;
  const canPosition = characterPrompts.length >= minPositionCharacters;
  const customPosition = positionEnabled && canPosition;
  const positionsOverlap =
    customPosition && hasOverlappingPositions(characterPrompts, freePlacement);

  return (
    <View style={styles.section}>
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleGroup}>
            <Text style={styles.sectionTitle}>
              {`Character Prompts (${characterPrompts.length}/${maxCharacters})`}
            </Text>
            <Text style={styles.sectionDescription}>
              장면 속 캐릭터별로 프롬프트를 지정합니다.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`캐릭터 프롬프트 추가, ${characterPrompts.length} / ${maxCharacters}`}
            accessibilityState={{ disabled: !canAdd }}
            disabled={!canAdd}
            onPress={addCharacter}
            style={({ pressed }) => [
              styles.addButton,
              !canAdd && styles.addButtonDisabled,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="add" size={20} color={tokens.color.textPrimary} />
          </Pressable>
        </View>

        <View style={styles.positionRow}>
          <Text style={styles.positionLabel}>Position</Text>
          <View style={styles.positionControl}>
            <Pressable
              accessibilityRole="radio"
              accessibilityLabel="AI's Choice"
              accessibilityState={{ selected: !customPosition }}
              onPress={() => setPositionEnabled(false)}
              style={({ pressed }) => [
                styles.positionOption,
                !customPosition && styles.positionOptionActive,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.positionOptionLabel,
                  !customPosition && styles.positionOptionLabelActive,
                ]}
              >
                AI&apos;s Choice
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="radio"
              accessibilityLabel="Custom position"
              accessibilityState={{
                selected: customPosition,
                disabled: !canPosition,
              }}
              disabled={!canPosition}
              onPress={() => setPositionEnabled(true)}
              style={({ pressed }) => [
                styles.positionOption,
                customPosition && styles.positionOptionActive,
                !canPosition && styles.positionDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.positionOptionLabel,
                  customPosition && styles.positionOptionLabelActive,
                ]}
              >
                Custom
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="캐릭터 위치 편집"
              accessibilityState={{ disabled: !canPosition }}
              disabled={!canPosition}
              onPress={() => openPosition(null)}
              style={({ pressed }) => [
                styles.positionEditButton,
                customPosition && styles.positionOptionActive,
                !canPosition && styles.positionDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name="grid-outline"
                size={16}
                color={
                  customPosition
                    ? tokens.color.textPrimary
                    : tokens.color.textMuted
                }
              />
            </Pressable>
          </View>
        </View>
        {activeCount > maxCharacters ? (
          <Text style={styles.positionWarning}>
            {`현재 모델은 캐릭터를 ${maxCharacters}명까지 지원합니다. 앞에서부터 ${maxCharacters}명만 전송됩니다.`}
          </Text>
        ) : null}
        {positionsOverlap ? (
          <Text style={styles.positionWarning}>
            캐릭터 위치가 겹치면 결과 품질이 떨어질 수 있습니다. 위치를
            조정하거나 AI&apos;s Choice를 사용하세요.
          </Text>
        ) : null}
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
          positionEnabled={customPosition}
          canEditPosition={canPosition}
          canMoveDown={index < characterPrompts.length - 1}
          ucLocked={ucLocked}
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
  positionEditButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
  },
  positionDisabled: {
    opacity: 0.4,
  },
  positionWarning: {
    color: tokens.color.negative,
    fontFamily: tokens.font.regular,
    fontSize: 13,
    lineHeight: 19,
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
    opacity: tokens.opacity.pressed,
  },
});
