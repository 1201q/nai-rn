import { memo, useMemo, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import { toast } from "sonner-native";

import { SAMPLERS } from "../../../../constants/generation";
import { MODELS } from "../../../../constants/models";
import { optionLabel, type MetadataSheetSource } from "./MetadataSheetContent";
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
import { useGenerationStore } from "../../../../store/generationStore";
import { tokens } from "../../../../styles/tokens";
import {
  MetadataFloatingButton,
  useMetadataFloatingInset,
} from "./MetadataFloatingButton";

type ImportSelectionKey =
  "prompt" | "negativePrompt" | "characters" | "settings" | "seed";

type ImportOption = {
  key: ImportSelectionKey;
  label: string;
  // 실제로 가져올 값을 한 줄로 보여준다.
  preview: string;
};

function resolveImportMetadata(
  generation: MetadataSheetSource,
): ParsedNaiMetadata {
  const parsed = parseNaiMetadataJson(generation.metadataJson);
  if (!("id" in generation)) return parsed ?? { raw: {}, hasSettings: false };
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
    qualityPreset: parsed?.qualityPreset,
    transparentBackground: parsed?.transparentBackground,
    ucPreset: parsed?.ucPreset,
    seed: parsed?.seed ?? generation.seed ?? undefined,
    hasSettings: true,
  };
}

function settingsPreview(parsed: ParsedNaiMetadata) {
  return [
    parsed.model === undefined ? null : optionLabel(MODELS, parsed.model),
    parsed.resolution
      ? `${parsed.resolution.width} x ${parsed.resolution.height}`
      : null,
    parsed.steps === undefined ? null : `${parsed.steps} steps`,
    parsed.sampler === undefined ? null : optionLabel(SAMPLERS, parsed.sampler),
  ]
    .filter(Boolean)
    .join(" · ");
}

const ImportOptionRow = memo(function ImportOptionRow({
  option,
  selected,
  first,
  onChange,
  children,
}: {
  option: ImportOption;
  selected: boolean;
  first: boolean;
  onChange: (selected: boolean) => void;
  children?: ReactNode;
}) {
  return (
    <View style={!first && styles.divided}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={option.label}
        accessibilityState={{ checked: selected }}
        onPress={() => onChange(!selected)}
        style={({ pressed }) => [styles.optionRow, pressed && styles.pressed]}
      >
        <View style={[styles.checkBox, selected && styles.checkBoxSelected]}>
          {selected ? (
            <Ionicons
              name="checkmark"
              size={14}
              color={tokens.color.onAccent}
            />
          ) : null}
        </View>
        <View style={styles.optionCopy}>
          <Text style={styles.optionLabel}>{option.label}</Text>
          <Text numberOfLines={1} style={styles.optionPreview}>
            {option.preview || "없음"}
          </Text>
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
  generation: MetadataSheetSource;
  onImported: () => void;
}) {
  const floatingInset = useMetadataFloatingInset();
  const applyMetadataImport = useGenerationStore(
    (state) => state.applyMetadataImport,
  );
  const parsed = useMemo(() => resolveImportMetadata(generation), [generation]);
  const available = useMemo(
    () => getMetadataImportAvailability(parsed),
    [parsed],
  );
  const [selection, setSelection] = useState<MetadataImportSelection>(() =>
    createMetadataImportSelection(parsed),
  );
  const options = useMemo(() => {
    const all: ImportOption[] = [
      { key: "prompt", label: "Prompt", preview: parsed.prompt ?? "" },
      {
        key: "negativePrompt",
        label: "Undesired Content",
        preview: parsed.negativePrompt ?? "",
      },
      {
        key: "characters",
        label: "Character Prompts",
        preview: (parsed.characters ?? [])
          .map((_, index) => `Character ${index + 1}`)
          .join(", "),
      },
      {
        key: "settings",
        label: "Generation Settings",
        preview: settingsPreview(parsed),
      },
      {
        key: "seed",
        label: "Seed",
        preview: parsed.seed === undefined ? "" : String(parsed.seed),
      },
    ];
    return all.filter((option) => available[option.key]);
  }, [available, parsed]);
  const canImport = hasSelectedMetadataImport(selection, available);
  const selectedCount = options.filter(
    (option) => selection[option.key],
  ).length;

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
    <View style={styles.container}>
      <BottomSheetScrollView
        testID="metadata-import-scroll"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: floatingInset },
        ]}
      >
        <Text style={styles.lead}>
          현재 이미지에 저장된 값을 생성 설정에 적용합니다.
        </Text>

        <View style={styles.card}>
          {options.map((option, index) => (
            <ImportOptionRow
              key={option.key}
              option={option}
              first={index === 0}
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
            </ImportOptionRow>
          ))}
        </View>
      </BottomSheetScrollView>
      <MetadataFloatingButton
        primary
        label={
          canImport
            ? `${selectedCount}개 항목 가져오기`
            : "가져올 항목을 선택하세요"
        }
        disabled={!canImport}
        onPress={handleImport}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: tokens.space[8],
    paddingTop: tokens.space[8],
    gap: tokens.space[8],
  },
  lead: {
    paddingHorizontal: tokens.space[2],
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.regular,
    fontSize: tokens.type.xs,
    lineHeight: 19,
  },
  card: {
    paddingHorizontal: tokens.space[8],
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: tokens.color.promptBorder,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.promptSurface,
  },
  divided: {
    borderTopWidth: 1,
    borderTopColor: tokens.color.borderSubtle,
  },
  optionRow: {
    minHeight: 60,
    paddingVertical: tokens.space[5],
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space[6],
  },
  optionCopy: {
    flex: 1,
    minWidth: 0,
    gap: tokens.space[1],
  },
  optionLabel: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type.base,
  },
  optionPreview: {
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.regular,
    fontSize: tokens.type.xs,
  },
  checkBox: {
    width: 22,
    height: 22,
    borderWidth: 1,
    borderColor: tokens.color.borderSubtleStrong,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.card,
  },
  checkBoxSelected: {
    borderColor: tokens.color.accent,
    backgroundColor: tokens.color.accent,
  },
  // 체크박스(22) + 간격(12)만큼 들여 라벨과 맞춘다.
  characterModeArea: {
    paddingLeft: 34,
    paddingBottom: tokens.space[7],
    gap: tokens.space[4],
  },
  characterModeControl: {
    height: 40,
    padding: 4,
    borderRadius: tokens.radius.md,
    flexDirection: "row",
    gap: 4,
    backgroundColor: tokens.color.card,
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
  pressed: {
    opacity: tokens.opacity.pressed,
  },
});
