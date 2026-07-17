import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";

import { useGenerationStore } from "../../store/generationStore";
import { tokens } from "../../styles/tokens";
import { RendraToggle } from "./RendraFormControls";
import {
  type RegisterRendraSheetDraft,
  type RendraSheetDraftController,
} from "./RendraSheetDraft";

const MAX_SEED = 4_294_967_295;
const SEED_ACCESSIBILITY_HINT = `0에서 ${MAX_SEED.toLocaleString()} 사이의 숫자`;

function randomSeed() {
  return Math.floor(Math.random() * (MAX_SEED + 1));
}

export const RendraSeedSheet = memo(function RendraSeedSheet({
  onSaveAndClose,
  registerDraft,
}: {
  onSaveAndClose: () => void;
  registerDraft: RegisterRendraSheetDraft;
}) {
  const seed = useGenerationStore((state) => state.seed);
  const setSeed = useGenerationStore((state) => state.setSeed);
  const seedLocked = useGenerationStore((state) => state.seedLocked);
  const setSeedLocked = useGenerationStore((state) => state.setSeedLocked);
  const initialText = seedLocked || seed !== 0 ? String(seed) : "";
  const [draftText, setDraftText] = useState(initialText);
  const [draftLocked, setDraftLocked] = useState(seedLocked);

  const parsedSeed = draftText === "" ? 0 : Number(draftText);
  const valid =
    draftText === "" ||
    (Number.isSafeInteger(parsedSeed) &&
      parsedSeed >= 0 &&
      parsedSeed <= MAX_SEED);
  const dirty = draftText !== initialText || draftLocked !== seedLocked;
  const canSave = dirty && valid;

  const commitDraft = useCallback(() => {
    if (!valid) return false;

    setSeed(parsedSeed);
    setSeedLocked(draftLocked);
    return true;
  }, [draftLocked, parsedSeed, setSeed, setSeedLocked, valid]);

  const commitDraftRef = useRef(commitDraft);
  useEffect(() => {
    commitDraftRef.current = commitDraft;
  }, [commitDraft]);

  const draftController = useMemo<RendraSheetDraftController>(
    () => ({
      id: "seed",
      dirty,
      canSave,
      promptTitle: "변경사항 저장",
      promptMessage: "변경한 Seed를 저장하시겠습니까?",
      save: () => commitDraftRef.current(),
    }),
    [canSave, dirty],
  );

  useEffect(() => {
    registerDraft(draftController);
    return () => registerDraft(null);
  }, [draftController, registerDraft]);

  const handleSaveAndClose = useCallback(() => {
    if (!commitDraft()) return;
    onSaveAndClose();
  }, [commitDraft, onSaveAndClose]);

  const handleTextChange = useCallback((value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 10);
    setDraftText(digits);
    setDraftLocked(digits.length > 0);
  }, []);

  const handleRandomize = useCallback(() => {
    setDraftText(String(randomSeed()));
    setDraftLocked(true);
  }, []);

  const handleLockChange = useCallback(
    (locked: boolean) => {
      if (locked && draftText === "") {
        setDraftText(String(randomSeed()));
      }
      setDraftLocked(locked);
    },
    [draftText],
  );

  return (
    <View style={styles.content}>
      <View style={[styles.inputRow, !valid && styles.inputRowInvalid]}>
        <BottomSheetTextInput
          accessibilityLabel="Seed 값"
          accessibilityHint={SEED_ACCESSIBILITY_HINT}
          value={draftText}
          onChangeText={handleTextChange}
          onSubmitEditing={handleSaveAndClose}
          keyboardType="number-pad"
          returnKeyType="done"
          maxLength={10}
          placeholder="Random"
          placeholderTextColor={tokens.color.textMuted}
          selectTextOnFocus
          style={styles.input}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="무작위 Seed 만들기"
          hitSlop={4}
          onPress={handleRandomize}
          style={({ pressed }) => [
            styles.randomButton,
            pressed && styles.randomButtonPressed,
          ]}
        >
          <Ionicons
            name="dice-outline"
            size={20}
            color={tokens.color.textSecondary}
          />
        </Pressable>
      </View>

      <View style={styles.lockRow}>
        <View>
          <Text style={styles.lockLabel}>Seed 고정</Text>
          <Text style={styles.lockValue}>
            {draftLocked ? "다음 생성에 이 값을 사용" : "생성할 때마다 Random"}
          </Text>
        </View>
        <RendraToggle
          value={draftLocked}
          label="Seed 고정"
          onChange={handleLockChange}
        />
      </View>

    </View>
  );
});

const styles = StyleSheet.create({
  content: {
    width: "100%",
    paddingTop: tokens.space[6],
    gap: tokens.space[6],
  },
  inputRow: {
    minHeight: 56,
    marginHorizontal: tokens.space[4],
    paddingLeft: tokens.space[6],
    paddingRight: tokens.space[3],
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.sunken,
    flexDirection: "row",
    alignItems: "center",
  },
  inputRowInvalid: {
    borderColor: tokens.color.borderNegative,
  },
  input: {
    flex: 1,
    minHeight: 54,
    paddingVertical: 0,
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.medium,
    fontSize: 18,
  },
  randomButton: {
    width: 44,
    height: 44,
    borderRadius: tokens.radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.raised,
  },
  randomButtonPressed: {
    opacity: 0.68,
  },
  lockRow: {
    minHeight: 56,
    paddingHorizontal: tokens.space[6],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  lockLabel: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.medium,
    fontSize: 17,
    lineHeight: 22,
  },
  lockValue: {
    marginTop: tokens.space[1],
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.regular,
    fontSize: tokens.type["2xs"],
    lineHeight: 16,
  },
});
