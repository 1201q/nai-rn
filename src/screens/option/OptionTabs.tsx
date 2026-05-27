import {
  ActivityIndicator,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import {
  MODELS,
  NOISE_SCHEDULES,
  SAMPLERS,
  type NaiResolution,
  type NoiseSchedule,
} from "../../constants/generation";
import { colors } from "../../styles/colors";
import {
  formatDecimal,
  formatResolutionValue,
  getOptionLabel,
  resolveResolution,
  snapResolutionValue,
  triggerSelectionHaptic,
} from "./helpers";
import { LabeledInput, SelectOption, StepperRow } from "./OptionControls";
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
        <ActivityIndicator color={colors.colorTextPrimary} />
      </View>
    );
  }

  if (route.key === "prompt") {
    return (
      <KeyboardAwareScrollView
        bottomOffset={16}
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
      </KeyboardAwareScrollView>
    );
  }

  return (
    <KeyboardAwareScrollView
      bottomOffset={16}
      contentContainerStyle={styles.tabContent}
      keyboardShouldPersistTaps="handled"
    >
      <SelectOption
        label="Model"
        value={getOptionLabel(MODELS, model)}
        onPress={() => openSelectionSheet("model")}
      />
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Image Settings</Text>
        <View style={styles.sectionContent}>
          <SelectOption
            label="Resolution"
            value={formatResolutionValue(resolution)}
            onPress={() => openSelectionSheet("resolution")}
          />
          <View style={styles.resolutionInputRow}>
            <View style={styles.resolutionInputBox}>
              <Text style={styles.resolutionInlineLabel}>Width</Text>
              <View style={styles.resolutionDivider} />
              <TextInput
                value={resolutionWidthText}
                onChangeText={(text) =>
                  setResolutionWidthText(text.replace(/\D/g, ""))
                }
                onBlur={() => commitResolutionInput()}
                onSubmitEditing={() => commitResolutionInput()}
                keyboardType="number-pad"
                placeholder="832"
                placeholderTextColor={colors.colorTextTertiary}
                style={styles.resolutionInput}
              />
            </View>
            <TouchableOpacity
              style={styles.resolutionSwapButton}
              activeOpacity={0.78}
              onPress={swapResolutionInput}
            >
              <Ionicons name="swap-horizontal-outline" size={18} color={colors.colorTextPrimary} />
            </TouchableOpacity>
            <View style={styles.resolutionInputBox}>
              <Text style={styles.resolutionInlineLabel}>Height</Text>
              <View style={styles.resolutionDivider} />
              <TextInput
                value={resolutionHeightText}
                onChangeText={(text) =>
                  setResolutionHeightText(text.replace(/\D/g, ""))
                }
                onBlur={() => commitResolutionInput()}
                onSubmitEditing={() => commitResolutionInput()}
                keyboardType="number-pad"
                placeholder="1216"
                placeholderTextColor={colors.colorTextTertiary}
                style={styles.resolutionInput}
              />
            </View>
          </View>
        </View>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>AI Settings</Text>
        <View style={styles.sectionContent}>
          <StepperRow
            label="Steps"
            value={steps}
            seekMin={1}
            seekMax={50}
            seekStep={1}
            onSeekChange={setSteps}
          />
          <StepperRow
            label="Prompt Guidance"
            value={promptGuidance}
            valueText={formatDecimal(promptGuidance)}
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
                placeholderTextColor={colors.colorTextTertiary}
                style={styles.seedInput}
              />
            </View>
          </View>
          <SelectOption
            label="Sampler"
            value={getOptionLabel(SAMPLERS, sampler)}
            onPress={() => openSelectionSheet("sampler")}
          />
        </View>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Advanced Settings</Text>
        <View style={styles.sectionContent}>
          <StepperRow
            label="Prompt Guidance Rescale"
            value={promptGuidanceRescale}
            valueText={formatDecimal(promptGuidanceRescale, 2)}
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
        </View>
      </View>
    </KeyboardAwareScrollView>
  );
}
