import { Fragment, useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Line } from "react-native-svg";

import { IconButton } from "../../components/common/Buttons";
import { TapFeedbackPressable } from "../../components/common/TapFeedbackPressable";
import {
  MODELS,
  NOISE_SCHEDULES,
  SAMPLERS,
  type NoiseSchedule,
} from "../../constants/generation";
import {
  UC_PRESET_OPTIONS,
  type SelectableUcPresetIndex,
  type UcPresetIndex,
} from "../../lib/naiPresets";
import { useGenerationStore } from "../../store/generationStore";
import { tokens } from "../../styles/tokens";

type GenerationOptionRoute = "model" | "sampler" | "schedule" | "ucPreset";
type OptionValue = string | UcPresetIndex;
type PageOption = {
  label: string;
  value: OptionValue;
  recommended?: boolean;
  legacy?: boolean;
};

const PAGE_TITLES: Record<GenerationOptionRoute, string> = {
  model: "Model",
  sampler: "Sampler",
  schedule: "Schedule",
  ucPreset: "UC Preset",
};

const OPTION_DESCRIPTIONS: Partial<Record<GenerationOptionRoute, string>> = {
  model:
    "생성에 사용할 AI 모델입니다. V4.5 Full은 표현 범위가 넓고, Curated는 더 정제되고 예측 가능한 결과에 적합합니다. 일부 고급 기능은 V4 또는 V4.5에서만 사용할 수 있습니다.",
  sampler:
    "노이즈를 이미지로 바꾸는 계산 방식입니다. 같은 설정에서도 질감과 안정성이 달라질 수 있습니다. 잘 모르겠다면 Euler Ancestral 또는 DPM++ 2M을 권장합니다.",
  schedule:
    "Steps를 노이즈 구간에 배분하는 방식입니다. Karras는 무난한 기본값, Exponential은 다중 스텝 샘플러, Polyexponential은 손가락 같은 작은 디테일에 적합합니다.",
};

function resolveRoute(
  value: string | string[] | undefined,
): GenerationOptionRoute {
  const route = Array.isArray(value) ? value[0] : value;
  if (
    route === "model" ||
    route === "sampler" ||
    route === "schedule" ||
    route === "ucPreset"
  ) {
    return route;
  }
  return "model";
}

function toPageOption(
  option: { label: string; value: OptionValue },
  recommendedValue?: OptionValue,
): PageOption {
  const legacy = option.label.endsWith(" (Legacy)");
  return {
    label: legacy ? option.label.slice(0, -" (Legacy)".length) : option.label,
    value: option.value,
    recommended: option.value === recommendedValue,
    legacy,
  };
}

function SelectionRow({
  option,
  selected,
  showDivider,
  onSelect,
}: {
  option: PageOption;
  selected: boolean;
  showDivider: boolean;
  onSelect: (value: OptionValue) => void;
}) {
  return (
    <TapFeedbackPressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={option.label}
      onPress={() => onSelect(option.value)}
      style={styles.optionRow}
      contentStyle={styles.optionRowTapContent}
      decoration={
        showDivider ? <View style={styles.optionDivider} /> : undefined
      }
    >
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected ? <View style={styles.radioDot} /> : null}
      </View>
      <View style={styles.optionContent}>
        <View style={styles.optionLabelRow}>
          <Text
            style={[styles.optionLabel, selected && styles.optionLabelSelected]}
          >
            {option.label}
          </Text>
          {option.recommended ? (
            <View style={styles.recommendedBadge}>
              <Text style={styles.recommendedBadgeText}>권장</Text>
            </View>
          ) : null}
        </View>
      </View>
    </TapFeedbackPressable>
  );
}

function LegacyDivider() {
  return (
    <View style={styles.legacyDividerRow}>
      <Text style={styles.legacyLabel}>LEGACY</Text>
      <View style={styles.legacyDivider}>
        <Svg width="100%" height={1}>
          <Line
            x1={0}
            y1={0.5}
            x2="100%"
            y2={0.5}
            stroke={tokens.color.borderSubtleStrong}
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        </Svg>
      </View>
    </View>
  );
}

function SelectionCard({
  options,
  selectedValue,
  onSelect,
}: {
  options: readonly PageOption[];
  selectedValue: OptionValue;
  onSelect: (value: OptionValue) => void;
}) {
  const legacyStartIndex = options.findIndex((option) => option.legacy);

  return (
    <View style={styles.selectionCard}>
      {options.map((option, index) => {
        const isBeforeLegacy =
          legacyStartIndex > 0 && index === legacyStartIndex - 1;
        const showDivider = index < options.length - 1 && !isBeforeLegacy;
        return (
          <Fragment key={String(option.value)}>
            {index === legacyStartIndex ? <LegacyDivider /> : null}
            <SelectionRow
              option={option}
              selected={option.value === selectedValue}
              showDivider={showDivider}
              onSelect={onSelect}
            />
          </Fragment>
        );
      })}
    </View>
  );
}

