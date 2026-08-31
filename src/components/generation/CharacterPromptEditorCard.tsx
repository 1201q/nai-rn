import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextLayoutEventData,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { usePromptAutocomplete } from "../../hooks/usePromptAutocomplete";
import type { CharacterPrompt } from "../../store/generationStore";
import { tokens } from "../../styles/tokens";
import {
  PromptHighlightTextInput,
  type PromptHighlightTextInputHandle,
} from "../forms/PromptHighlightTextInput";
import { PromptTokenCounter } from "../forms/PromptTokenCounter";

type CharacterPromptMode = "base" | "negative";

const EDITOR_MIN_HEIGHT = 72;
const PROMPT_LINE_HEIGHT = 23;
const CHARACTER_BADGE_COLORS = [
  tokens.color.badge1,
  tokens.color.badge2,
  tokens.color.badge3,
  tokens.color.badge4,
] as const;

function IconAction({
  accessibilityLabel,
  icon,
  disabled = false,
  destructive = false,
  onPress,
}: {
  accessibilityLabel: string;
  icon: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  destructive?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        disabled && styles.actionButtonDisabled,
        pressed && styles.pressed,
      ]}
    >
      <Ionicons
        name={icon}
        size={16}
        color={
          destructive ? tokens.color.negative : tokens.color.textTertiary
        }
      />
    </Pressable>
  );
}

