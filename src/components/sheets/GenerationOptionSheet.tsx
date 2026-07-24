import { memo, useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  MODELS,
  NOISE_SCHEDULES,
  SAMPLERS,
  type NoiseSchedule,
} from "../../constants/generation";
import { useGenerationStore } from "../../store/generationStore";
import { tokens } from "../../styles/tokens";
import {
  SelectionSheet,
  type SelectionOption,
} from "./SelectionSheet";

export type GenerationOptionRoute = "model" | "sampler" | "schedule";

const OPTION_DESCRIPTIONS: Record<GenerationOptionRoute, string> = {
  model:
    "생성에 사용할 AI 모델입니다. V4.5 Full은 표현 범위가 넓고, Curated는 더 정제되고 예측 가능한 결과에 적합합니다. 일부 고급 기능은 V4 또는 V4.5에서만 사용할 수 있습니다.",
  sampler:
    "노이즈를 이미지로 바꾸는 계산 방식입니다. 같은 설정에서도 질감과 안정성이 달라질 수 있습니다. 잘 모르겠다면 Euler Ancestral 또는 DPM++ 2M을 권장합니다.",
  schedule:
    "Steps를 노이즈 구간에 배분하는 방식입니다. Karras는 무난한 기본값, Exponential은 다중 스텝 샘플러, Polyexponential은 손가락 같은 작은 디테일에 적합합니다.",
};

const MODEL_OPTIONS: readonly SelectionOption<string>[] = MODELS.map(
  ({ label, value }) => ({
    label,
    value,
    recommended: value === "nai-diffusion-4-5-full",
  }),
);

const SAMPLER_OPTIONS: readonly SelectionOption<string>[] = SAMPLERS.map(
  ({ label, value }) => ({
    label,
    value,
    recommended: value === "k_euler_ancestral",
  }),
);

const SCHEDULE_OPTIONS: readonly SelectionOption<string>[] =
  NOISE_SCHEDULES.map(({ label, value }) => ({
    label,
    value,
    recommended: value === "karras",
  }));

export const GenerationOptionSheet = memo(
  function GenerationOptionSheet({
    route,
    onSelect,
  }: {
    route: GenerationOptionRoute;
    onSelect: () => void;
  }) {
    const model = useGenerationStore((state) => state.model);
    const setModel = useGenerationStore((state) => state.setModel);
    const sampler = useGenerationStore((state) => state.sampler);
    const setSampler = useGenerationStore((state) => state.setSampler);
    const noiseSchedule = useGenerationStore((state) => state.noiseSchedule);
    const setNoiseSchedule = useGenerationStore(
      (state) => state.setNoiseSchedule,
    );

    const selectedValue =
      route === "model"
        ? model
        : route === "sampler"
          ? sampler
          : noiseSchedule;
    const options =
      route === "model"
        ? MODEL_OPTIONS
        : route === "sampler"
          ? SAMPLER_OPTIONS
          : SCHEDULE_OPTIONS;

    const handleSelect = useCallback(
      (value: string) => {
        if (route === "model") setModel(value);
        else if (route === "sampler") setSampler(value);
        else setNoiseSchedule(value as NoiseSchedule);
        onSelect();
      },
      [onSelect, route, setModel, setNoiseSchedule, setSampler],
    );

    return (
      <View style={styles.content}>
        <View style={styles.usageNotice}>
          <Ionicons
            name="information-circle-outline"
            size={19}
            color={tokens.color.accent}
          />
          <Text style={styles.usageNoticeText}>
            {OPTION_DESCRIPTIONS[route]}
          </Text>
        </View>

        <View style={styles.options}>
          <SelectionSheet
            options={options}
            selectedValue={selectedValue}
            onSelect={handleSelect}
          />
        </View>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  content: {
    width: "100%",
    paddingTop: tokens.space[2],
  },
  usageNotice: {
    minHeight: 58,
    marginHorizontal: tokens.space[2],
    paddingHorizontal: tokens.space[6],
    paddingVertical: tokens.space[5],
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space[5],
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.sunken,
  },
  usageNoticeText: {
    flex: 1,
    color: tokens.color.textMuted,
    fontFamily: tokens.font.regular,
    fontSize: tokens.type["2xs"],
    lineHeight: 17,
  },
  options: {
    marginTop: tokens.space[4],
  },
});
