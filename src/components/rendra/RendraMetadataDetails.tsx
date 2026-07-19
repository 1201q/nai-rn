import { StyleSheet, Text, View } from "react-native";

import { MODELS, NOISE_SCHEDULES, SAMPLERS } from "../../constants/generation";
import type { ParsedNaiMetadata } from "../../lib/naiMetadata";
import { getUcPresetLabel } from "../../lib/naiPresets";
import { tokens } from "../../styles/tokens";

type SettingRow = {
  label: string;
  value: string;
  active?: boolean;
};

type MetadataSection = {
  key: string;
  label: string;
  value: string;
  negative?: boolean;
};

type MetadataDetailsVariant = "page" | "sheet";

function listLabel(
  items: ReadonlyArray<{ label: string; value: string }>,
  value: string | undefined,
) {
  if (!value) return "—";
  return items.find((item) => item.value === value)?.label ?? value;
}

function fixedValue(value: number | undefined, precision: number) {
  return value === undefined ? "—" : value.toFixed(precision);
}

function MetadataTextSection({
  label,
  value,
  negative = false,
  variant,
  first,
}: {
  label: string;
  value: string;
  negative?: boolean;
  variant: MetadataDetailsVariant;
  first: boolean;
}) {
  return (
    <View
      style={[
        styles.textSection,
        variant === "sheet" && styles.sheetSection,
        variant === "sheet" && first && styles.sheetFirstSection,
      ]}
    >
      <Text
        style={[
          styles.sectionLabel,
          variant === "sheet" && styles.sheetSectionLabel,
        ]}
      >
        {label}
      </Text>
      <View style={[styles.textCard, negative && styles.textCardNegative]}>
        <Text style={styles.metadataText}>{value}</Text>
      </View>
    </View>
  );
}

function MetadataSettingsCard({
  parsed,
  emptyHint,
  variant,
  first,
}: {
  parsed: ParsedNaiMetadata | null;
  emptyHint: string;
  variant: MetadataDetailsVariant;
  first: boolean;
}) {
  const rows: SettingRow[] = [
    { label: "Model", value: listLabel(MODELS, parsed?.model) },
    {
      label: "Resolution",
      value: parsed?.resolution
        ? `${parsed.resolution.width}x${parsed.resolution.height}`
        : "—",
    },
    { label: "Steps", value: parsed?.steps?.toString() ?? "—" },
    {
      label: "CFG Scale",
      value: fixedValue(parsed?.promptGuidance, 1),
    },
    {
      label: "CFG Rescale",
      value: fixedValue(parsed?.promptGuidanceRescale, 2),
    },
    { label: "Sampler", value: listLabel(SAMPLERS, parsed?.sampler) },
    {
      label: "Schedule",
      value: listLabel(NOISE_SCHEDULES, parsed?.noiseSchedule),
    },
    {
      label: "Variety+",
      value:
        parsed?.varietyPlus === undefined
          ? "—"
          : parsed.varietyPlus
            ? "On"
            : "Off",
      active: parsed?.varietyPlus === true,
    },
    {
      label: "Quality Tags",
      value:
        parsed?.qualityToggle === undefined
          ? "—"
          : parsed.qualityToggle
            ? "On"
            : "Off",
      active: parsed?.qualityToggle === true,
    },
    {
      label: "UC Preset",
      value:
        parsed?.ucPreset === undefined
          ? "—"
          : getUcPresetLabel(parsed.ucPreset),
    },
    { label: "Seed", value: parsed?.seed?.toString() ?? "—" },
  ];

  return (
    <View
      style={[
        styles.settingsSection,
        variant === "sheet" && styles.sheetSection,
        variant === "sheet" && first && styles.sheetFirstSection,
      ]}
    >
      <Text
        style={[
          styles.sectionLabel,
          variant === "sheet" && styles.sheetSectionLabel,
        ]}
      >
        SETTINGS
      </Text>
      <View style={styles.settingsCard}>
        {rows.map((row) => (
          <View key={row.label} style={styles.settingRow}>
            <Text style={styles.settingLabel}>{row.label}</Text>
            <Text
              style={[
                styles.settingValue,
                row.active && styles.settingValueActive,
              ]}
              numberOfLines={1}
            >
              {row.value}
            </Text>
          </View>
        ))}
        {!parsed ? (
          <Text style={styles.emptyHint}>{emptyHint}</Text>
        ) : null}
      </View>
    </View>
  );
}

