import { memo, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";

import {
  MODELS,
  NOISE_SCHEDULES,
  SAMPLERS,
} from "../../../../constants/generation";
import type { GenerationRecord } from "../../../../lib/generationHistory";
import { parseNaiMetadataJson } from "../../../../lib/naiMetadata";
import { getUcPresetLabel } from "../../../../lib/naiPresets";
import { useGenerationChromeMetrics } from "../../../../hooks/useGenerationChromeMetrics";
import { monoFont, tokens } from "../../../../styles/tokens";

type MetadataValue = {
  label: string;
  value: string;
  accent?: boolean;
};

type PromptMode = "base" | "negative";

function optionLabel(
  options: ReadonlyArray<{ label: string; value: string }>,
  value: string,
) {
  return options.find((option) => option.value === value)?.label ?? value;
}

function formatCreatedAt(createdAt: number) {
  return new Date(createdAt).toLocaleString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const MetadataValueCell = memo(function MetadataValueCell({
  label,
  value,
  accent = false,
}: MetadataValue) {
  return (
    <View style={styles.valueCell}>
      <Text style={styles.valueLabel}>{label}</Text>
      <Text
        numberOfLines={2}
        style={[styles.valueText, accent && styles.valueTextAccent]}
      >
        {value}
      </Text>
    </View>
  );
});

const ReadonlyPromptTabs = memo(function ReadonlyPromptTabs({
  mode,
  accessibilityPrefix,
  baseLabel,
  onChange,
}: {
  mode: PromptMode;
  accessibilityPrefix?: string;
  baseLabel: string;
  onChange: (mode: PromptMode) => void;
}) {
  return (
    <View style={styles.promptTabs}>
      <Pressable
        accessibilityRole="radio"
        accessibilityLabel={
          accessibilityPrefix
            ? `${accessibilityPrefix} ${baseLabel}`
            : baseLabel
        }
        accessibilityState={{ selected: mode === "base" }}
        onPress={() => onChange("base")}
        style={({ pressed }) => [
          styles.promptTab,
          mode === "base" && styles.promptTabActive,
          pressed && styles.pressed,
        ]}
      >
        <Text
          style={[
            styles.promptTabLabel,
            mode === "base" && styles.promptTabLabelActive,
          ]}
        >
          {baseLabel}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="radio"
        accessibilityLabel={
          accessibilityPrefix
            ? `${accessibilityPrefix} Undesired Content`
            : "Undesired Content"
        }
        accessibilityState={{ selected: mode === "negative" }}
        onPress={() => onChange("negative")}
        style={({ pressed }) => [
          styles.promptTab,
          mode === "negative" && styles.promptTabActive,
          pressed && styles.pressed,
        ]}
      >
        <Text
          style={[
            styles.promptTabLabel,
            mode === "negative" && styles.negativePromptTabLabelActive,
          ]}
        >
          Undesired Content
        </Text>
      </Pressable>
    </View>
  );
});

const ReadonlyBasePrompt = memo(function ReadonlyBasePrompt({
  prompt,
  negativePrompt,
}: {
  prompt: string;
  negativePrompt: string;
}) {
  const [mode, setMode] = useState<PromptMode>("base");
  const value = mode === "base" ? prompt : negativePrompt;

  return (
    <View style={styles.basePromptCard}>
      <View style={styles.basePromptBody}>
        <ReadonlyPromptTabs
          mode={mode}
          baseLabel="Base Prompt"
          onChange={setMode}
        />
        <Text
          style={[
            styles.readonlyPromptText,
            mode === "negative" && styles.readonlyNegativePromptText,
          ]}
        >
          {value || "입력된 내용이 없습니다."}
        </Text>
      </View>
    </View>
  );
});

const ReadonlyCharacterPrompt = memo(function ReadonlyCharacterPrompt({
  index,
  prompt,
  negativePrompt,
}: {
  index: number;
  prompt: string;
  negativePrompt: string;
}) {
  const [mode, setMode] = useState<PromptMode>("base");
  const title = `Character ${index + 1}`;
  const value = mode === "base" ? prompt : negativePrompt;

  return (
    <View style={styles.characterPromptCard}>
      <View style={styles.characterPromptHeader}>
        <Text style={styles.characterPromptTitle}>{title}</Text>
      </View>
      <View style={styles.characterPromptBody}>
        <ReadonlyPromptTabs
          mode={mode}
          accessibilityPrefix={title}
          baseLabel="Prompt"
          onChange={setMode}
        />
        <Text
          style={[
            styles.readonlyPromptText,
            mode === "negative" && styles.readonlyNegativePromptText,
          ]}
        >
          {value || "입력된 내용이 없습니다."}
        </Text>
      </View>
    </View>
  );
});

export const MetadataSheetContent = memo(function MetadataSheetContent({
  generation,
}: {
  generation: GenerationRecord;
}) {
  const { sheetContentPaddingBottom } = useGenerationChromeMetrics();
  const parsed = useMemo(
    () => parseNaiMetadataJson(generation.metadataJson),
    [generation.metadataJson],
  );
  const model = parsed?.model ?? generation.model;
  const resolution = parsed?.resolution ?? {
    width: generation.width,
    height: generation.height,
  };
  const values: MetadataValue[] = [
    { label: "MODEL", value: optionLabel(MODELS, model) },
    {
      label: "RESOLUTION",
      value: `${resolution.width} x ${resolution.height}`,
    },
    { label: "STEPS", value: String(parsed?.steps ?? generation.steps) },
    {
      label: "PROMPT GUIDANCE",
      value: String(parsed?.promptGuidance ?? generation.scale),
    },
    {
      label: "CFG RESCALE",
      value: String(parsed?.promptGuidanceRescale ?? generation.cfgRescale),
    },
    {
      label: "SAMPLER",
      value: optionLabel(SAMPLERS, parsed?.sampler ?? generation.sampler),
    },
    {
      label: "NOISE SCHEDULE",
      value: optionLabel(
        NOISE_SCHEDULES,
        parsed?.noiseSchedule ?? generation.noiseSchedule,
      ),
    },
    {
      label: "SEED",
      value: String(parsed?.seed ?? generation.seed ?? "-"),
      accent: true,
    },
    {
      label: "QUALITY TAGS",
      value:
        parsed?.qualityToggle === undefined
          ? "-"
          : parsed.qualityToggle
            ? "On"
            : "Off",
      accent: parsed?.qualityToggle === true,
    },
    {
      label: "UC PRESET",
      value:
        parsed?.ucPreset === undefined
          ? "-"
          : getUcPresetLabel(parsed.ucPreset),
    },
    { label: "CREATED", value: formatCreatedAt(generation.createdAt) },
  ];
  const characters = parsed?.characters ?? [];
  const prompt = parsed?.prompt ?? generation.prompt;
  const negativePrompt = parsed?.negativePrompt ?? generation.negativePrompt;

  return (
    <BottomSheetScrollView
      testID="metadata-scroll"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingBottom: sheetContentPaddingBottom },
      ]}
    >
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>PROMPTS</Text>
        <ReadonlyBasePrompt
          prompt={prompt}
          negativePrompt={negativePrompt}
        />
        {characters.map((character, index) => (
          <ReadonlyCharacterPrompt
            key={character.id}
            index={index}
            prompt={character.prompt}
            negativePrompt={character.negativePrompt}
          />
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>GENERATION PARAMETERS</Text>
        <View style={styles.valuesGrid}>
          {values.map((item) => (
            <MetadataValueCell key={item.label} {...item} />
          ))}
        </View>
      </View>

      <Text style={styles.recordId}>
        ID {generation.id}
      </Text>
    </BottomSheetScrollView>
  );
});

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: tokens.space[8],
    paddingTop: tokens.space[8],
    gap: tokens.space[16],
  },
  section: {
    gap: tokens.space[6],
  },
  sectionTitle: {
    paddingHorizontal: tokens.space[2],
    color: tokens.color.textMuted,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type["3xs"],
    letterSpacing: tokens.tracking.wide,
  },
  basePromptCard: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: tokens.color.promptBorder,
    borderRadius: 20,
    backgroundColor: "#100F13",
  },
  basePromptBody: {
    padding: 15,
  },
  promptTabs: {
    height: 30,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  promptTab: {
    minHeight: 30,
    paddingHorizontal: 8,
    borderRadius: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  promptTabActive: {
    backgroundColor: tokens.color.card,
  },
  promptTabLabel: {
    color: tokens.color.textMuted,
    fontFamily: tokens.font.semibold,
    fontSize: 13,
  },
  promptTabLabelActive: {
    color: tokens.color.textPrimary,
  },
  negativePromptTabLabelActive: {
    color: tokens.color.negative,
  },
  readonlyPromptText: {
    minHeight: 72,
    padding: 0,
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.regular,
    fontSize: 15,
    lineHeight: 23,
  },
  readonlyNegativePromptText: {
    color: tokens.color.textSecondary,
  },
  characterPromptCard: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: tokens.color.promptBorder,
    borderRadius: 16,
    backgroundColor: "#100F13",
  },
  characterPromptHeader: {
    height: 40,
    paddingHorizontal: 14,
    justifyContent: "center",
    backgroundColor: tokens.color.raised,
  },
  characterPromptTitle: {
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.semibold,
    fontSize: 15,
  },
  characterPromptBody: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
  },
  valuesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.space[4],
  },
  valueCell: {
    width: "48%",
    minHeight: 72,
    paddingHorizontal: tokens.space[7],
    paddingVertical: tokens.space[6],
    borderRadius: tokens.radius.md,
    justifyContent: "space-between",
    gap: tokens.space[4],
    backgroundColor: tokens.color.card,
  },
  valueLabel: {
    color: tokens.color.textMuted,
    fontFamily: tokens.font.semibold,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  valueText: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.medium,
    fontSize: tokens.type.xs,
  },
  valueTextAccent: {
    color: tokens.color.accent,
  },
  pressed: {
    opacity: 0.65,
  },
  recordId: {
    paddingHorizontal: tokens.space[2],
    color: tokens.color.textMuted,
    fontFamily: monoFont,
    fontSize: 10,
  },
});
