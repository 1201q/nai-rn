import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { renderPromptHighlights } from "../../components/highlightPromptSpans";
import { MODELS, NOISE_SCHEDULES, SAMPLERS } from "../../constants/generation";
import type { GenerationRecord } from "../../lib/generationHistory";
import { parseNaiMetadata, type ParsedNaiMetadata } from "../../lib/naiMetadata";
import { light } from "./styles";

function labelFor(
  list: ReadonlyArray<{ label: string; value: string }>,
  value: string | undefined,
) {
  if (!value) return value;
  return list.find((item) => item.value === value)?.label ?? value;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={ms.card}>
      <Text style={ms.cardLabel}>{label}</Text>
      <Text style={ms.cardInput}>{renderPromptHighlights(value)}</Text>
    </View>
  );
}

// 메타데이터 뷰어 본문(제목 없음 — 호스트 고정 헤더가 제목 담당). 파싱은 동기(useMemo).
export function MetadataViewContent({ record }: { record: GenerationRecord }) {
  const parsed = useMemo<ParsedNaiMetadata | null>(() => {
    try {
      const raw = JSON.parse(record.metadataJson) as Record<string, string>;
      return parseNaiMetadata(raw);
    } catch {
      return null;
    }
  }, [record]);

  const settingRows = useMemo(() => {
    if (!parsed) return [];
    const rows: { label: string; value: string }[] = [];
    if (parsed.model) {
      rows.push({ label: "Model", value: labelFor(MODELS, parsed.model)! });
    }
    if (parsed.resolution) {
      rows.push({
        label: "Resolution",
        value: `${parsed.resolution.width} × ${parsed.resolution.height}`,
      });
    }
    if (parsed.steps !== undefined) {
      rows.push({ label: "Steps", value: String(parsed.steps) });
    }
    if (parsed.promptGuidance !== undefined) {
      rows.push({
        label: "Prompt Guidance",
        value: String(parsed.promptGuidance),
      });
    }
    if (parsed.promptGuidanceRescale !== undefined) {
      rows.push({
        label: "Prompt Guidance Rescale",
        value: String(parsed.promptGuidanceRescale),
      });
    }
    if (parsed.noiseSchedule) {
      rows.push({
        label: "Noise Schedule",
        value: labelFor(NOISE_SCHEDULES, parsed.noiseSchedule)!,
      });
    }
    if (parsed.sampler) {
      rows.push({
        label: "Sampler",
        value: labelFor(SAMPLERS, parsed.sampler)!,
      });
    }
    if (parsed.varietyPlus !== undefined) {
      rows.push({
        label: "Variety+",
        value: parsed.varietyPlus ? "켜짐" : "꺼짐",
      });
    }
    if (parsed.seed !== undefined) {
      rows.push({ label: "Seed", value: String(parsed.seed) });
    }
    return rows;
  }, [parsed]);

  const hasPrompts = Boolean(
    parsed &&
      (parsed.prompt ||
        parsed.negativePrompt ||
        (parsed.characters && parsed.characters.length > 0)),
  );
  const isEmpty = !parsed || (!hasPrompts && settingRows.length === 0);

  if (isEmpty) {
    return <Text style={ms.emptyText}>메타데이터가 없습니다.</Text>;
  }

  return (
    <>
      {hasPrompts ? (
        <View style={ms.section}>
          <Text style={ms.sectionLabel}>프롬프트</Text>
          {parsed!.prompt ? (
            <Field label="Prompt" value={parsed!.prompt} />
          ) : null}
          {parsed!.negativePrompt ? (
            <Field
              label="Undesired Content (UC)"
              value={parsed!.negativePrompt}
            />
          ) : null}
          {parsed!.characters?.map((character, index) => (
            <View key={character.id} style={ms.character}>
              <Text style={ms.characterLabel}>캐릭터 {index + 1}</Text>
              {character.prompt ? (
                <Field label="Prompt" value={character.prompt} />
              ) : null}
              {character.negativePrompt ? (
                <Field label="UC" value={character.negativePrompt} />
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {settingRows.length > 0 ? (
        <View style={ms.section}>
          <Text style={ms.sectionLabel}>설정</Text>
          {settingRows.map((row) => (
            <View key={row.label} style={ms.settingRow}>
              <Text style={ms.settingLabel}>{row.label}</Text>
              <Text style={ms.settingValue}>{row.value}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </>
  );
}

const ms = StyleSheet.create({
  emptyText: {
    paddingVertical: 24,
    textAlign: "center",
    color: light.textHint,
    fontSize: 15,
    fontWeight: "500",
  },
  section: {
    marginTop: 4,
    marginBottom: 16,
  },
  sectionLabel: {
    color: light.purple,
    fontSize: 13,
    fontWeight: "700",
    paddingHorizontal: 4,
    paddingBottom: 10,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: light.border,
    backgroundColor: light.input,
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 8,
    marginBottom: 10,
  },
  cardLabel: {
    fontSize: 13,
    color: light.textSecondary,
  },
  cardInput: {
    fontSize: 15,
    lineHeight: 22,
    includeFontPadding: false,
    color: light.textPrimary,
    padding: 0,
  },
  character: {
    marginTop: 4,
  },
  characterLabel: {
    color: light.textHint,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 44,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: light.border,
  },
  settingLabel: {
    color: light.textSecondary,
    fontSize: 14,
    fontWeight: "600",
  },
  settingValue: {
    flexShrink: 1,
    textAlign: "right",
    color: light.textPrimary,
    fontSize: 14,
    fontWeight: "600",
  },
});
