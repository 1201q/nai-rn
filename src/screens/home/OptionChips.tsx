import { ScrollView } from "react-native";

import {
  MODELS,
  NOISE_SCHEDULES,
  SAMPLERS,
} from "../../constants/generation";
import { useGenerationStore } from "../../store/generationStore";
import { formatDecimal } from "../option/helpers";
import { styles } from "./styles";
import { OptionChip, VarietyChip } from "./primitives";
import { OPTIONS } from "./constants";
import type { SheetKey } from "./OptionSheets";

const OPT = Object.fromEntries(OPTIONS.map((o) => [o.key, o])) as Record<
  string,
  (typeof OPTIONS)[number]
>;

type ChipProps = { openSheet: (key: SheetKey) => void };

function ModelChip({ openSheet }: ChipProps) {
  const model = useGenerationStore((s) => s.model);
  const text = MODELS.find((m) => m.value === model)?.label ?? model;
  return (
    <OptionChip
      opt={OPT.model}
      value={{ text }}
      onPress={() => openSheet("model")}
    />
  );
}

function ResolutionChip({ openSheet }: ChipProps) {
  const resolution = useGenerationStore((s) => s.resolution);
  return (
    <OptionChip
      opt={OPT.resolution}
      value={{ text: `${resolution.width}×${resolution.height}` }}
      onPress={() => openSheet("resolution")}
    />
  );
}

function SeedChip({ openSheet }: ChipProps) {
  const seed = useGenerationStore((s) => s.seed);
  const seedLocked = useGenerationStore((s) => s.seedLocked);
  return (
    <OptionChip
      opt={OPT.seed}
      value={{
        text: seed === 0 ? "Random" : seedLocked ? `${seed} 🔒` : String(seed),
      }}
      onPress={() => openSheet("seed")}
    />
  );
}

function StepsChip({ openSheet }: ChipProps) {
  const steps = useGenerationStore((s) => s.steps);
  return (
    <OptionChip
      opt={OPT.steps}
      value={{ text: String(steps), unit: "steps", unitBefore: true }}
      onPress={() => openSheet("steps")}
    />
  );
}

function CfgChip({ openSheet }: ChipProps) {
  const promptGuidance = useGenerationStore((s) => s.promptGuidance);
  return (
    <OptionChip
      opt={OPT.cfg}
      value={{
        text: formatDecimal(promptGuidance),
        unit: "guidance",
        unitBefore: true,
      }}
      onPress={() => openSheet("cfg")}
    />
  );
}

function CfgRescaleChip({ openSheet }: ChipProps) {
  const promptGuidanceRescale = useGenerationStore(
    (s) => s.promptGuidanceRescale,
  );
  return (
    <OptionChip
      opt={OPT.cfgRescale}
      value={{
        text: formatDecimal(promptGuidanceRescale, 2),
        unit: "rescale",
        unitBefore: true,
      }}
      onPress={() => openSheet("cfgRescale")}
    />
  );
}

function SamplerChip({ openSheet }: ChipProps) {
  const sampler = useGenerationStore((s) => s.sampler);
  const text = SAMPLERS.find((s) => s.value === sampler)?.label ?? sampler;
  return (
    <OptionChip
      opt={OPT.sampler}
      value={{ text }}
      onPress={() => openSheet("sampler")}
    />
  );
}

function ScheduleChip({ openSheet }: ChipProps) {
  const noiseSchedule = useGenerationStore((s) => s.noiseSchedule);
  const text =
    NOISE_SCHEDULES.find((n) => n.value === noiseSchedule)?.label ??
    noiseSchedule;
  return (
    <OptionChip
      opt={OPT.schedule}
      value={{ text }}
      onPress={() => openSheet("schedule")}
    />
  );
}

function VarietyChipConnected() {
  const varietyPlus = useGenerationStore((s) => s.varietyPlus);
  const setVarietyPlus = useGenerationStore((s) => s.setVarietyPlus);
  return (
    <VarietyChip
      active={varietyPlus}
      onPress={() => setVarietyPlus(!varietyPlus)}
    />
  );
}

export function OptionChips({
  openSheet,
}: {
  openSheet: (key: SheetKey) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.optionScrollContent}
    >
      <ModelChip openSheet={openSheet} />
      <ResolutionChip openSheet={openSheet} />
      <SeedChip openSheet={openSheet} />
      <StepsChip openSheet={openSheet} />
      <CfgChip openSheet={openSheet} />
      <CfgRescaleChip openSheet={openSheet} />
      <SamplerChip openSheet={openSheet} />
      <ScheduleChip openSheet={openSheet} />
      <VarietyChipConnected />
    </ScrollView>
  );
}
