import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { toast } from "sonner-native";

import type { ParsedNaiMetadata } from "../../lib/naiMetadata";
import {
  createMetadataImportSelection,
  getMetadataImportAvailability,
  hasSelectedMetadataImport,
  type MetadataCharacterImportMode,
} from "../../lib/metadataImport";
import { useGenerationStore } from "../../store/generationStore";
import { tokens } from "../../styles/tokens";
import { SegmentedControl, Toggle } from "../forms/FormControls";
import type { RegisterSheetDraft } from "./SheetDraft";

const CHARACTER_MODE_OPTIONS = [
  { value: "replace", label: "Replace" },
  { value: "append", label: "Append" },
] as const;

function ImportOptionRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.optionRow}>
      <View style={styles.optionCopy}>
        <Text style={styles.optionLabel}>{label}</Text>
        <Text style={styles.optionDescription}>{description}</Text>
      </View>
      <Toggle value={value} onChange={onChange} label={label} />
    </View>
  );
}

export function MetadataImportSheet({
  parsed,
  registerDraft,
}: {
  parsed: ParsedNaiMetadata;
  registerDraft: RegisterSheetDraft;
}) {
  const applyMetadataImport = useGenerationStore(
    (state) => state.applyMetadataImport,
  );
  const available = useMemo(
    () => getMetadataImportAvailability(parsed),
    [parsed],
  );
  const [selection, setSelection] = useState(() =>
    createMetadataImportSelection(parsed),
  );
  const canImport = hasSelectedMetadataImport(selection, available);

  function updateSelection(
    key: "prompt" | "negativePrompt" | "characters" | "settings" | "seed",
    value: boolean,
  ) {
    setSelection((current) => ({ ...current, [key]: value }));
  }

  function handleCharacterMode(value: string) {
    setSelection((current) => ({
      ...current,
      characterMode: value as MetadataCharacterImportMode,
    }));
  }

  const handleImport = useCallback(() => {
    if (!canImport) return false;
    applyMetadataImport(parsed, selection);
    toast.success("메타데이터를 가져왔습니다.");
    return true;
  }, [applyMetadataImport, canImport, parsed, selection]);

  useEffect(() => {
    registerDraft({
      id: "metadataImport",
      dirty: false,
      canSave: canImport,
      promptTitle: "메타데이터 가져오기 취소",
      promptMessage: "선택한 항목을 가져오지 않고 나갑니다.",
      save: handleImport,
    });
    return () => registerDraft(null);
  }, [canImport, handleImport, registerDraft]);

  return (
    <View style={styles.content}>
      <Text style={styles.sectionLabel}>IMPORT</Text>
      <View style={styles.optionCard}>
        {available.prompt ? (
          <ImportOptionRow
            label="Prompt"
            description="메인 프롬프트"
            value={selection.prompt}
            onChange={(value) => updateSelection("prompt", value)}
          />
        ) : null}

        {available.negativePrompt ? (
          <ImportOptionRow
            label="Negative Prompt (UC)"
            description="제외할 요소와 UC"
            value={selection.negativePrompt}
            onChange={(value) => updateSelection("negativePrompt", value)}
          />
        ) : null}

        {available.characters ? (
          <>
            <ImportOptionRow
              label="Character Prompt"
              description={`${parsed.characters?.length ?? 0}개 캐릭터`}
              value={selection.characters}
              onChange={(value) => updateSelection("characters", value)}
            />
            {selection.characters ? (
              <View style={styles.characterMode}>
                <Text style={styles.characterModeLabel}>적용 방식</Text>
                <SegmentedControl
                  options={CHARACTER_MODE_OPTIONS}
                  value={selection.characterMode}
                  onChange={handleCharacterMode}
                />
              </View>
            ) : null}
          </>
        ) : null}

        {available.settings ? (
          <ImportOptionRow
            label="Settings"
            description="Model, Resolution, Sampling"
            value={selection.settings}
            onChange={(value) => updateSelection("settings", value)}
          />
        ) : null}

        {available.seed ? (
          <ImportOptionRow
            label="Seed"
            description={String(parsed.seed)}
            value={selection.seed}
            onChange={(value) => updateSelection("seed", value)}
          />
        ) : null}
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    width: "100%",
    paddingHorizontal: tokens.space[5],
    paddingTop: tokens.space[2],
    paddingBottom: tokens.space[8],
  },
  sectionLabel: {
    paddingHorizontal: tokens.space[1],
    paddingTop: tokens.space[4],
    paddingBottom: tokens.space[6],
    color: tokens.color.textMuted,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type["3xs"],
    letterSpacing: tokens.tracking.wide,
  },
  optionCard: {
    paddingHorizontal: tokens.space[4],
    paddingVertical: tokens.space[2],
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.card,
  },
  optionRow: {
    minHeight: 62,
    paddingHorizontal: tokens.space[4],
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space[6],
  },
  optionCopy: {
    flex: 1,
    gap: tokens.space[1],
  },
  optionLabel: {
    color: tokens.color.textSecondary,
    fontFamily: tokens.font.medium,
    fontSize: tokens.type.base,
  },
  optionDescription: {
    color: tokens.color.textMuted,
    fontFamily: tokens.font.regular,
    fontSize: tokens.type["2xs"],
  },
  characterMode: {
    minHeight: 46,
    paddingHorizontal: tokens.space[4],
    paddingBottom: tokens.space[6],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.space[6],
  },
  characterModeLabel: {
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.medium,
    fontSize: tokens.type.xs,
  },
});
