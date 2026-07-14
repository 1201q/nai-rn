import { memo, useEffect, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Reanimated, {
  Easing,
  FadeIn,
  FadeOut,
  LayoutAnimationConfig,
  LinearTransition,
} from "react-native-reanimated";

import type { CharacterPrompt } from "../../store/generationStore";
import { tokens } from "../../styles/tokens";
import { RendraSegmentedControl } from "./RendraFormControls";

type PromptMode = "base" | "negative";
type MenuAction = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  action: () => void;
  disabled?: boolean;
  destructive?: boolean;
};

const MODES = [
  { value: "base", label: "Base" },
  { value: "negative", label: "Negative" },
] as const;

const BADGE_COLORS = [
  tokens.color.badge1,
  tokens.color.badge2,
  tokens.color.badge3,
  tokens.color.badge4,
] as const;

const CARD_LAYOUT = LinearTransition.duration(180).easing(
  Easing.out(Easing.cubic),
);
const CARD_BODY_ENTERING = FadeIn.duration(140);
const CARD_BODY_EXITING = FadeOut.duration(100);

function CharacterActionMenu({
  visible,
  top,
  canCopy,
  onClose,
  onPosition,
  onRename,
  onCopy,
  onDelete,
}: {
  visible: boolean;
  top: number;
  canCopy: boolean;
  onClose: () => void;
  onPosition: () => void;
  onRename: () => void;
  onCopy: () => void;
  onDelete: () => void;
}) {
  const actions: MenuAction[] = [
    { key: "position", label: "위치 지정", icon: "location-outline", action: onPosition },
    { key: "rename", label: "이름 변경", icon: "pencil-outline", action: onRename },
    { key: "copy", label: "복사", icon: "copy-outline", action: onCopy, disabled: !canCopy },
    { key: "delete", label: "삭제", icon: "trash-outline", action: onDelete, destructive: true },
  ];

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="캐릭터 메뉴 닫기"
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
        <View
          accessibilityViewIsModal
          style={[styles.actionMenu, { top }]}
        >
          {actions.map((item) => (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              accessibilityState={{ disabled: item.disabled ?? false }}
              disabled={item.disabled}
              onPress={() => {
                onClose();
                item.action();
              }}
              style={({ pressed }) => [
                styles.actionMenuItem,
                item.disabled && styles.actionMenuItemDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name={item.icon}
                size={19}
                color={
                  item.destructive
                    ? tokens.color.negative
                    : tokens.color.textSecondary
                }
              />
              <Text
                style={[
                  styles.actionMenuLabel,
                  item.destructive && styles.actionMenuLabelDestructive,
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}

export const RendraCharacterCard = memo(function RendraCharacterCard({
  item,
  index,
  expanded,
  layoutAnimationEnabled = true,
  canCopy,
  onToggleExpand,
  onUpdate,
  onRename,
  onCopy,
  onDelete,
  onOpenPosition,
}: {
  item: CharacterPrompt;
  index: number;
  expanded: boolean;
  layoutAnimationEnabled?: boolean;
  canCopy: boolean;
  onToggleExpand: () => void;
  onUpdate: (values: Partial<Omit<CharacterPrompt, "id">>) => void;
  onRename: (name: string) => void;
  onCopy: () => void;
  onDelete: () => void;
  onOpenPosition: () => void;
}) {
  const { height: windowHeight } = useWindowDimensions();
  const menuAnchorRef = useRef<View>(null);
  const focusedRef = useRef(false);
  const [mode, setMode] = useState<PromptMode>("base");
  const [baseText, setBaseText] = useState(item.prompt);
  const [negativeText, setNegativeText] = useState(item.negativePrompt);
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuTop, setMenuTop] = useState(24);
  const [renaming, setRenaming] = useState(false);
  const [renameText, setRenameText] = useState("");

  const displayName = item.name?.trim() || `Character ${index + 1}`;

  useEffect(() => {
    if (focusedRef.current) return;
    setBaseText(item.prompt);
    setNegativeText(item.negativePrompt);
  }, [item.negativePrompt, item.prompt]);

  function commitMode(targetMode: PromptMode) {
    if (targetMode === "base" && baseText !== item.prompt) {
      onUpdate({ prompt: baseText });
    }
    if (targetMode === "negative" && negativeText !== item.negativePrompt) {
      onUpdate({ negativePrompt: negativeText });
    }
  }

  function changeMode(next: string) {
    commitMode(mode);
    setMode(next as PromptMode);
  }

  function openMenu() {
    menuAnchorRef.current?.measureInWindow((_x, pageY) => {
      setMenuTop(Math.max(16, Math.min(windowHeight - 232, pageY - 190)));
      setMenuVisible(true);
    });
  }

  function beginRename() {
    setRenameText(item.name ?? displayName);
    setRenaming(true);
  }

  function confirmRename() {
    onRename(renameText.trim());
    setRenaming(false);
  }

  return (
    <Reanimated.View
      layout={layoutAnimationEnabled ? CARD_LAYOUT : undefined}
      style={[styles.card, !item.enabled && styles.cardDisabled]}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={expanded ? "캐릭터 접기" : "캐릭터 펼치기"}
          accessibilityState={{ expanded }}
          onPress={() => {
            if (expanded) commitMode(mode);
            onToggleExpand();
          }}
          style={({ pressed }) => [styles.headerMain, pressed && styles.pressed]}
        >
          <View
            style={[
              styles.badge,
              { backgroundColor: BADGE_COLORS[index % BADGE_COLORS.length] },
            ]}
          >
            <Text style={styles.badgeText}>{index + 1}</Text>
          </View>
          <Text style={styles.title} numberOfLines={1}>
            {displayName}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={item.enabled ? "캐릭터 비활성화" : "캐릭터 활성화"}
          hitSlop={4}
          onPress={() => onUpdate({ enabled: !item.enabled })}
          style={({ pressed }) => [styles.headerIcon, pressed && styles.pressed]}
        >
          <Ionicons
            name={item.enabled ? "eye-outline" : "eye-off-outline"}
            size={22}
            color={item.enabled ? tokens.color.textPrimary : tokens.color.textMuted}
          />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={expanded ? "캐릭터 접기" : "캐릭터 펼치기"}
          onPress={onToggleExpand}
          style={({ pressed }) => [styles.headerIcon, pressed && styles.pressed]}
        >
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={18}
            color={tokens.color.textMuted}
          />
        </Pressable>
      </View>

      {renaming ? (
        <Reanimated.View entering={FadeIn.duration(120)} style={styles.renameRow}>
          <TextInput
            accessibilityLabel="캐릭터 이름"
            autoFocus
            value={renameText}
            placeholder="Character name"
            placeholderTextColor={tokens.color.textMuted}
            returnKeyType="done"
            onChangeText={setRenameText}
            onSubmitEditing={confirmRename}
            style={styles.renameInput}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="이름 변경 완료"
            onPress={confirmRename}
            style={({ pressed }) => [styles.renameConfirm, pressed && styles.pressed]}
          >
            <Ionicons name="checkmark" size={18} color={tokens.color.accent} />
          </Pressable>
        </Reanimated.View>
      ) : null}

      <LayoutAnimationConfig skipEntering>
        {expanded ? (
          <Reanimated.View
            entering={CARD_BODY_ENTERING}
            exiting={CARD_BODY_EXITING}
            layout={layoutAnimationEnabled ? CARD_LAYOUT : undefined}
            style={[
              styles.editor,
              mode === "negative" && styles.editorNegative,
            ]}
          >
            <TextInput
              accessibilityLabel={
                mode === "base" ? "Base prompt" : "Negative prompt"
              }
              value={mode === "base" ? baseText : negativeText}
              multiline
              textAlignVertical="top"
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="..."
              placeholderTextColor={tokens.color.textMuted}
              onFocus={() => {
                focusedRef.current = true;
              }}
              onBlur={() => {
                focusedRef.current = false;
                commitMode(mode);
              }}
              onChangeText={(text) => {
                if (mode === "base") setBaseText(text);
                else setNegativeText(text);
              }}
              style={styles.promptInput}
            />
            <View style={styles.editorFooter}>
              <RendraSegmentedControl
                options={MODES}
                value={mode}
                onChange={changeMode}
              />
              <Pressable
                ref={menuAnchorRef}
                accessibilityRole="button"
                accessibilityLabel="캐릭터 메뉴"
                onPress={openMenu}
                style={({ pressed }) => [
                  styles.moreButton,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name="ellipsis-horizontal"
                  size={19}
                  color={tokens.color.textTertiary}
                />
              </Pressable>
            </View>
          </Reanimated.View>
        ) : null}
      </LayoutAnimationConfig>

      <CharacterActionMenu
        visible={menuVisible}
        top={menuTop}
        canCopy={canCopy}
        onClose={() => setMenuVisible(false)}
        onPosition={onOpenPosition}
        onRename={beginRename}
        onCopy={onCopy}
        onDelete={onDelete}
      />
    </Reanimated.View>
  );
});

const styles = StyleSheet.create({
  card: {
    overflow: "hidden",
    borderRadius: tokens.radius.xl,
    backgroundColor: tokens.color.card,
  },
  cardDisabled: {
    opacity: 0.55,
  },
  header: {
    height: 58,
    paddingLeft: 12,
    paddingRight: 4,
    flexDirection: "row",
    alignItems: "center",
  },
  headerMain: {
    flex: 1,
    minWidth: 0,
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: tokens.color.onAccent,
    fontFamily: tokens.font.bold,
    fontSize: tokens.type.sm,
  },
  title: {
    flex: 1,
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.bold,
    fontSize: tokens.type.md,
  },
  headerIcon: {
    width: 42,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  renameRow: {
    height: 48,
    marginHorizontal: 12,
    marginBottom: 10,
    paddingLeft: 12,
    paddingRight: 6,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: tokens.color.app,
  },
  renameInput: {
    flex: 1,
    padding: 0,
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.regular,
    fontSize: tokens.type.sm,
  },
  renameConfirm: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: tokens.color.card,
  },
  editor: {
    minHeight: 204,
    marginHorizontal: 12,
    marginBottom: 12,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    backgroundColor: tokens.color.app,
  },
  editorNegative: {
    borderColor: tokens.color.borderNegative,
  },
  promptInput: {
    flex: 1,
    minHeight: 116,
    padding: 0,
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.regular,
    fontSize: tokens.type.sm,
    lineHeight: 20,
  },
  editorFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  moreButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    backgroundColor: tokens.color.card,
  },
  modalRoot: {
    flex: 1,
  },
  actionMenu: {
    position: "absolute",
    right: 20,
    width: 230,
    paddingVertical: 8,
    overflow: "hidden",
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.color.borderSubtleStrong,
    backgroundColor: tokens.color.raised,
    ...tokens.shadow.floatMd,
  },
  actionMenuItem: {
    height: 50,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  actionMenuItemDisabled: {
    opacity: 0.35,
  },
  actionMenuLabel: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type.base,
  },
  actionMenuLabelDestructive: {
    color: tokens.color.negative,
  },
  pressed: {
    opacity: 0.65,
  },
});
