import { memo, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";

import { NOISE_SCHEDULES, SAMPLERS } from "../../../../constants/generation";
import { MODELS } from "../../../../constants/models";
import type { GenerationRecord } from "../../../../lib/generationHistory";
import { parseNaiMetadataJson } from "../../../../lib/naiMetadata";
import {
  getQualityPresetLabel,
  getUcPresetLabel,
} from "../../../../lib/naiPresets";
import { monoFont, tokens } from "../../../../styles/tokens";
import { PromptHighlightTextInput } from "../../../../components/forms/PromptHighlightTextInput";
import {
  MetadataFloatingButton,
  useMetadataFloatingInset,
} from "./MetadataFloatingButton";

export type MetadataSheetSource = GenerationRecord | { metadataJson: string };

type MetadataValue = {
  label: string;
  value: string;
  copyable?: boolean;
};

export function optionLabel(
  options: ReadonlyArray<{ label: string; value: string }>,
  value: string | undefined,
) {
  return (
    options.find((option) => option.value === value)?.label ?? value ?? "-"
  );
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

// Android는 복사하면 시스템이 직접 알려주므로 따로 토스트를 띄우지 않는다.
function copyText(value: string) {
  void Clipboard.setStringAsync(value);
}

const MetadataValueRow = memo(function MetadataValueRow({
  label,
  value,
  copyable = false,
  first,
}: MetadataValue & { first: boolean }) {
  const content = (
    <>
      <Text style={styles.valueLabel}>{label}</Text>
      <View style={styles.valueContent}>
        <Text numberOfLines={1} style={styles.valueText}>
          {value}
        </Text>
        {copyable ? (
          <Ionicons
            name="copy-outline"
            size={14}
            color={tokens.color.textTertiary}
          />
        ) : null}
      </View>
    </>
  );

  return copyable ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} 복사`}
      onPress={() => copyText(value)}
      style={({ pressed }) => [
        styles.valueRow,
        !first && styles.divided,
        pressed && styles.pressed,
      ]}
    >
      {content}
    </Pressable>
  ) : (
    <View style={[styles.valueRow, !first && styles.divided]}>{content}</View>
  );
});

// 읽기 전용 프롬프트 한 덩어리: 라벨, 복사 버튼, 하이라이트된 본문.
const ReadonlyPromptBlock = memo(function ReadonlyPromptBlock({
  label,
  accessibilityPrefix,
  value,
  negative = false,
  first,
}: {
  label: string;
  accessibilityPrefix?: string;
  value: string;
  negative?: boolean;
  first: boolean;
}) {
  const name = accessibilityPrefix ? `${accessibilityPrefix} ${label}` : label;

  return (
    <View style={[styles.promptBlock, !first && styles.divided]}>
      <View style={styles.promptBlockHead}>
        <Text style={styles.promptBlockLabel}>{label}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${name} 복사`}
          accessibilityState={{ disabled: !value }}
          disabled={!value}
          onPress={() => copyText(value)}
          style={({ pressed }) => [
            styles.copyButton,
            (pressed || !value) && styles.pressed,
          ]}
        >
          <Ionicons
            name="copy-outline"
            size={16}
            color={tokens.color.textTertiary}
          />
        </Pressable>
      </View>
      {value ? (
        <PromptHighlightTextInput
          accessibilityLabel={`${name} text`}
          caretHidden
          editable={false}
          multiline
          scrollEnabled={false}
          showSoftInputOnFocus={false}
          textAlignVertical="top"
          style={[
            styles.readonlyPromptText,
            negative && styles.readonlyNegativePromptText,
          ]}
          value={value}
        />
      ) : (
        <Text style={[styles.readonlyPromptText, styles.readonlyPromptEmpty]}>
          없음
        </Text>
      )}
    </View>
  );
});

