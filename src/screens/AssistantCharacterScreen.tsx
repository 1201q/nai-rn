import { useRef, useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import {
  KeyboardAwareScrollView,
  KeyboardStickyView,
} from "react-native-keyboard-controller";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";

import {
  type CharacterPrompt,
  useGenerationOptions,
} from "../context/GenerationOptionsContext";
import type { AssistantCharacterScreenNavigationProp } from "../navigation/types";
import { SuggestionBarProvider } from "../context/SuggestionBarContext";
import { usePromptAutocomplete } from "../hooks/usePromptAutocomplete";
import { triggerSelectionHaptic } from "./option/helpers";
import { BADGE_COLORS } from "./option/OptionTabs";
import { StickyAssistantSuggestionBar } from "./assistant/SuggestionBar";
import { light } from "./assistant/styles";

const MAX_CHARACTER_PROMPTS = 6;
const CHARACTER_LAYOUT = LinearTransition.duration(220);
const CHARACTER_BODY_ENTERING = FadeIn.duration(140);
const CHARACTER_BODY_EXITING = FadeOut.duration(100);

function LabeledPromptInput({
  label,
  negative,
  value,
  onChangeText,
}: {
  label: string;
  negative?: boolean;
  value: string;
  onChangeText: (v: string) => void;
}) {
  const inputRef = useRef<TextInput>(null);
  const autocomplete = usePromptAutocomplete({ value, onChangeText, inputRef });

  return (
    <View style={styles.labeledInput}>
      <Text style={[styles.inputLabel, negative && styles.negativeLabel]}>
        {label}
      </Text>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={autocomplete.handleChangeText}
        selection={autocomplete.selection}
        onSelectionChange={autocomplete.handleSelectionChange}
        onBlur={autocomplete.clearSuggestions}
        multiline
        textAlignVertical="top"
        placeholderTextColor={light.textHint}
        style={styles.textArea}
      />
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
    <Animated.View
      layout={CHARACTER_LAYOUT}
      style={[styles.characterCard, !item.enabled && styles.characterCardDisabled]}
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
              color={light.textSecondary}
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
            color={item.enabled ? light.textPrimary : light.textHint}
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
            color={light.textHint}
          />
        </TouchableOpacity>
      </View>
      {expanded ? (
        <Animated.View
          entering={CHARACTER_BODY_ENTERING}
          exiting={CHARACTER_BODY_EXITING}
          layout={CHARACTER_LAYOUT}
          style={styles.characterCardBody}
        >
          <LabeledPromptInput
            label="Base"
            value={item.prompt}
            onChangeText={(next) => onUpdate({ prompt: next })}
          />
          <LabeledPromptInput
            label="Negative"
            negative
            value={item.negativePrompt}
            onChangeText={(next) => onUpdate({ negativePrompt: next })}
          />
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

export function AssistantCharacterScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<AssistantCharacterScreenNavigationProp>();
  const { characterPrompts, setCharacterPrompts } = useGenerationOptions();
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

  const canAddCharacterPrompt = characterPrompts.length < MAX_CHARACTER_PROMPTS;

  return (
    <SuggestionBarProvider>
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerCircleButton}
          activeOpacity={0.78}
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={22} color={light.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Character</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAwareScrollView
        bottomOffset={72}
        contentContainerStyle={styles.scrollContent}
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
              onPress={() => navigation.navigate("AssistantCharacterEdit")}
            >
              <Ionicons
                name="create-outline"
                size={16}
                color={light.textSecondary}
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

        <Animated.View layout={CHARACTER_LAYOUT}>
          <TouchableOpacity
            style={[
              styles.addCharacterButton,
              !canAddCharacterPrompt && styles.addCharacterButtonDisabled,
            ]}
            activeOpacity={0.78}
            disabled={!canAddCharacterPrompt}
            onPress={addCharacterPrompt}
          >
            <Ionicons name="add" size={18} color={light.textPrimary} />
            <Text style={styles.addCharacterText}>
              Add Character ({characterPrompts.length}/{MAX_CHARACTER_PROMPTS})
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAwareScrollView>

      <KeyboardStickyView
        style={styles.suggestionSticky}
        offset={{ closed: 0, opened: 0 }}
      >
        <StickyAssistantSuggestionBar />
      </KeyboardStickyView>
    </View>
    </SuggestionBarProvider>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: light.bg,
  },
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  headerCircleButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: light.surface,
  },
  headerTitle: {
    fontFamily: "serif",
    fontSize: 20,
    fontWeight: "600",
    color: light.textPrimary,
  },
  headerSpacer: {
    width: 44,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 12,
  },
  editEntryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  editEntryCount: {
    fontSize: 14,
    fontWeight: "600",
    color: light.textSecondary,
  },
  editEntryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: light.border,
    backgroundColor: light.bg,
  },
  editEntryText: {
    fontSize: 13,
    fontWeight: "500",
    color: light.textSecondary,
  },
  characterCard: {
    borderRadius: 16,
    backgroundColor: light.surface,
    overflow: "hidden",
  },
  characterCardDisabled: {
    opacity: 0.5,
  },
  characterCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 12,
    paddingRight: 6,
    height: 56,
  },
  characterCardHeaderMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  characterAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: light.surfaceAlt,
  },
  characterBadge: {
    minWidth: 24,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 7,
    paddingHorizontal: 6,
  },
  characterBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
  },
  characterCardTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: light.textPrimary,
  },
  characterHeaderIcon: {
    width: 40,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  characterCardBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 12,
  },
  labeledInput: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: light.textSecondary,
  },
  negativeLabel: {
    color: light.accent,
  },
  textArea: {
    minHeight: 88,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: light.border,
    backgroundColor: light.bg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: light.textPrimary,
  },
  addCharacterButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: light.border,
    backgroundColor: light.surface,
  },
  addCharacterButtonDisabled: {
    opacity: 0.5,
  },
  addCharacterText: {
    fontSize: 14,
    fontWeight: "600",
    color: light.textPrimary,
  },
  suggestionSticky: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    elevation: 20,
  },
});