export const CharacterPromptEditorCard = memo(
  function CharacterPromptEditorCard({
    item,
    index,
    active,
    expanded,
    persistentlyExpanded,
    positionEnabled,
    canMoveDown,
    onToggleExpanded,
    onBeginEditing,
    onUpdate,
    onMove,
    onDelete,
    onOpenPosition,
  }: {
    item: CharacterPrompt;
    index: number;
    active: boolean;
    expanded: boolean;
    persistentlyExpanded: boolean;
    positionEnabled: boolean;
    canMoveDown: boolean;
    onToggleExpanded: (id: string) => void;
    onBeginEditing: (id: string) => void;
    onUpdate: (
      id: string,
      values: Partial<Omit<CharacterPrompt, "id">>,
    ) => void;
    onMove: (id: string, direction: -1 | 1) => void;
    onDelete: (id: string) => void;
    onOpenPosition: (id: string) => void;
  }) {
    const nameInputRef = useRef<TextInput>(null);
    const promptInputRef = useRef<PromptHighlightTextInputHandle>(null);
    const itemRef = useRef(item);
    const onUpdateRef = useRef(onUpdate);
    const nameRef = useRef(item.name ?? "");
    const promptRef = useRef(item.prompt);
    const negativeRef = useRef(item.negativePrompt);
    const nameFocusedRef = useRef(false);
    const promptFocusedRef = useRef(false);
    const [nameText, setNameText] = useState(item.name ?? "");
    const [mode, setMode] = useState<CharacterPromptMode>("base");
    const [promptText, setPromptText] = useState(item.prompt);
    const [negativeText, setNegativeText] = useState(item.negativePrompt);
    const [promptHeight, setPromptHeight] = useState(EDITOR_MIN_HEIGHT);
    const [negativeHeight, setNegativeHeight] = useState(EDITOR_MIN_HEIGHT);

    itemRef.current = item;
    onUpdateRef.current = onUpdate;

    const fallbackName = `Character ${index + 1}`;
    const displayName = nameText.trim() || fallbackName;
    const activeText = mode === "base" ? promptText : negativeText;
    const badgeColor =
      CHARACTER_BADGE_COLORS[index % CHARACTER_BADGE_COLORS.length];

    const updateActiveText = useCallback(
      (value: string) => {
        if (mode === "base") {
          promptRef.current = value;
          setPromptText(value);
        } else {
          negativeRef.current = value;
          setNegativeText(value);
        }
      },
      [mode],
    );
    const autocomplete = usePromptAutocomplete({
      value: activeText,
      onChangeText: updateActiveText,
      inputRef: promptInputRef,
    });

    const commitName = useCallback(() => {
      const nextName = nameRef.current.trim();
      const storedName = itemRef.current.name;
      const normalizedName = nextName || undefined;
      setNameText(nextName);
      nameRef.current = nextName;
      if (normalizedName !== storedName) {
        onUpdateRef.current(itemRef.current.id, { name: normalizedName });
      }
    }, []);

    const commitChannel = useCallback((channel: CharacterPromptMode) => {
      const current = itemRef.current;
      if (channel === "base" && promptRef.current !== current.prompt) {
        onUpdateRef.current(current.id, { prompt: promptRef.current });
      }
      if (
        channel === "negative" &&
        negativeRef.current !== current.negativePrompt
      ) {
        onUpdateRef.current(current.id, {
          negativePrompt: negativeRef.current,
        });
      }
    }, []);

    useEffect(() => {
      if (!nameFocusedRef.current) {
        nameRef.current = item.name ?? "";
        setNameText(item.name ?? "");
      }
    }, [item.name]);

    useEffect(() => {
      if (promptFocusedRef.current) return;
      promptRef.current = item.prompt;
      negativeRef.current = item.negativePrompt;
      setPromptText(item.prompt);
      setNegativeText(item.negativePrompt);
    }, [item.negativePrompt, item.prompt]);

    useEffect(() => {
      if (active && expanded) return;
      commitChannel(mode);
      promptInputRef.current?.blur();
      autocomplete.deactivateSuggestions();
    }, [
      active,
      autocomplete.deactivateSuggestions,
      commitChannel,
      expanded,
      mode,
    ]);

    useEffect(
      () => () => {
        const current = itemRef.current;
        const normalizedName = nameRef.current.trim() || undefined;
        const patch: Partial<Omit<CharacterPrompt, "id">> = {};
        if (normalizedName !== current.name) patch.name = normalizedName;
        if (promptRef.current !== current.prompt) {
          patch.prompt = promptRef.current;
        }
        if (negativeRef.current !== current.negativePrompt) {
          patch.negativePrompt = negativeRef.current;
        }
        if (Object.keys(patch).length > 0) {
          onUpdateRef.current(current.id, patch);
        }
        autocomplete.deactivateSuggestions();
      },
      [autocomplete.deactivateSuggestions],
    );

    function selectMode(nextMode: CharacterPromptMode) {
      if (nextMode === mode) return;
      commitChannel(mode);
      autocomplete.clearSuggestions();
      setMode(nextMode);
    }

    function handleTextLayout(
      channel: CharacterPromptMode,
      event: NativeSyntheticEvent<TextLayoutEventData>,
    ) {
      const height = Math.max(
        EDITOR_MIN_HEIGHT,
        event.nativeEvent.lines.length * PROMPT_LINE_HEIGHT + 12,
      );
      if (channel === "base") setPromptHeight(height);
      else setNegativeHeight(height);
    }

    const editorHeight = Math.max(promptHeight, negativeHeight);

    return (
      <View style={[styles.card, !item.enabled && styles.cardDisabled]}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${displayName} 위치 지정`}
            onPress={() => onOpenPosition(item.id)}
            style={({ pressed }) => [
              styles.badgeCell,
              pressed && styles.pressed,
            ]}
          >
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: positionEnabled
                    ? badgeColor
                    : tokens.color.sunken,
                },
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  positionEnabled
                    ? styles.badgeTextPositioned
                    : styles.badgeTextDefault,
                ]}
              >
                {index + 1}
              </Text>
            </View>
          </Pressable>

          <TextInput
            ref={nameInputRef}
            accessibilityLabel={`${fallbackName} 이름`}
            value={nameText}
            placeholder={fallbackName}
            placeholderTextColor={tokens.color.textTertiary}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="done"
            selectTextOnFocus
            onFocus={() => {
              onBeginEditing(item.id);
              nameFocusedRef.current = true;
            }}
            onBlur={() => {
              nameFocusedRef.current = false;
              commitName();
            }}
            onChangeText={(value) => {
              nameRef.current = value;
              setNameText(value);
            }}
            onSubmitEditing={() => {
              commitName();
              nameInputRef.current?.blur();
            }}
            style={styles.nameInput}
          />

          <IconAction
            accessibilityLabel={`${displayName} 위로 이동`}
            icon="caret-up"
            disabled={index === 0}
            onPress={() => onMove(item.id, -1)}
          />
          <IconAction
            accessibilityLabel={`${displayName} 아래로 이동`}
            icon="caret-down"
            disabled={!canMoveDown}
            onPress={() => onMove(item.id, 1)}
          />
          <Pressable
            accessibilityRole="switch"
            accessibilityLabel={`${displayName} 활성화`}
            accessibilityState={{ checked: item.enabled }}
            onPress={() => onUpdate(item.id, { enabled: !item.enabled })}
            style={({ pressed }) => [
              styles.headerButton,
              item.enabled && styles.headerButtonActive,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name="checkmark"
              size={17}
              color={
                item.enabled
                  ? tokens.color.textPrimary
                  : tokens.color.textMuted
              }
            />
          </Pressable>
          <IconAction
            accessibilityLabel={`${displayName} 삭제`}
            icon="trash-outline"
            destructive
            onPress={() => onDelete(item.id)}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              persistentlyExpanded
                ? `${displayName} 접기`
                : `${displayName} 계속 펼치기`
            }
            accessibilityState={{ expanded }}
            onPress={() => {
              if (expanded) commitChannel(mode);
              onToggleExpanded(item.id);
            }}
            style={({ pressed }) => [
              styles.headerButton,
              persistentlyExpanded && styles.headerButtonActive,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name="swap-vertical"
              size={17}
              color={tokens.color.textTertiary}
            />
          </Pressable>
        </View>

        {expanded ? (
          <View style={styles.editorBody}>
            <View pointerEvents="none" style={styles.measureLayer}>
              <Text
                testID={`character-${item.id}-base-measure`}
                onTextLayout={(event) => handleTextLayout("base", event)}
                style={styles.measureText}
              >
                {promptText || " "}
              </Text>
              <Text
                testID={`character-${item.id}-negative-measure`}
                onTextLayout={(event) => handleTextLayout("negative", event)}
                style={styles.measureText}
              >
                {negativeText || " "}
              </Text>
            </View>

            <View style={styles.modeTabs}>
              <Pressable
                accessibilityRole="radio"
                accessibilityLabel={`${displayName} Base Prompt`}
                accessibilityState={{ selected: mode === "base" }}
                onPress={() => selectMode("base")}
                style={({ pressed }) => [
                  styles.modeTab,
                  mode === "base" && styles.modeTabActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.modeLabel,
                    mode === "base" && styles.modeLabelActive,
                  ]}
                >
                  Base Prompt
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="radio"
                accessibilityLabel={`${displayName} Undesired Content`}
                accessibilityState={{ selected: mode === "negative" }}
                onPress={() => selectMode("negative")}
                style={({ pressed }) => [
                  styles.modeTab,
                  mode === "negative" && styles.modeTabActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.modeLabel,
                    mode === "negative" && styles.negativeModeLabelActive,
                  ]}
                >
                  Undesired Content
                </Text>
              </Pressable>
            </View>

            <PromptHighlightTextInput
              ref={promptInputRef}
              accessibilityLabel={`${displayName} ${
                mode === "base" ? "prompt" : "undesired content"
              }`}
              multiline
              scrollEnabled={false}
              textAlignVertical="top"
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={mode === "base" ? "1girl, ..." : "lowres, ..."}
              placeholderTextColor={tokens.color.textMuted}
              value={activeText}
              onFocus={() => {
                onBeginEditing(item.id);
                promptFocusedRef.current = true;
                autocomplete.activateSuggestions();
              }}
              onBlur={() => {
                promptFocusedRef.current = false;
                commitChannel(mode);
                autocomplete.deactivateSuggestions();
              }}
              onChangeText={autocomplete.handleChangeText}
              onSelectionChange={autocomplete.handleSelectionChange}
              style={[
                styles.promptInput,
                mode === "negative" && styles.negativePromptInput,
                { height: editorHeight },
              ]}
            />

            <View style={styles.editorFooter}>
              <PromptTokenCounter
                target={{
                  scope: "character",
                  characterId: item.id,
                  channel: mode === "base" ? "positive" : "negative",
                }}
                draftText={activeText}
                variant="bar"
              />
            </View>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${displayName} 편집`}
            onPress={() => onBeginEditing(item.id)}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Text style={styles.preview} numberOfLines={1}>
              {item.prompt.trim() || "프롬프트가 비어 있습니다"}
            </Text>
          </Pressable>
        )}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  card: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    backgroundColor: "#100F13",
  },
  cardDisabled: {
    opacity: 0.55,
  },
  header: {
    height: 40,
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: tokens.color.raised,
  },
  badgeCell: {
    width: 40,
    paddingLeft: 4,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 7,
  },
  badgeText: {
    fontFamily: tokens.font.bold,
    fontSize: 12,
  },
  badgeTextDefault: {
    color: tokens.color.textTertiary,
  },
  badgeTextPositioned: {
    color: tokens.color.onAccent,
  },
  nameInput: {
    minWidth: 0,
    height: 40,
    flex: 1,
    paddingLeft: 4,
    paddingRight: 8,
    paddingVertical: 0,
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: 15,
  },
  headerButton: {
    width: 40,
    height: 40,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderLeftWidth: 1,
    borderLeftColor: tokens.color.borderSubtle,
  },
  headerButtonActive: {
    backgroundColor: tokens.color.toast,
  },
  editorBody: {
    position: "relative",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 5,
  },
  modeTabs: {
    height: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  modeTab: {
    height: 30,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
  },
  modeTabActive: {
    backgroundColor: tokens.color.raised,
  },
  modeLabel: {
    color: tokens.color.textMuted,
    fontFamily: tokens.font.semibold,
    fontSize: 13,
  },
  modeLabelActive: {
    color: tokens.color.textPrimary,
  },
  negativeModeLabelActive: {
    color: tokens.color.negative,
  },
  promptInput: {
    minHeight: EDITOR_MIN_HEIGHT,
    marginTop: 10,
    padding: 0,
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.regular,
    fontSize: 15,
    lineHeight: 23,
  },
  negativePromptInput: {
    color: tokens.color.textSecondary,
  },
  measureLayer: {
    position: "absolute",
    top: 0,
    right: 14,
    left: 14,
    opacity: 0,
  },
  measureText: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.regular,
    fontSize: 15,
    lineHeight: PROMPT_LINE_HEIGHT,
  },
  editorFooter: {
    minHeight: 24,
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  actionButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderLeftWidth: 1,
    borderLeftColor: tokens.color.borderSubtle,
  },
  actionButtonDisabled: {
    opacity: 0.3,
  },
  preview: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.medium,
    fontSize: 14,
    lineHeight: 21,
  },
  pressed: {
    opacity: 0.65,
  },
});