export function GenerationOptionScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ option?: string | string[] }>();
  const route = resolveRoute(params.option);
  const model = useGenerationStore((state) => state.model);
  const setModel = useGenerationStore((state) => state.setModel);
  const sampler = useGenerationStore((state) => state.sampler);
  const setSampler = useGenerationStore((state) => state.setSampler);
  const noiseSchedule = useGenerationStore((state) => state.noiseSchedule);
  const setNoiseSchedule = useGenerationStore(
    (state) => state.setNoiseSchedule,
  );
  const ucPreset = useGenerationStore((state) => state.ucPreset);
  const setUcPreset = useGenerationStore((state) => state.setUcPreset);

  const options = useMemo<readonly PageOption[]>(() => {
    if (route === "model") {
      return MODELS.map((option) =>
        toPageOption(option, "nai-diffusion-4-5-full"),
      );
    }
    if (route === "sampler") {
      return SAMPLERS.map((option) =>
        toPageOption(option, "k_euler_ancestral"),
      );
    }
    if (route === "schedule") {
      return NOISE_SCHEDULES.map((option) => toPageOption(option, "karras"));
    }
    return UC_PRESET_OPTIONS.map((option) => toPageOption(option));
  }, [route]);

  const selectedValue: OptionValue =
    route === "model"
      ? model
      : route === "sampler"
        ? sampler
        : route === "schedule"
          ? noiseSchedule
          : ucPreset;

  function handleSelect(value: OptionValue) {
    if (route === "model") setModel(String(value));
    else if (route === "sampler") setSampler(String(value));
    else if (route === "schedule") setNoiseSchedule(value as NoiseSchedule);
    else setUcPreset(value as SelectableUcPresetIndex);
  }

  const description = OPTION_DESCRIPTIONS[route];

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 80,
            paddingBottom: insets.bottom + tokens.space[16],
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <SelectionCard
          options={options}
          selectedValue={selectedValue}
          onSelect={handleSelect}
        />
        {description ? (
          <Text style={styles.description}>{description}</Text>
        ) : null}
      </ScrollView>

      <View
        pointerEvents="box-none"
        style={[styles.header, { top: insets.top + 8 }]}
      >
        <IconButton
          icon="chevron-back"
          label="뒤로"
          size={40}
          onPress={() => router.back()}
          style={styles.backButton}
        />
        <View pointerEvents="none" style={styles.titleContainer}>
          <Text style={styles.title}>{PAGE_TITLES[route]}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: tokens.color.app,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: tokens.space[6],
  },
  header: {
    position: "absolute",
    right: tokens.space[8],
    left: tokens.space[8],
    zIndex: 2,
    height: 40,
    justifyContent: "center",
  },
  backButton: {
    borderWidth: 0,
    backgroundColor: tokens.color.card,
  },
  titleContainer: {
    position: "absolute",
    top: 0,
    right: 48,
    bottom: 0,
    left: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: 17,
    letterSpacing: tokens.tracking.tight,
  },
  selectionCard: {
    overflow: "hidden",
    borderRadius: tokens.radius.settings,
    backgroundColor: tokens.color.card,
  },
  optionRow: {
    minHeight: 58,
    paddingLeft: tokens.space[9],
    paddingRight: tokens.space[9],
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space[5],
  },
  optionRowTapContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space[5],
  },
  radio: {
    width: 19,
    height: 19,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9.5,
    borderWidth: 1.5,
    borderColor: tokens.color.textMuted,
  },
  radioSelected: {
    borderWidth: 2,
    borderColor: tokens.color.accent,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 14,
    backgroundColor: tokens.color.accent,
  },
  optionContent: {
    minHeight: 58,
    flex: 1,
    paddingLeft: tokens.space[2],
    justifyContent: "center",
  },
  optionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space[7],
  },
  optionLabel: {
    flexShrink: 1,
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.regular,
    fontSize: 17,
    lineHeight: 22,
  },
  optionLabelSelected: {
    color: tokens.color.accent,
  },
  recommendedBadge: {
    minHeight: 20,
    paddingHorizontal: tokens.space[4],
    paddingVertical: tokens.space[1],
    alignItems: "center",
    justifyContent: "center",
    borderRadius: tokens.space[3],
    backgroundColor: tokens.color.sunken,
  },
  recommendedBadgeText: {
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.bold,
    fontSize: tokens.type["3xs"],
    lineHeight: 14,
  },
  optionDivider: {
    position: "absolute",
    right: tokens.space[9],
    bottom: 0,
    left: 51,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  legacyDividerRow: {
    paddingHorizontal: tokens.space[9],
    paddingVertical: tokens.space[3],
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space[7],
  },
  legacyLabel: {
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.bold,
    fontSize: tokens.type["3xs"],
    lineHeight: 14,
    letterSpacing: tokens.tracking.wide,
  },
  legacyDivider: {
    flex: 1,
    height: 1,
  },
  description: {
    marginTop: tokens.space[10],
    paddingHorizontal: tokens.space[7],
    color: tokens.color.textSecondary,
    fontFamily: tokens.font.regular,
    fontSize: tokens.type.base,
    lineHeight: 24,
  },
});
