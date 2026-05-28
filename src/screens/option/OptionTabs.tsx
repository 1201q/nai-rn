import { useState, type ReactNode } from "react";
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
import type { CharacterPrompt } from "../../context/GenerationOptionsContext";
import { colors } from "../../styles/colors";
import {
  formatDecimal,
  formatResolutionValue,
  getOptionLabel,
  resolveResolution,
  snapResolutionValue,
  triggerSelectionHaptic,
} from "./helpers";
import { SelectOption, StepperRow } from "./OptionControls";
import { styles } from "./styles";

type SelectionSheetName = "model" | "resolution" | "sampler" | "noiseSchedule";
type PromptInputMode = "base" | "negative";
const MAX_CHARACTER_PROMPTS = 6;

export const optionTabRoutes = [
  { key: "prompt", title: "Prompt" },
  { key: "options", title: "Options" },
];

function PromptTextArea({
  prompt,
  setPrompt,
  negativePrompt,
  setNegativePrompt,
  headerRight,
}: {
  prompt: string;
  setPrompt: (v: string) => void;
  negativePrompt: string;
  setNegativePrompt: (v: string) => void;
  headerRight?: ReactNode;
}) {
  const [promptInputMode, setPromptInputMode] =
    useState<PromptInputMode>("base");
  const isBasePrompt = promptInputMode === "base";
  const activePrompt = isBasePrompt ? prompt : negativePrompt;
  const setActivePrompt = isBasePrompt ? setPrompt : setNegativePrompt;

  return (
    <View style={styles.inputGroup}>
      <View style={[styles.textAreaWrap, styles.promptTextAreaWrap]}>
        <View style={styles.promptHeaderRow}>
          <View style={styles.promptSwitchRow}>
            <TouchableOpacity
              style={[
                styles.segmentButton,
                isBasePrompt && styles.segmentButtonActive,
              ]}
              activeOpacity={0.78}
              onPress={() => {
                if (!isBasePrompt) {
                  setPromptInputMode("base");
                  triggerSelectionHaptic();
                }
              }}
            >
              <Text
                style={[
                  styles.segmentText,
                  isBasePrompt && styles.segmentTextActive,
                ]}
              >
                Base
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.segmentButton,
                !isBasePrompt && styles.segmentButtonActive,
              ]}
              activeOpacity={0.78}
              onPress={() => {
                if (isBasePrompt) {
                  setPromptInputMode("negative");
                  triggerSelectionHaptic();
                }
              }}
            >
              <Text
                style={[
                  styles.segmentText,
                  !isBasePrompt && styles.segmentTextActive,
                ]}
              >
                Negative
              </Text>
            </TouchableOpacity>
          </View>
          {headerRight}
        </View>
        <TextInput
          value={activePrompt}
          onChangeText={setActivePrompt}
          multiline
          textAlignVertical="top"
          placeholderTextColor={colors.colorTextTertiary}
          style={styles.textArea}
        />
        <Text style={styles.countText}>{activePrompt.length}/1000</Text>
      </View>
    </View>
  );
}

export function OptionTabScene({
  route,
  hasLoadedOptions,
  prompt,
  setPrompt,
  negativePrompt,
  setNegativePrompt,
  characterPrompts,
  setCharacterPrompts,
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
  characterPrompts: CharacterPrompt[];
  setCharacterPrompts: (v: CharacterPrompt[]) => void;
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

  function addCharacterPrompt() {
    if (characterPrompts.length >= MAX_CHARACTER_PROMPTS) {
      return;
    }

    setCharacterPrompts([
      ...characterPrompts,
      {
        id: `character-${Date.now()}-${characterPrompts.length}`,
        prompt: "",
        negativePrompt: "",
        enabled: true,
      },
    ]);
    triggerSelectionHaptic();
  }

  function updateCharacterPrompt(
    id: string,
    nextValues: Partial<Omit<CharacterPrompt, "id">>,
  ) {
    setCharacterPrompts(
      characterPrompts.map((item) =>
        item.id === id ? { ...item, ...nextValues } : item,
      ),
    );
  }

  function deleteCharacterPrompt(id: string) {
    setCharacterPrompts(characterPrompts.filter((item) => item.id !== id));
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
    const canAddCharacterPrompt =
      characterPrompts.length < MAX_CHARACTER_PROMPTS;

    return (
      <KeyboardAwareScrollView
        bottomOffset={16}
        contentContainerStyle={styles.tabContent}
        keyboardShouldPersistTaps="handled"
      >
        <PromptTextArea
          prompt={prompt}
          setPrompt={setPrompt}
          negativePrompt={negativePrompt}
          setNegativePrompt={setNegativePrompt}
        />
        {characterPrompts.map((item, index) => (
          <View
            key={item.id}
            style={[
              styles.characterPromptGroup,
              !item.enabled && styles.characterPromptGroupDisabled,
            ]}
          >
            <Text style={styles.characterPromptTitle}>
              Character {index + 1}
            </Text>
            <PromptTextArea
              prompt={item.prompt}
              setPrompt={(nextPrompt) =>
                updateCharacterPrompt(item.id, { prompt: nextPrompt })
              }
              negativePrompt={item.negativePrompt}
              setNegativePrompt={(nextNegativePrompt) =>
                updateCharacterPrompt(item.id, {
                  negativePrompt: nextNegativePrompt,
                })
              }
              headerRight={
                <View style={styles.characterPromptActions}>
                  <TouchableOpacity
                    style={styles.characterPromptIconButton}
                    activeOpacity={0.78}
                    onPress={() => deleteCharacterPrompt(item.id)}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={20}
                      color={colors.colorTextPrimary}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.characterPromptIconButton,
                      item.enabled && styles.characterPromptIconButtonActive,
                    ]}
                    activeOpacity={0.78}
                    onPress={() => {
                      updateCharacterPrompt(item.id, {
                        enabled: !item.enabled,
                      });
                      triggerSelectionHaptic();
                    }}
                  >
                    <Ionicons
                      name="checkmark"
                      size={22}
                      color={
                        item.enabled
                          ? colors.appBackground
                          : colors.colorTextTertiary
                      }
                    />
                  </TouchableOpacity>
                </View>
              }
            />
          </View>
        ))}
        <TouchableOpacity
          style={[
            styles.addCharacterButton,
            !canAddCharacterPrompt && styles.disabledButton,
          ]}
          activeOpacity={0.78}
          disabled={!canAddCharacterPrompt}
          onPress={addCharacterPrompt}
        >
          <Ionicons
            name="add"
            size={18}
            color={colors.colorTextPrimary}
          />
          <Text style={styles.addCharacterText}>
            Add Character ({characterPrompts.length}/{MAX_CHARACTER_PROMPTS})
          </Text>
        </TouchableOpacity>
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