export function RendraMetadataDetails({
  parsed,
  emptyHint = "표시할 메타데이터가 없습니다.",
  variant = "page",
}: {
  parsed: ParsedNaiMetadata | null;
  emptyHint?: string;
  variant?: MetadataDetailsVariant;
}) {
  const sections: MetadataSection[] = [];

  if (parsed?.prompt) {
    sections.push({ key: "prompt", label: "PROMPT", value: parsed.prompt });
  }
  if (parsed?.negativePrompt) {
    sections.push({
      key: "negative-prompt",
      label: "NEGATIVE PROMPT",
      value: parsed.negativePrompt,
      negative: true,
    });
  }
  const characters = parsed?.characters ?? [];
  characters.forEach((character, index) => {
    const characterLabel =
      characters.length > 1 ? `CHARACTER ${index + 1}` : "CHARACTER";

    if (character.prompt) {
      sections.push({
        key: `${character.id}-prompt`,
        label: `${characterLabel} PROMPT`,
        value: character.prompt,
      });
    }
    if (character.negativePrompt) {
      sections.push({
        key: `${character.id}-negative-prompt`,
        label: `${characterLabel} NEGATIVE PROMPT`,
        value: character.negativePrompt,
        negative: true,
      });
    }
  });

  return (
    <View style={variant === "sheet" ? styles.sheetContent : undefined}>
      {sections.map((section, index) => (
        <MetadataTextSection
          key={section.key}
          label={section.label}
          value={section.value}
          negative={section.negative}
          variant={variant}
          first={index === 0}
        />
      ))}

      <MetadataSettingsCard
        parsed={parsed}
        emptyHint={emptyHint}
        variant={variant}
        first={sections.length === 0}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  textSection: {
    marginTop: tokens.space[16],
    gap: tokens.space[6],
  },
  sectionLabel: {
    paddingHorizontal: tokens.space[2],
    color: tokens.color.textMuted,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type["3xs"],
    letterSpacing: tokens.tracking.wide,
  },
  textCard: {
    paddingHorizontal: tokens.space[9],
    paddingVertical: tokens.space[9],
    borderRadius: tokens.radius.xl,
    backgroundColor: tokens.color.card,
  },
  textCardNegative: {
    borderWidth: 1,
    borderColor: tokens.color.borderNegative,
  },
  metadataText: {
    color: tokens.color.textSecondary,
    fontFamily: tokens.font.regular,
    fontSize: tokens.type.sm,
    lineHeight: 21,
  },
  settingsSection: {
    marginTop: tokens.space[16],
    gap: tokens.space[6],
  },
  sheetContent: {
    paddingHorizontal: tokens.space[12] - tokens.space[1],
  },
  sheetSection: {
    marginTop: tokens.space[12],
  },
  sheetFirstSection: {
    marginTop: 0,
  },
  sheetSectionLabel: {
    paddingHorizontal: tokens.space[1],
  },
  settingsCard: {
    paddingHorizontal: tokens.space[9],
    paddingVertical: tokens.space[7],
    borderRadius: tokens.radius.xl,
    backgroundColor: tokens.color.card,
  },
  settingRow: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.space[8],
  },
  settingLabel: {
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.medium,
    fontSize: tokens.type.sm,
  },
  settingValue: {
    flex: 1,
    textAlign: "right",
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.medium,
    fontSize: tokens.type.sm,
  },
  settingValueActive: {
    color: tokens.color.accent,
  },
  emptyHint: {
    marginTop: tokens.space[5],
    color: tokens.color.textMuted,
    fontFamily: tokens.font.regular,
    fontSize: tokens.type["2xs"],
    lineHeight: 18,
  },
});
