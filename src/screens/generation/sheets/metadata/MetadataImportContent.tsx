import { memo, useMemo, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import { toast } from "sonner-native";

import type { GenerationRecord } from "../../../../lib/generationHistory";
import {
  parseNaiMetadataJson,
  type ParsedNaiMetadata,
} from "../../../../lib/naiMetadata";
import {
  createMetadataImportSelection,
  getMetadataImportAvailability,
  hasSelectedMetadataImport,
  type MetadataCharacterImportMode,
  type MetadataImportSelection,
} from "../../../../lib/metadataImport";
import { useGenerationChromeMetrics } from "../../../../hooks/useGenerationChromeMetrics";
import { useGenerationStore } from "../../../../store/generationStore";
import { tokens } from "../../../../styles/tokens";

type ImportSelectionKey =
  | "prompt"
  | "negativePrompt"
  | "characters"
  | "settings"
  | "seed";

type ImportOption = {
  key: ImportSelectionKey;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
};

function resolveImportMetadata(generation: GenerationRecord): ParsedNaiMetadata {
  const parsed = parseNaiMetadataJson(generation.metadataJson);
  return {
    raw: parsed?.raw ?? {},
    prompt: parsed?.prompt ?? generation.prompt,
    negativePrompt: parsed?.negativePrompt ?? generation.negativePrompt,
    characters: parsed?.characters,
    model: generation.model,
    resolution: parsed?.resolution ?? {
      label: "Current image",
      width: generation.width,
      height: generation.height,
    },
    steps: generation.steps,
    promptGuidance: generation.scale,
    promptGuidanceRescale: generation.cfgRescale,
    noiseSchedule: generation.noiseSchedule,
    sampler: generation.sampler,
    varietyPlus: parsed?.varietyPlus,
    qualityToggle: parsed?.qualityToggle,
    ucPreset: parsed?.ucPreset,
    seed: parsed?.seed ?? generation.seed ?? undefined,
    hasSettings: true,
  };
}

const ImportOptionCard = memo(function ImportOptionCard({
  option,
  selected,
  onChange,
  children,
}: {
  option: ImportOption;
  selected: boolean;
  onChange: (selected: boolean) => void;
  children?: ReactNode;
}) {
  return (
    <View style={[styles.optionCard, selected && styles.optionCardSelected]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={option.label}
        accessibilityState={{ checked: selected }}
        onPress={() => onChange(!selected)}
        style={({ pressed }) => [
          styles.optionRow,
          pressed && styles.pressed,
        ]}
      >
        <View style={[styles.optionIcon, selected && styles.optionIconSelected]}>
          <Ionicons
            name={option.icon}
            size={18}
            color={selected ? tokens.color.accent : tokens.color.textTertiary}
          />
        </View>
        <View style={styles.optionCopy}>
          <Text style={styles.optionLabel}>{option.label}</Text>
          <Text style={styles.optionDescription}>{option.description}</Text>
        </View>
        <View style={[styles.checkBox, selected && styles.checkBoxSelected]}>
          {selected ? (
            <Ionicons
              name="checkmark"
              size={15}
              color={tokens.color.onAccent}
            />
          ) : null}
        </View>
      </Pressable>
      {children}
    </View>
  );
});

const CharacterImportMode = memo(function CharacterImportMode({
  value,
  onChange,
}: {
  value: MetadataCharacterImportMode;
  onChange: (value: MetadataCharacterImportMode) => void;
}) {
  return (
    <View style={styles.characterModeArea}>
      <Text style={styles.characterModeTitle}>적용 방식</Text>
      <View style={styles.characterModeControl}>
        {(["replace", "append"] as const).map((mode) => {
          const selected = value === mode;
          return (
            <Pressable
              key={mode}
              accessibilityRole="radio"
              accessibilityLabel={mode === "replace" ? "Replace" : "Append"}
              accessibilityState={{ selected }}
              onPress={() => onChange(mode)}
              style={({ pressed }) => [
                styles.characterModeOption,
                selected && styles.characterModeOptionSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.characterModeLabel,
                  selected && styles.characterModeLabelSelected,
                ]}
              >
                {mode === "replace" ? "Replace" : "Append"}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.characterModeHint}>
        {value === "replace"
          ? "현재 캐릭터 프롬프트를 교체합니다."
          : "현재 목록 뒤에 캐릭터 프롬프트를 추가합니다."}
      </Text>
    </View>
  );
});

export const MetadataImportContent = memo(function MetadataImportContent({
  generation,
  onImported,
}: {
  generation: GenerationRecord;
  onImported: () => void;
}) {
  const { sheetContentPaddingBottom } = useGenerationChromeMetrics();
  const applyMetadataImport = useGenerationStore(
    (state) => state.applyMetadataImport,
  );
  const parsed = useMemo(
    () => resolveImportMetadata(generation),
    [generation],
  );
  const available = useMemo(
    () => getMetadataImportAvailability(parsed),
    [parsed],
  );
  const [selection, setSelection] = useState<MetadataImportSelection>(() =>
    createMetadataImportSelection(parsed),
  );
  const options = useMemo<ImportOption[]>(
    () => [
      {
        key: "prompt",
        label: "Prompt",
        description: "Base Prompt를 가져옵니다.",
        icon: "create-outline",
      },
      {
        key: "negativePrompt",
        label: "Undesired Content",
        description: "Negative Prompt와 UC를 가져옵니다.",
        icon: "remove-circle-outline",
      },
      {
        key: "characters",
        label: "Character Prompts",
        description: `${parsed.characters?.length ?? 0}개의 캐릭터 프롬프트`,
        icon: "people-outline",
      },
      {
        key: "settings",
        label: "Generation Settings",
        description: "Model, Resolution, Sampling 설정",
        icon: "options-outline",
      },
      {
        key: "seed",
        label: "Seed",
        description: parsed.seed === undefined ? "Seed 정보 없음" : String(parsed.seed),
        icon: "dice-outline",
      },
    ],
    [parsed.characters?.length, parsed.seed],
  );
  const canImport = hasSelectedMetadataImport(selection, available);

  function updateSelection(key: ImportSelectionKey, selected: boolean) {
    setSelection((current) => ({ ...current, [key]: selected }));
  }

  function handleImport() {
    if (!canImport) return;
    applyMetadataImport(parsed, selection);
    toast.success("메타데이터를 가져왔습니다.");
    onImported();
  }

  return (
    <BottomSheetScrollView
      testID="metadata-import-scroll"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingBottom: sheetContentPaddingBottom },
      ]}
    >
      <View style={styles.intro}>
        <Text style={styles.introTitle}>가져올 항목 선택</Text>
        <Text style={styles.introDescription}>
          현재 이미지에 저장된 값을 생성 설정에 적용합니다.
        </Text>
      </View>

      <View style={styles.options}>
        {options.map((option) =>
          available[option.key] ? (
            <ImportOptionCard
              key={option.key}
              option={option}
              selected={selection[option.key]}
              onChange={(selected) => updateSelection(option.key, selected)}
            >
              {option.key === "characters" && selection.characters ? (
                <CharacterImportMode
                  value={selection.characterMode}
                  onChange={(characterMode) =>
                    setSelection((current) => ({
                      ...current,
                      characterMode,
                    }))
                  }
                />
              ) : null}
            </ImportOptionCard>
          ) : null,
        )}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="선택 항목 가져오기"
        accessibilityState={{ disabled: !canImport }}
        disabled={!canImport}
        onPress={handleImport}
        style={({ pressed }) => [
          styles.importButton,
          !canImport && styles.importButtonDisabled,
          pressed && canImport && styles.pressed,
        ]}
      >
        <Ionicons name="download-outline" size={18} color={tokens.color.onAccent} />
        <Text style={styles.importButtonLabel}>선택 항목 가져오기</Text>
      </Pressable>
    </BottomSheetScrollView>
  );
});

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: tokens.space[8],
    paddingTop: tokens.space[8],
    gap: tokens.space[8],
  },
  intro: {
    paddingHorizontal: tokens.space[2],
    gap: tokens.space[2],
  },
  introTitle: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type.lg,
    letterSpacing: -0.2,
  },
  introDescription: {
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.regular,
    fontSize: tokens.type.xs,
    lineHeight: 19,
  },
  options: {
    gap: tokens.space[5],
  },
  optionCard: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: tokens.color.promptBorder,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.card,
  },
  optionCardSelected: {
    borderColor: "rgba(255,201,60,0.22)",
  },
  optionRow: {
    minHeight: 72,
    paddingHorizontal: tokens.space[7],
    paddingVertical: tokens.space[6],
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space[6],
  },
  optionIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.raised,
  },
  optionIconSelected: {
    backgroundColor: "rgba(255,201,60,0.1)",
  },
  optionCopy: {
    flex: 1,
    gap: tokens.space[1],
  },
  optionLabel: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type.base,
  },
  optionDescription: {
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.regular,
    fontSize: tokens.type["2xs"],
  },
  checkBox: {
    width: 24,
    height: 24,
    borderWidth: 1,
    borderColor: tokens.color.borderSubtleStrong,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.sunken,
  },
  checkBoxSelected: {
    borderColor: tokens.color.accent,
    backgroundColor: tokens.color.accent,
  },
  characterModeArea: {
    paddingHorizontal: tokens.space[7],
    paddingBottom: tokens.space[7],
    gap: tokens.space[4],
  },
  characterModeTitle: {
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.medium,
    fontSize: tokens.type["2xs"],
  },
  characterModeControl: {
    height: 40,
    padding: 4,
    borderRadius: tokens.radius.md,
    flexDirection: "row",
    gap: 4,
    backgroundColor: tokens.color.sunken,
  },
  characterModeOption: {
    flex: 1,
    borderRadius: tokens.radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  characterModeOptionSelected: {
    backgroundColor: tokens.color.raised,
  },
  characterModeLabel: {
    color: tokens.color.textMuted,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type.xs,
  },
  characterModeLabelSelected: {
    color: tokens.color.textPrimary,
  },
  characterModeHint: {
    color: tokens.color.textMuted,
    fontFamily: tokens.font.regular,
    fontSize: tokens.type["2xs"],
  },
  importButton: {
    height: 52,
    borderRadius: tokens.radius.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.space[4],
    backgroundColor: tokens.color.accent,
  },
  importButtonDisabled: {
    opacity: 0.4,
  },
  importButtonLabel: {
    color: tokens.color.onAccent,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type.base,
  },
  pressed: {
    opacity: 0.65,
  },
});
