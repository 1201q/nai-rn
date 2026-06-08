import { useState } from "react";
import { ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInLeft, FadeInRight } from "react-native-reanimated";

import {
  MODELS,
  NOISE_SCHEDULES,
  SAMPLERS,
} from "../../constants/generation";
import { useGenerationStore } from "../../store/generationStore";
import { formatDecimal } from "../option/helpers";
import { light, styles } from "./styles";
import {
  ImageActionChip,
  OptionChip,
  ScalePressable,
  VarietyChip,
} from "./primitives";
import { OPTIONS } from "./constants";
import type { SheetKey } from "./OptionSheets";

const OPT = Object.fromEntries(OPTIONS.map((o) => [o.key, o])) as Record<
  string,
  (typeof OPTIONS)[number]
>;

type ChipProps = { openSheet: (key: SheetKey) => void };

const IMAGE_IMPORT_OPT = {
  key: "imageImport",
  label: "Import",
  icon: "image-outline",
} as const;

const BATCH_COUNT_OPT = {
  key: "batchCount",
  label: "연속 생성",
  icon: "albums-outline",
} as const;

function BatchCountChip({ openSheet }: ChipProps) {
  const batchCount = useGenerationStore((s) => s.batchCount);
  return (
    <OptionChip
      opt={BATCH_COUNT_OPT}
      value={{ text: String(batchCount), unit: "장" }}
      onPress={() => openSheet("batchCount")}
    />
  );
}

function ImageImportChip({ openSheet }: ChipProps) {
  return (
    <OptionChip
      opt={IMAGE_IMPORT_OPT}
      value={{ text: "메타데이터 추출" }}
      onPress={() => openSheet("imageImport")}
    />
  );
}

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

type ChipMode = "collapsed" | "options" | "image";

function SquareIconButton({
  icon,
  style,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  style?: object | object[];
  onPress: () => void;
}) {
  return (
    <ScalePressable
      style={[styles.chipSquareButton, ...(style ? [style] : [])]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={20} color={light.textSecondary} />
    </ScalePressable>
  );
}

export function OptionChips({
  openSheet,
}: {
  openSheet: (key: SheetKey) => void;
}) {
  const [mode, setMode] = useState<ChipMode>("collapsed");

  if (mode === "collapsed") {
    return (
      <View style={styles.chipRow2}>
        <SquareIconButton
          icon="options-outline"
          onPress={() => setMode("options")}
        />
        <View style={styles.chipRow2Right}>
          <BatchCountChip openSheet={openSheet} />
          <SquareIconButton
            icon="image-outline"
            onPress={() => setMode("image")}
          />
        </View>
      </View>
    );
  }

  if (mode === "options") {
    const chips = [
      <ModelChip openSheet={openSheet} />,
      <ResolutionChip openSheet={openSheet} />,
      <SeedChip openSheet={openSheet} />,
      <StepsChip openSheet={openSheet} />,
      <CfgChip openSheet={openSheet} />,
      <CfgRescaleChip openSheet={openSheet} />,
      <SamplerChip openSheet={openSheet} />,
      <ScheduleChip openSheet={openSheet} />,
      <VarietyChipConnected />,
    ];
    return (
      <View style={styles.chipRowExpanded}>
        <SquareIconButton
          icon="chevron-back"
          style={styles.chipCollapseLeft}
          onPress={() => setMode("collapsed")}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroll}
          contentContainerStyle={styles.optionScrollContentLeft}
        >
          {chips.map((chip, i) => (
            <Animated.View
              key={i}
              entering={FadeInRight.duration(180).delay(i * 28)}
            >
              {chip}
            </Animated.View>
          ))}
        </ScrollView>
      </View>
    );
  }

  const imageChips = [
    <ImageImportChip openSheet={openSheet} />,
    <ImageActionChip icon="git-compare-outline" label="I2I" />,
    <ImageActionChip icon="color-palette-outline" label="Vibe Transfer" />,
    <ImageActionChip icon="locate-outline" label="Precise Reference" />,
  ];
  return (
    <View style={styles.chipRowExpanded}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.optionScrollContentRight}
      >
        {imageChips.map((chip, i) => (
          <Animated.View
            key={i}
            entering={FadeInLeft.duration(180).delay(i * 28)}
          >
            {chip}
          </Animated.View>
        ))}
      </ScrollView>
      <SquareIconButton
        icon="chevron-forward"
        style={styles.chipCollapseRight}
        onPress={() => setMode("collapsed")}
      />
    </View>
  );
}
