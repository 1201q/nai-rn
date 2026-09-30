import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";

import { MAX_SEED } from "../../../../constants/generation";
import { useGenerationInputCommitRegistration } from "../../../../context/GenerationInputCommitContext";
import { useGenerationStore } from "../../../../store/generationStore";
import { tokens } from "../../../../styles/tokens";
import { PressableSurface } from "../SheetLayers";

export function SettingsSeedInput({ active }: { active: boolean }) {
  const seed = useGenerationStore((state) => state.seed);
  const setSeed = useGenerationStore((state) => state.setSeed);
  const seedLocked = useGenerationStore((state) => state.seedLocked);
  const setSeedLocked = useGenerationStore((state) => state.setSeedLocked);
  const currentImageSeed = useGenerationStore(
    (state) => state.currentGeneration?.seed ?? null,
  );
  const canUseCurrentImageSeed = useGenerationStore(
    (state) =>
      state.currentGeneration?.seed != null &&
      !state.isLoading &&
      state.streamingPreviewUri == null,
  );
  const seedInputFocusedRef = useRef(false);
  const [seedDraft, setSeedDraft] = useState(seedLocked ? String(seed) : "");
  const seedDraftRef = useRef(seedDraft);

  useEffect(() => {
    if (!active) seedInputFocusedRef.current = false;
    if (!seedInputFocusedRef.current) {
      const next = seedLocked ? String(seed) : "";
      seedDraftRef.current = next;
      setSeedDraft(next);
    }
  }, [active, seed, seedLocked]);

  function applySeedText(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 10);
    seedDraftRef.current = digits;
    setSeedDraft(digits);

    if (digits === "") {
      setSeed(0);
      setSeedLocked(false);
      return;
    }

    const parsed = Number(digits);
    if (Number.isSafeInteger(parsed) && parsed <= MAX_SEED) {
      setSeed(parsed);
      setSeedLocked(true);
    }
  }

  const commitSeedDraft = useCallback(() => {
    if (seedDraftRef.current === "") {
      setSeed(0);
      setSeedLocked(false);
      return;
    }

    const parsed = Number(seedDraftRef.current);
    const next = Number.isSafeInteger(parsed)
      ? Math.min(MAX_SEED, Math.max(0, parsed))
      : 0;
    const nextText = String(next);
    seedDraftRef.current = nextText;
    setSeedDraft(nextText);
    setSeed(next);
    setSeedLocked(true);
  }, [setSeed, setSeedLocked]);
  const seedCommit = useGenerationInputCommitRegistration(
    commitSeedDraft,
    active,
  );

  function handleSeedAction() {
    if (seedDraft !== "") {
      seedDraftRef.current = "";
      setSeedDraft("");
      setSeed(0);
      setSeedLocked(false);
      return;
    }

    if (currentImageSeed == null || !canUseCurrentImageSeed) return;
    const next = String(currentImageSeed);
    seedDraftRef.current = next;
    setSeedDraft(next);
    setSeed(currentImageSeed);
    setSeedLocked(true);
  }

  return (
    <View style={styles.seedField}>
      <BottomSheetTextInput
        accessibilityLabel="Seed 값"
        value={seedDraft}
        onChangeText={applySeedText}
        onFocus={() => {
          seedInputFocusedRef.current = true;
          seedCommit.activate();
        }}
        onBlur={() => {
          seedInputFocusedRef.current = false;
          seedCommit.commitAndDeactivate();
        }}
        onSubmitEditing={commitSeedDraft}
        keyboardType="number-pad"
        returnKeyType="done"
        submitBehavior="blurAndSubmit"
        maxLength={10}
        placeholder="Enter a seed"
        placeholderTextColor={tokens.color.textMuted}
        selectTextOnFocus
        style={styles.seedValueText}
      />
      <PressableSurface
        accessibilityLabel={
          seedDraft === "" ? "현재 이미지 Seed 가져오기" : "Seed 지우기"
        }
        disabled={seedDraft === "" && !canUseCurrentImageSeed}
        onPress={handleSeedAction}
        style={styles.seedActionButton}
      >
        <Ionicons
          name={seedDraft === "" ? "dice-outline" : "close"}
          size={18}
          color={tokens.color.textSecondary}
        />
      </PressableSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  seedField: {
    height: 46,
    paddingLeft: 12,
    paddingRight: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 14,
    backgroundColor: tokens.color.raised,
  },
  seedValueText: {
    flex: 1,
    minWidth: 0,
    height: 46,
    padding: 0,
    textAlignVertical: "center",
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.regular,
    fontSize: 15,
    fontVariant: ["tabular-nums"],
  },
  seedActionButton: {
    width: 36,
    height: 36,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    backgroundColor: tokens.color.sunken,
  },
});
