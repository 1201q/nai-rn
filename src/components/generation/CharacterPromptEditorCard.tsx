import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type TextLayoutEventData,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Portal } from "@gorhom/portal";
import Reanimated from "react-native-reanimated";

import { useGenerationInputCommitRegistration } from "../../context/GenerationInputCommitContext";
import { usePromptAutocomplete } from "../../hooks/usePromptAutocomplete";
import { usePopoverBackHandler } from "../../native/usePopoverBackHandler";
import type { CharacterPrompt } from "../../store/generationStore";
import { tokens } from "../../styles/tokens";
import { Toggle } from "../forms/FormControls";
import {
  PromptHighlightTextInput,
  type PromptHighlightTextInputHandle,
} from "../forms/PromptHighlightTextInput";
import { PromptTokenCounter } from "../forms/PromptTokenCounter";
import { SHEET_SELECT_PORTAL_HOST } from "../forms/SheetSelect";

type CharacterPromptMode = "base" | "negative";

const EDITOR_MIN_HEIGHT = 72;
const PROMPT_LINE_HEIGHT = 23;
const MENU_WIDTH = 180;
const MENU_ITEM_HEIGHT = 44;
const MENU_MARGIN = 12;

type CharacterMenuItem = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  destructive?: boolean;
  onPress: () => void;
};

