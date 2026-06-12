import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  MODELS,
  NOISE_SCHEDULES,
  SAMPLERS,
} from "../../constants/generation";
import {
  getI2IEffectiveResolution,
  useGenerationStore,
} from "../../store/generationStore";
import { formatDecimal } from "../option/helpers";
import { light, styles } from "./styles";

// 옵션 요약 패널. 탭하면 단일 옵션 시트(시트 내 메뉴)를 연다.
export function OptionChips({ openOptions }: { openOptions: () => void }) {
  const model = useGenerationStore((s) => s.model);
  const resolution = useGenerationStore((s) => s.resolution);
  const steps = useGenerationStore((s) => s.steps);
  const promptGuidance = useGenerationStore((s) => s.promptGuidance);
  const promptGuidanceRescale = useGenerationStore(
    (s) => s.promptGuidanceRescale,
  );
  const sampler = useGenerationStore((s) => s.sampler);
  const noiseSchedule = useGenerationStore((s) => s.noiseSchedule);
  const varietyPlus = useGenerationStore((s) => s.varietyPlus);
  const i2iSourceImage = useGenerationStore((s) => s.i2iSourceImage);

  const modelText = MODELS.find((m) => m.value === model)?.label ?? model;
  const samplerText =
    SAMPLERS.find((s) => s.value === sampler)?.label ?? sampler;
  const scheduleText =
    NOISE_SCHEDULES.find((n) => n.value === noiseSchedule)?.label ??
    noiseSchedule;
  const resolutionText = i2iSourceImage
    ? (() => {
        const effectiveResolution = getI2IEffectiveResolution(i2iSourceImage);
        return `I2I ${effectiveResolution.width}x${effectiveResolution.height}`;
      })()
    : `${resolution.width}x${resolution.height}`;
  const summary = [
    modelText,
    resolutionText,
    `${steps} steps`,
    `guidance ${formatDecimal(promptGuidance)}`,
    `rescale ${formatDecimal(promptGuidanceRescale, 2)}`,
    samplerText,
    scheduleText,
    varietyPlus ? "Variety+" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <View style={styles.optionPanel}>
      <Pressable style={styles.optionPanelHeader} onPress={() => openOptions()}>
        <View style={styles.optionPanelSummaryRow}>
          <Text style={styles.optionPanelSummary} numberOfLines={2}>
            {summary}
          </Text>
          <Ionicons
            name="options-outline"
            size={18}
            color={light.textSecondary}
            style={styles.optionPanelChevron}
          />
        </View>
      </Pressable>
    </View>
  );
}
