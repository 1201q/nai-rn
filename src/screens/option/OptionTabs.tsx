import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import {
  MODELS,
  NOISE_SCHEDULES,
  SAMPLERS,
  type NaiResolution,
  type NoiseSchedule,
} from "../../constants/generation";
import type { OptionSectionExpandedState } from "../../context/GenerationOptionsContext";
import { colors } from "../../styles/colors";
import {
  adjustDecimal,
  formatDecimal,
  formatResolutionValue,
  getOptionLabel,
  resolveResolution,
  snapResolutionValue,
  triggerSelectionHaptic,
} from "./helpers";
import {
  CollapsibleSection,
  LabeledInput,
  SelectOption,
  StepperRow,
} from "./OptionControls";
import { styles } from "./styles";

type SelectionSheetName = "model" | "resolution" | "sampler" | "noiseSchedule";

export const optionTabRoutes = [
  { key: "prompt", title: "Prompt" },
  { key: "options", title: "Options" },
];

export function OptionTabScene({
  route,
  hasLoadedOptions,
  prompt,
  setPrompt,
  negativePrompt,
  setNegativePrompt,
  model,
  resolution,
  setResolution,
  steps,
  setSteps,
  promptGuidance,
  setPromptGuidance,
  promptGuidanceRescale,
  setPromptGuidanceRescale,
  noiseSchedule,
  sampler,
  seedText,
  setSeedText,
  optionSectionExpanded,
  setOptionSectionExpanded,
  resolutionWidthText,
  setResolutionWidthText,
  resolutionHeightText,
  setResolutionHeightText,
  openSelectionSheet,
}: {
  route: { key: string };
  hasLoadedOptions: boolean;
  prompt: string;
  setPrompt: (v: string) => void;
  negativePrompt: string;
  setNegativePrompt: (v: string) => void;
  model: string;
  resolution: NaiResolution;
  setResolution: (v: NaiResolution) => void;
  steps: number;
  setSteps: (v: number) => void;
  promptGuidance: number;
  setPromptGuidance: (v: number) => void;
  promptGuidanceRescale: number;
  setPromptGuidanceRescale: (v: number) => void;
  noiseSchedule: NoiseSchedule;
  sampler: string;
  seedText: string;
  setSeedText: (v: string) => void;
  optionSectionExpanded: OptionSectionExpandedState;
  setOptionSectionExpanded: (v: OptionSectionExpandedState) => void;
  resolutionWidthText: string;
  setResolutionWidthText: (v: string) => void;
  resolutionHeightText: string;
  setResolutionHeightText: (v: string) => void;
  openSelectionSheet: (sheet: SelectionSheetName) => void;
}) {
  function commitResolutionInput(
    widthText = resolutionWidthText,
    heightText = resolutionHeightText,
  ) {
    const width = snapResolutionValue(widthText, resolution.width);
    const height = snapResolutionValue(heightText, resolution.height);
    setResolution(resolveResolution(width, height));
    setResolutionWidthText(String(width));
    setResolutionHeightText(String(height));
  }

  function swapResolutionInput() {
    const width = snapResolutionValue(resolutionWidthText, resolution.width);
    const height = snapResolutionValue(resolutionHeightText, resolution.height);
    setResolution(resolveResolution(height, width));
    setResolutionWidthText(String(height));
    setResolutionHeightText(String(width));
    triggerSelectionHaptic();
  }

  if (!hasLoadedOptions) {
    return (
      <View style={styles.loadingOptions}>
        <ActivityIndicator color={colors.background} />
      </View>
    );
  }

  if (route.key === "prompt") {
    return (
      <ScrollView
        contentContainerStyle={styles.tabContent}
        keyboardShouldPersistTaps="handled"
      >
        <LabeledInput
          label="Prompt"
          value={prompt}
          onChangeText={setPrompt}
          minHeight={132}
          count={`${prompt.length}/1000`}
        />
        <LabeledInput
          label="Negative Prompt"
          value={negativePrompt}
          onChangeText={setNegativePrompt}
          minHeight={96}
          count={`${negativePrompt.length}/1000`}
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.tabContent}
      keyboardShouldPersistTaps="handled"
    >
      <SelectOption
        label="Model"
        value={getOptionLabel(MODELS, model)}
        onPress={() => openSelectionSheet("model")}
      />
      <CollapsibleSection
        title="Image Settings"
        expanded={optionSectionExpanded.image}
        onExpandedChange={(expanded) =>
          setOptionSectionExpanded({
            ...optionSectionExpanded,
            image: expanded,
          })
        }
      >
        <SelectOption
          label="Resolution"
          value={formatResolutionValue(resolution)}
          onPress={() => openSelectionSheet("resolution")}
        />
        <View style={styles.resolutionInputRow}>
          <TextInput
            value={resolutionWidthText}
            onChangeText={(text) =>
              setResolutionWidthText(text.replace(/\D/g, ""))
            }
            onBlur={() => commitResolutionInput()}
            onSubmitEditing={() => commitResolutionInput()}
            keyboardType="number-pad"
            placeholder="Width"
            placeholderTextColor={colors.grey500}
            style={styles.resolutionInput}
          />
          <TouchableOpacity
            style={styles.resolutionSwapButton}
            activeOpacity={0.78}
            onPress={swapResolutionInput}
          >
            <Text style={styles.resolutionSwapText}>x</Text>
          </TouchableOpacity>
          <TextInput
            value={resolutionHeightText}
            onChangeText={(text) =>
              setResolutionHeightText(text.replace(/\D/g, ""))
            }
            onBlur={() => commitResolutionInput()}
            onSubmitEditing={() => commitResolutionInput()}
            keyboardType="number-pad"
            placeholder="Height"
            placeholderTextColor={colors.grey500}
            style={styles.resolutionInput}
          />
        </View>
      </CollapsibleSection>
      <CollapsibleSection
        title="AI Settings"
        expanded={optionSectionExpanded.ai}
        onExpandedChange={(expanded) =>
          setOptionSectionExpanded({
            ...optionSectionExpanded,
            ai: expanded,
          })
        }
      >
        <StepperRow
          label="Steps"
          value={steps}
          onMinus={() => {
            const nextValue = Math.max(1, steps - 1);
            if (nextValue !== steps) {
              setSteps(nextValue);
              triggerSelectionHaptic();
            }
          }}
          onPlus={() => {
            const nextValue = Math.min(50, steps + 1);
            if (nextValue !== steps) {
              setSteps(nextValue);
              triggerSelectionHaptic();
            }
          }}
          seekMin={1}
          seekMax={50}
          seekStep={1}
          onSeekChange={setSteps}
        />
        <StepperRow
          label="Prompt Guidance"
          value={promptGuidance}
          valueText={formatDecimal(promptGuidance)}
          onMinus={() => {
            const nextValue = adjustDecimal(promptGuidance, -0.1, 0, 10);
            if (nextValue !== promptGuidance) {
              setPromptGuidance(nextValue);
              triggerSelectionHaptic();
            }
          }}
          onPlus={() => {
            const nextValue = adjustDecimal(promptGuidance, 0.1, 0, 10);
            if (nextValue !== promptGuidance) {
              setPromptGuidance(nextValue);
              triggerSelectionHaptic();
            }
          }}
          seekMin={0}
          seekMax={10}
          seekStep={0.1}
          seekPrecision={1}
          onSeekChange={setPromptGuidance}
        />
        <View style={styles.seedOptionRow}>
          <Text style={styles.optionLabel}>Seed</Text>
          <View style={styles.seedRow}>
            <TextInput
              value={seedText}
              onChangeText={setSeedText}
              keyboardType="number-pad"
              placeholder="Random"
              placeholderTextColor={colors.grey500}
              style={styles.seedInput}
            />
          </View>
        </View>
        <SelectOption
          label="Sampler"
          value={getOptionLabel(SAMPLERS, sampler)}
          onPress={() => openSelectionSheet("sampler")}
        />
      </CollapsibleSection>
      <CollapsibleSection
        title="Advanced Settings"
        expanded={optionSectionExpanded.advanced}
        onExpandedChange={(expanded) =>
          setOptionSectionExpanded({
            ...optionSectionExpanded,
            advanced: expanded,
          })
        }
      >
        <StepperRow
          label="Prompt Guidance Rescale"
          value={promptGuidanceRescale}
          valueText={formatDecimal(promptGuidanceRescale, 2)}
          onMinus={() => {
            const nextValue = adjustDecimal(
              promptGuidanceRescale,
              -0.02,
              0,
              1,
              2,
            );
            if (nextValue !== promptGuidanceRescale) {
              setPromptGuidanceRescale(nextValue);
              triggerSelectionHaptic();
            }
          }}
          onPlus={() => {
            const nextValue = adjustDecimal(
              promptGuidanceRescale,
              0.02,
              0,
              1,
              2,
            );
            if (nextValue !== promptGuidanceRescale) {
              setPromptGuidanceRescale(nextValue);
              triggerSelectionHaptic();
            }
          }}
          seekMin={0}
          seekMax={1}
          seekStep={0.02}
          seekPrecision={2}
          onSeekChange={setPromptGuidanceRescale}
        />
        <SelectOption
          label="Noise Schedule"
          value={getOptionLabel(NOISE_SCHEDULES, noiseSchedule)}
          onPress={() => openSelectionSheet("noiseSchedule")}
        />
      </CollapsibleSection>
    </ScrollView>
  );
}