function CharacterMenu({
  displayName,
  items,
}: {
  displayName: string;
  items: CharacterMenuItem[];
}) {
  const triggerRef = useRef<View>(null);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [anchor, setAnchor] = useState<{
    right: number;
    top: number;
    bottom: number;
  } | null>(null);
  const open = anchor !== null;
  const close = useCallback(() => setAnchor(null), []);

  const { popoverStyle, resetPredictiveBack } = usePopoverBackHandler(
    open,
    close,
  );

  const menuHeight = items.length * MENU_ITEM_HEIGHT + 2;
  const below = anchor ? anchor.bottom + 6 : 0;
  const menuTop =
    anchor && below + menuHeight > windowHeight - MENU_MARGIN
      ? Math.max(MENU_MARGIN, anchor.top - menuHeight - 6)
      : below;
  const menuLeft = anchor
    ? Math.max(
        MENU_MARGIN,
        Math.min(anchor.right, windowWidth - MENU_MARGIN) - MENU_WIDTH,
      )
    : MENU_MARGIN;

  return (
    <>
      <Pressable
        ref={triggerRef}
        accessibilityRole="button"
        accessibilityLabel={`${displayName} 더 보기`}
        accessibilityState={{ expanded: open }}
        onPress={() => {
          if (open) {
            close();
            return;
          }
          triggerRef.current?.measureInWindow((x, y, width, height) => {
            resetPredictiveBack();
            setAnchor({ right: x + width, top: y, bottom: y + height });
          });
        }}
        style={({ pressed }) => [
          styles.headerButton,
          pressed && styles.pressed,
        ]}
      >
        <Ionicons
          name="ellipsis-horizontal"
          size={17}
          color={tokens.color.textTertiary}
        />
      </Pressable>

      {open ? (
        <Portal hostName={SHEET_SELECT_PORTAL_HOST}>
          <View style={styles.menuPortal}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${displayName} 메뉴 닫기`}
              onPress={close}
              style={StyleSheet.absoluteFill}
            />
            <Reanimated.View
              style={[
                styles.menu,
                { top: menuTop, left: menuLeft },
                popoverStyle,
              ]}
            >
              {items.map((menuItem) => (
                <Pressable
                  key={menuItem.label}
                  accessibilityRole="menuitem"
                  accessibilityLabel={`${displayName} ${menuItem.label}`}
                  accessibilityState={{ disabled: !!menuItem.disabled }}
                  disabled={menuItem.disabled}
                  onPress={() => {
                    close();
                    menuItem.onPress();
                  }}
                  style={({ pressed }) => [
                    styles.menuItem,
                    menuItem.disabled && styles.menuItemDisabled,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.menuItemText,
                      menuItem.destructive && styles.menuItemTextDestructive,
                    ]}
                  >
                    {menuItem.label}
                  </Text>
                  <Ionicons
                    name={menuItem.icon}
                    size={18}
                    color={
                      menuItem.destructive
                        ? tokens.color.negative
                        : tokens.color.textSecondary
                    }
                  />
                </Pressable>
              ))}
            </Reanimated.View>
          </View>
        </Portal>
      ) : null}
    </>
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
    canEditPosition,
    canMoveDown,
    ucLocked,
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
    canEditPosition: boolean;
    canMoveDown: boolean;
    // true면 UC 탭을 숨긴다 (Effort Medium). 입력해 둔 UC는 지우지 않는다.
    ucLocked: boolean;
    onToggleExpanded: (id: string) => void;
    onBeginEditing: (id: string | null) => void;
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
    const [selectedMode, setMode] = useState<CharacterPromptMode>("base");
    const mode = ucLocked ? "base" : selectedMode;
    const [promptText, setPromptText] = useState(item.prompt);
    const [negativeText, setNegativeText] = useState(item.negativePrompt);
    const [promptHeight, setPromptHeight] = useState(EDITOR_MIN_HEIGHT);
    const [negativeHeight, setNegativeHeight] = useState(EDITOR_MIN_HEIGHT);

    itemRef.current = item;
    onUpdateRef.current = onUpdate;

    const fallbackName = `Character ${index + 1}`;
    const displayName = nameText.trim() || fallbackName;
    const activeText = mode === "base" ? promptText : negativeText;

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
      channel: mode,
      value: activeText,
      onChangeText: updateActiveText,
      inputRef: promptInputRef,
      insertTarget: {
        scope: "character",
        characterId: item.id,
        channel: mode === "base" ? "positive" : "negative",
      },
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
    const commitActiveChannel = useCallback(
      () => commitChannel(mode),
      [commitChannel, mode],
    );
    const nameCommit = useGenerationInputCommitRegistration(commitName);
    const promptCommit =
      useGenerationInputCommitRegistration(commitActiveChannel);

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
      <View testID={`character-${item.id}-card`} style={styles.card}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${displayName} 위치 지정`}
            accessibilityState={{ disabled: !canEditPosition }}
            disabled={!canEditPosition}
            onPress={() => onOpenPosition(item.id)}
            style={({ pressed }) => [
              styles.badgeCell,
              pressed && styles.pressed,
            ]}
          >
            <View
              style={[
                styles.badge,
                positionEnabled ? styles.badgePositioned : styles.badgeDefault,
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
              onBeginEditing(null);
              nameFocusedRef.current = true;
              nameCommit.activate();
            }}
            onBlur={() => {
              nameFocusedRef.current = false;
              nameCommit.commitAndDeactivate();
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

          <View style={styles.enableToggle}>
            <Toggle
              size="small"
              label={`${displayName} 활성화`}
              value={item.enabled}
              onChange={(enabled) => onUpdate(item.id, { enabled })}
            />
          </View>
          <CharacterMenu
            displayName={displayName}
            items={[
              {
                label: "위치 지정",
                icon: "grid-outline",
                disabled: !canEditPosition,
                onPress: () => onOpenPosition(item.id),
              },
              {
                label: "위로 이동",
                icon: "arrow-up",
                disabled: index === 0,
                onPress: () => onMove(item.id, -1),
              },
              {
                label: "아래로 이동",
                icon: "arrow-down",
                disabled: !canMoveDown,
                onPress: () => onMove(item.id, 1),
              },
              {
                label: "삭제",
                icon: "trash-outline",
                destructive: true,
                onPress: () => onDelete(item.id),
              },
            ]}
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
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name={persistentlyExpanded ? "chevron-up" : "chevron-down"}
              size={17}
              color={tokens.color.textTertiary}
            />
          </Pressable>
        </View>

        <View
          testID={`character-${item.id}-content`}
          style={!item.enabled ? styles.cardDisabled : undefined}
        >
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
                  accessibilityLabel={`${displayName} Prompt`}
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
                    Prompt
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
                    ucLocked && styles.hidden,
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

              <View
                testID={`character-${item.id}-input-frame`}
                style={[styles.promptInputFrame, { height: editorHeight }]}
              >
                <PromptHighlightTextInput
                  ref={promptInputRef}
                  bottomSheetAware
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
                    promptCommit.activate();
                    autocomplete.activateSuggestions();
                  }}
                  onBlur={() => {
                    promptFocusedRef.current = false;
                    promptCommit.commitAndDeactivate();
                    autocomplete.deactivateSuggestions();
                  }}
                  onChangeText={autocomplete.handleChangeText}
                  onSelectionChange={autocomplete.handleSelectionChange}
                  selection={autocomplete.selection}
                  style={[
                    styles.promptInput,
                    mode === "negative" && styles.negativePromptInput,
                  ]}
                />
              </View>

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
              onPress={() => {
                Keyboard.dismiss();
                onBeginEditing(item.id);
              }}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Text style={styles.preview} numberOfLines={1}>
                {item.prompt.trim() || "프롬프트가 비어 있습니다"}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  card: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: tokens.color.promptBorder,
    borderRadius: 16,
    backgroundColor: tokens.color.promptSurface,
  },
  cardDisabled: {
    opacity: 0.55,
  },
  header: {
    height: 40,
    flexDirection: "row",
    alignItems: "stretch",
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.promptBorder,
    backgroundColor: tokens.color.card,
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
    color: tokens.color.app,
  },
  badgeDefault: {
    backgroundColor: tokens.color.sunken,
  },
  badgePositioned: {
    backgroundColor: tokens.color.textPrimary,
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
  },
  enableToggle: {
    marginHorizontal: 6,
    justifyContent: "center",
  },
  menuPortal: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 100,
    elevation: 100,
  },
  menu: {
    position: "absolute",
    width: MENU_WIDTH,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: tokens.color.borderSubtleStrong,
    borderRadius: 14,
    backgroundColor: tokens.color.sunken,
    transformOrigin: "center center",
    ...tokens.shadow.floatMd,
  },
  menuItem: {
    height: MENU_ITEM_HEIGHT,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  menuItemDisabled: {
    opacity: 0.3,
  },
  menuItemText: {
    color: tokens.color.textSecondary,
    fontFamily: tokens.font.medium,
    fontSize: 15,
  },
  menuItemTextDestructive: {
    color: tokens.color.negative,
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
    backgroundColor: tokens.color.card,
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
  promptInputFrame: {
    minHeight: EDITOR_MIN_HEIGHT,
    marginTop: 10,
  },
  promptInput: {
    height: "100%",
    width: "100%",
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
  preview: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.medium,
    fontSize: 14,
    lineHeight: 21,
  },
  hidden: {
    display: "none",
  },
  pressed: {
    opacity: tokens.opacity.pressed,
  },
});