export const MetadataSheetContent = memo(function MetadataSheetContent({
  generation,
  onImport,
}: {
  generation: Partial<GenerationRecord> & { metadataJson: string };
  onImport: () => void;
}) {
  const floatingInset = useMetadataFloatingInset();
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
    { label: "Model", value: optionLabel(MODELS, model) },
    {
      label: "Resolution",
      value:
        resolution.width && resolution.height
          ? `${resolution.width} x ${resolution.height}`
          : "-",
    },
    { label: "Steps", value: String(parsed?.steps ?? generation.steps ?? "-") },
    {
      label: "Prompt Guidance",
      value: String(parsed?.promptGuidance ?? generation.scale ?? "-"),
    },
    {
      label: "Prompt Guidance Rescale",
      value: String(
        parsed?.promptGuidanceRescale ?? generation.cfgRescale ?? "-",
      ),
    },
    {
      label: "Sampler",
      value: optionLabel(SAMPLERS, parsed?.sampler ?? generation.sampler),
    },
    {
      label: "Noise Schedule",
      value: optionLabel(
        NOISE_SCHEDULES,
        parsed?.noiseSchedule ?? generation.noiseSchedule,
      ),
    },
    {
      label: "Seed",
      value: String(parsed?.seed ?? generation.seed ?? "-"),
      copyable: (parsed?.seed ?? generation.seed) != null,
    },
    {
      label: "Quality Tags",
      value:
        parsed?.qualityPreset === undefined
          ? "-"
          : getQualityPresetLabel(parsed.qualityPreset),
    },
    {
      label: "UC Preset",
      value:
        parsed?.ucPreset === undefined
          ? "-"
          : getUcPresetLabel(parsed.ucPreset),
    },
    ...(generation.createdAt === undefined
      ? []
      : [{ label: "Created", value: formatCreatedAt(generation.createdAt) }]),
  ];
  const characters = parsed?.characters ?? [];
  const prompt = parsed?.prompt ?? generation.prompt ?? "";
  const negativePrompt =
    parsed?.negativePrompt ?? generation.negativePrompt ?? "";

  return (
    <View style={styles.container}>
      <BottomSheetScrollView
        testID="metadata-scroll"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: floatingInset },
        ]}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PROMPTS</Text>
          <View style={styles.card}>
            <ReadonlyPromptBlock first label="Base Prompt" value={prompt} />
            <ReadonlyPromptBlock
              first={false}
              label="Undesired Content"
              value={negativePrompt}
              negative
            />
          </View>
          {characters.map((character, index) => {
            const title = `Character ${index + 1}`;
            return (
              <View key={character.id} style={styles.card}>
                <Text style={styles.characterTitle}>{title}</Text>
                <ReadonlyPromptBlock
                  first
                  label="Prompt"
                  accessibilityPrefix={title}
                  value={character.prompt}
                />
                {character.negativePrompt ? (
                  <ReadonlyPromptBlock
                    first={false}
                    label="Undesired Content"
                    accessibilityPrefix={title}
                    value={character.negativePrompt}
                    negative
                  />
                ) : null}
              </View>
            );
          })}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>GENERATION PARAMETERS</Text>
          <View style={styles.card}>
            {values.map((item, index) => (
              <MetadataValueRow
                key={item.label}
                first={index === 0}
                {...item}
              />
            ))}
          </View>
        </View>

        {generation.id ? (
          <Text style={styles.recordId}>ID {generation.id}</Text>
        ) : null}
      </BottomSheetScrollView>
      <MetadataFloatingButton
        label="설정으로 가져오기"
        icon="download-outline"
        onPress={onImport}
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
    gap: tokens.space[12],
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
  characterTitle: {
    paddingTop: tokens.space[7],
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type.base,
  },
  promptBlock: {
    paddingTop: tokens.space[4],
    paddingBottom: tokens.space[7],
  },
  promptBlockHead: {
    height: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  promptBlockLabel: {
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type["2xs"],
  },
  copyButton: {
    width: 32,
    height: 32,
    marginRight: -8,
    alignItems: "center",
    justifyContent: "center",
  },
  readonlyPromptText: {
    padding: 0,
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.regular,
    fontSize: 15,
    lineHeight: 23,
  },
  readonlyNegativePromptText: {
    color: tokens.color.textSecondary,
  },
  readonlyPromptEmpty: {
    color: tokens.color.textMuted,
  },
  valueRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.space[8],
  },
  valueLabel: {
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.regular,
    fontSize: tokens.type.sm,
  },
  valueContent: {
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space[3],
  },
  valueText: {
    flexShrink: 1,
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.medium,
    fontSize: tokens.type.sm,
  },
  pressed: {
    opacity: tokens.opacity.pressed,
  },
  recordId: {
    paddingHorizontal: tokens.space[2],
    color: tokens.color.textMuted,
    fontFamily: monoFont,
    fontSize: 10,
  },
});
