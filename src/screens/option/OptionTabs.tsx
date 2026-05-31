import { useState } from "react";
import {
  ActivityIndicator,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import type { CharacterPrompt } from "../../context/GenerationOptionsContext";
import type { OptionScreenNavigationProp } from "../../navigation/types";
import { colors } from "../../styles/colors";
import { triggerSelectionHaptic } from "./helpers";
import { styles } from "./styles";

const MAX_CHARACTER_PROMPTS = 6;

export const BADGE_COLORS = [
  colors.green500,
  colors.red500,
  colors.blue500,
  colors.orange500,
  colors.purple500,
  colors.teal500,
];

export const optionTabRoutes = [
  { key: "base", title: "Base" },
  { key: "character", title: "Character" },
];

function LabeledPromptInput({
  label,
  negative,
  tall,
  value,
  onChangeText,
}: {
  label: string;
  negative?: boolean;
  tall?: boolean;
  value: string;
  onChangeText: (v: string) => void;
}) {
  return (
    <View style={styles.labeledInput}>
      <Text style={[styles.inputLabel, negative && styles.negativeLabel]}>
        {label}
      </Text>
      <View style={styles.textAreaWrap}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          multiline
          textAlignVertical="top"
          placeholderTextColor={colors.colorTextTertiary}
          style={[styles.textArea, tall && styles.tallTextArea]}
        />
        <Text style={styles.countText}>{value.length}/1000</Text>
      </View>
    </View>
  );
}

function CharacterPromptCard({
  item,
  index,
  expanded,
  onToggleExpand,
  onUpdate,
}: {
  item: CharacterPrompt;
  index: number;
  expanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (values: Partial<Omit<CharacterPrompt, "id">>) => void;
}) {
  const badgeColor = BADGE_COLORS[index % BADGE_COLORS.length];
  const title = item.prompt.trim() || `Character ${index + 1}`;

  return (
    <View
      style={[
        styles.characterCard,
        !item.enabled && styles.characterPromptGroupDisabled,
      ]}
    >
      <View style={styles.characterCardHeader}>
        <TouchableOpacity
          style={styles.characterCardHeaderMain}
          activeOpacity={0.78}
          onPress={onToggleExpand}
        >
          <View style={styles.characterAvatar}>
            <Ionicons
              name="person-outline"
              size={20}
              color={colors.colorTextSecondary}
            />
          </View>
          <View style={[styles.characterBadge, { backgroundColor: badgeColor }]}>
            <Text style={styles.characterBadgeText}>{index + 1}</Text>
          </View>
          <Text style={styles.characterCardTitle} numberOfLines={1}>
            {title}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.characterHeaderIcon}
          activeOpacity={0.78}
          onPress={() => {
            onUpdate({ enabled: !item.enabled });
            triggerSelectionHaptic();
          }}
        >
          <Ionicons
            name={item.enabled ? "eye-outline" : "eye-off-outline"}
            size={22}
            color={
              item.enabled ? colors.colorTextPrimary : colors.colorTextTertiary
            }
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.characterHeaderIcon}
          activeOpacity={0.78}
          onPress={onToggleExpand}
        >
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={20}
            color={colors.colorTextTertiary}
          />
        </TouchableOpacity>
      </View>
      {expanded ? (
        <View style={styles.characterCardBody}>
          <LabeledPromptInput
            label="프롬프트"
            value={item.prompt}
            onChangeText={(next) => onUpdate({ prompt: next })}
          />
          <LabeledPromptInput
            label="네거티브"
            negative
            value={item.negativePrompt}
            onChangeText={(next) => onUpdate({ negativePrompt: next })}
          />
        </View>
      ) : null}
    </View>
  );
}

export function OptionTabScene({
  route,
  hasLoadedOptions,
  prompt,
  setPrompt,
  negativePrompt,
  setNegativePrompt,
  characterPrompts,
  setCharacterPrompts,
}: {
  route: { key: string };
  hasLoadedOptions: boolean;
  prompt: string;
  setPrompt: (v: string) => void;
  negativePrompt: string;
  setNegativePrompt: (v: string) => void;
  characterPrompts: CharacterPrompt[];
  setCharacterPrompts: (v: CharacterPrompt[]) => void;
}) {
  const navigation = useNavigation<OptionScreenNavigationProp>();
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  function toggleExpand(id: string) {
    setExpandedIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }

  function addCharacterPrompt() {
    if (characterPrompts.length >= MAX_CHARACTER_PROMPTS) {
      return;
    }

    const id = `character-${Date.now()}-${characterPrompts.length}`;
    setCharacterPrompts([
      ...characterPrompts,
      { id, prompt: "", negativePrompt: "", enabled: true },
    ]);
    setExpandedIds((current) => [...current, id]);
    triggerSelectionHaptic();
  }

  function updateCharacterPrompt(
    id: string,
    nextValues: Partial<Omit<CharacterPrompt, "id">>,
  ) {
    setCharacterPrompts(
      characterPrompts.map((item) =>
        item.id === id ? { ...item, ...nextValues } : item,
      ),
    );
  }

  if (!hasLoadedOptions) {
    return (
      <View style={styles.loadingOptions}>
        <ActivityIndicator color={colors.colorTextPrimary} />
      </View>
    );
  }

  if (route.key === "base") {
    return (
      <KeyboardAwareScrollView
        bottomOffset={16}
        contentContainerStyle={styles.tabContent}
        keyboardShouldPersistTaps="handled"
      >
        <LabeledPromptInput
          label="Base"
          tall
          value={prompt}
          onChangeText={setPrompt}
        />
        <LabeledPromptInput
          label="Negative"
          negative
          value={negativePrompt}
          onChangeText={setNegativePrompt}
        />
      </KeyboardAwareScrollView>
    );
  }

  const canAddCharacterPrompt = characterPrompts.length < MAX_CHARACTER_PROMPTS;

  return (
    <KeyboardAwareScrollView
      bottomOffset={16}
      contentContainerStyle={styles.tabContent}
      keyboardShouldPersistTaps="handled"
    >
      {characterPrompts.length > 0 ? (
        <View style={styles.editEntryRow}>
          <Text style={styles.editEntryCount}>
            캐릭터 ({characterPrompts.length})
          </Text>
          <TouchableOpacity
            style={styles.editEntryButton}
            activeOpacity={0.78}
            onPress={() => navigation.navigate("CharacterEdit")}
          >
            <Ionicons
              name="create-outline"
              size={16}
              color={colors.colorTextSecondary}
            />
            <Text style={styles.editEntryText}>편집</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {characterPrompts.map((item, index) => (
        <CharacterPromptCard
          key={item.id}
          item={item}
          index={index}
          expanded={expandedIds.includes(item.id)}
          onToggleExpand={() => toggleExpand(item.id)}
          onUpdate={(values) => updateCharacterPrompt(item.id, values)}
        />
      ))}
      <TouchableOpacity
        style={[
          styles.addCharacterButton,
          !canAddCharacterPrompt && styles.disabledButton,
        ]}
        activeOpacity={0.78}
        disabled={!canAddCharacterPrompt}
        onPress={addCharacterPrompt}
      >
        <Ionicons name="add" size={18} color={colors.colorTextPrimary} />
        <Text style={styles.addCharacterText}>
          Add Character ({characterPrompts.length}/{MAX_CHARACTER_PROMPTS})
        </Text>
      </TouchableOpacity>
    </KeyboardAwareScrollView>
  );
}
