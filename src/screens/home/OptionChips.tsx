import { useEffect, useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";

import {
  MODELS,
  NOISE_SCHEDULES,
  SAMPLERS,
} from "../../constants/generation";
import { useGenerationStore } from "../../store/generationStore";
import { formatDecimal } from "../option/helpers";
import { light, styles } from "./styles";
import type { SheetKey } from "./OptionSheets";

const OPTION_PANEL_LAYOUT = LinearTransition.duration(180);
const OPTION_GROUPS_ENTERING = FadeIn.duration(120);
const OPTION_GROUPS_EXITING = FadeOut.duration(90);

function CompactOptionChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress}>
      <View
        style={[
          styles.compactOptionChip,
          active ? styles.compactOptionChipActive : null,
        ]}
      >
        <Text
          style={[
            styles.compactOptionChipText,
            active ? styles.compactOptionChipTextActive : null,
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

function OptionGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.optionGroupRow}>
      <Text style={styles.optionGroupLabel}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.optionGroupScroll}
        contentContainerStyle={styles.optionGroupChips}
      >
        {children}
      </ScrollView>
    </View>
  );
}

export function OptionChips({
  onExpandedChange,
  openSheet,
}: {
  onExpandedChange?: (isExpanded: boolean) => void;
  openSheet: (key: SheetKey) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const model = useGenerationStore((s) => s.model);
  const resolution = useGenerationStore((s) => s.resolution);
  const seed = useGenerationStore((s) => s.seed);
  const seedLocked = useGenerationStore((s) => s.seedLocked);
  const steps = useGenerationStore((s) => s.steps);
  const promptGuidance = useGenerationStore((s) => s.promptGuidance);
  const promptGuidanceRescale = useGenerationStore(
    (s) => s.promptGuidanceRescale,
  );
  const sampler = useGenerationStore((s) => s.sampler);
  const noiseSchedule = useGenerationStore((s) => s.noiseSchedule);
  const varietyPlus = useGenerationStore((s) => s.varietyPlus);
  const setVarietyPlus = useGenerationStore((s) => s.setVarietyPlus);

  useEffect(() => {
    onExpandedChange?.(expanded);
  }, [expanded, onExpandedChange]);

  useEffect(() => {
    return () => onExpandedChange?.(false);
  }, [onExpandedChange]);

  const modelText = MODELS.find((m) => m.value === model)?.label ?? model;
  const samplerText =
    SAMPLERS.find((s) => s.value === sampler)?.label ?? sampler;
  const scheduleText =
    NOISE_SCHEDULES.find((n) => n.value === noiseSchedule)?.label ??
    noiseSchedule;
  let seedText = `Seed ${seed}`;
  if (seed === 0) {
    seedText = "Seed Random";
  } else if (seedLocked) {
    seedText = `Seed ${seed} Lock`;
  }
  const summary = [
    modelText,
    `${resolution.width}x${resolution.height}`,
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
    <Animated.View layout={OPTION_PANEL_LAYOUT} style={styles.optionPanel}>
      <BlurView intensity={38} tint="light" style={styles.optionPanelBlur} />
      <Pressable
        style={styles.optionPanelHeader}
        onPress={() => setExpanded((value) => !value)}
      >
        <View style={styles.optionPanelSummaryRow}>
          <Text style={styles.optionPanelSummary} numberOfLines={2}>
            {summary}
          </Text>
          <Ionicons
            name={expanded ? "chevron-down" : "chevron-up"}
            size={18}
            color={light.textSecondary}
            style={styles.optionPanelChevron}
          />
        </View>
      </Pressable>

      {expanded ? (
        <Animated.View
          entering={OPTION_GROUPS_ENTERING}
          exiting={OPTION_GROUPS_EXITING}
          style={styles.optionPanelGroups}
        >
          <OptionGroup label="Core">
            <CompactOptionChip
              label={modelText}
              onPress={() => openSheet("model")}
            />
            <CompactOptionChip
              label={`${resolution.width}x${resolution.height}`}
              onPress={() => openSheet("resolution")}
            />
            <CompactOptionChip
              label={seedText}
              onPress={() => openSheet("seed")}
            />
          </OptionGroup>

          <OptionGroup label="Parameter Options">
            <CompactOptionChip
              label={`${steps} steps`}
              onPress={() => openSheet("steps")}
            />
            <CompactOptionChip
              label={`${formatDecimal(promptGuidance)} guidance`}
              onPress={() => openSheet("cfg")}
            />
            <CompactOptionChip
              label={`${formatDecimal(promptGuidanceRescale, 2)} rescale`}
              onPress={() => openSheet("cfgRescale")}
            />
            <CompactOptionChip
              label={samplerText}
              onPress={() => openSheet("sampler")}
            />
            <CompactOptionChip
              label={scheduleText}
              onPress={() => openSheet("schedule")}
            />
            <CompactOptionChip
              label="Variety+"
              active={varietyPlus}
              onPress={() => setVarietyPlus(!varietyPlus)}
            />
          </OptionGroup>

          <OptionGroup label="Reference">
            <CompactOptionChip
              label="Metadata Extract"
              onPress={() => openSheet("imageImport")}
            />
            <CompactOptionChip label="I2I Off" />
            <CompactOptionChip label="Vibe Transfer Off" />
            <CompactOptionChip label="Precise Ref Off" />
          </OptionGroup>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}
