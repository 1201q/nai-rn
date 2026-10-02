import { memo, useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { type BottomSheetScrollViewMethods } from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";

import { Toggle } from "../../../../components/forms/FormControls";
import { SheetSelect } from "../../../../components/forms/SheetSelect";
import { BottomSheetKeyboardAwareScrollView } from "../../../../components/generation/BottomSheetKeyboardAwareScrollView";
import {
  NAI_RESOLUTIONS,
  NOISE_SCHEDULES,
  SAMPLERS,
} from "../../../../constants/generation";
import { getModelCapabilities, MODELS } from "../../../../constants/models";
import { useGenerationChromeMetrics } from "../../../../hooks/useGenerationChromeMetrics";
import { resolveNoiseSchedule, resolveSampler } from "../../../../lib/novelai";
import { useGenerationStore } from "../../../../store/generationStore";
import { tokens } from "../../../../styles/tokens";
import { ResolutionDimensionInputs } from "./ResolutionDimensionInputs";
import {
  presetResolution,
  type ResolutionOrientation,
  resolutionOrientation,
  resolutionPreset,
} from "./resolution";
import { SettingsSeedInput } from "./SettingsSeedInput";
import {
  SettingsHelpButton,
  SettingsSlider,
  type SettingsHelpKey,
} from "./SettingsSlider";

const SETTINGS_ACTION_BAR_HEIGHT = 96;
const SETTINGS_KEYBOARD_GAP = 12;
const SETTINGS_KEYBOARD_SCROLL_MODE =
  Platform.OS === "android" ? "layout" : "insets";

const MODEL_OPTIONS = MODELS.map((option) => option.label);
const RESOLUTION_PRESET_OPTIONS = NAI_RESOLUTIONS.map((group) => group.group);
const SAMPLER_OPTIONS = SAMPLERS.map((option) => option.label);
// 공식 웹과 동일: V5에는 DDIM이 없다.
const V5_SAMPLER_OPTIONS = SAMPLERS.filter(
  (option) => option.value !== "ddim_v3",
).map((option) => option.label);
const SCHEDULE_OPTIONS = NOISE_SCHEDULES.map((option) => option.label);
// 공식 웹과 동일: V4 이상은 Native 스케줄을 지원하지 않는다.
const V4_SCHEDULE_OPTIONS = NOISE_SCHEDULES.filter(
  (option) => option.value !== "native",
).map((option) => option.label);

type SettingsSelectKey = "model" | "resolution" | "sampler" | "schedule";

const ORIENTATION_OPTIONS: ReadonlyArray<{
  value: ResolutionOrientation;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { value: "landscape", icon: "tablet-landscape-outline" },
  { value: "portrait", icon: "tablet-portrait-outline" },
  { value: "square", icon: "square-outline" },
];

export const SettingsSheetContent = memo(function SettingsSheetContent({
  active = true,
}: {
  active?: boolean;
}) {
  const scrollRef = useRef<BottomSheetScrollViewMethods>(null);
  const { sheetContentPaddingBottom } = useGenerationChromeMetrics();
  const model = useGenerationStore((state) => state.model);
  const setModel = useGenerationStore((state) => state.setModel);
  const resolution = useGenerationStore((state) => state.resolution);
  const setResolution = useGenerationStore((state) => state.setResolution);
  const steps = useGenerationStore((state) => state.steps);
  const setSteps = useGenerationStore((state) => state.setSteps);
  const promptGuidance = useGenerationStore((state) => state.promptGuidance);
  const setPromptGuidance = useGenerationStore(
    (state) => state.setPromptGuidance,
  );
  const promptGuidanceRescale = useGenerationStore(
    (state) => state.promptGuidanceRescale,
  );
  const setPromptGuidanceRescale = useGenerationStore(
    (state) => state.setPromptGuidanceRescale,
  );
  const sampler = useGenerationStore((state) => state.sampler);
  const setSampler = useGenerationStore((state) => state.setSampler);
  const schedule = useGenerationStore((state) => state.noiseSchedule);
  const setSchedule = useGenerationStore((state) => state.setNoiseSchedule);
  const varietyPlus = useGenerationStore((state) => state.varietyPlus);
  const setVarietyPlus = useGenerationStore((state) => state.setVarietyPlus);
  const [openSelect, setOpenSelect] = useState<SettingsSelectKey | null>(null);
  const [helpKey, setHelpKey] = useState<SettingsHelpKey | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(true);

  useEffect(() => {
    if (active) return;
    setOpenSelect(null);
    setHelpKey(null);
    setAdvancedOpen(true);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [active]);

  const modelLabel =
    MODELS.find((option) => option.value === model)?.label ?? model;
  const capabilities = getModelCapabilities(model);
  const displaySampler = resolveSampler(model, sampler);
  const samplerLabel =
    SAMPLERS.find((option) => option.value === displaySampler)?.label ??
    displaySampler;
  const displaySchedule =
    resolveNoiseSchedule(model, sampler, schedule) ?? schedule;
  const scheduleLabel =
    NOISE_SCHEDULES.find((option) => option.value === displaySchedule)?.label ??
    displaySchedule;
  const currentPreset = resolutionPreset(resolution);
  const currentOrientation = resolutionOrientation(resolution);

  function toggleHelp(next: SettingsHelpKey) {
    setOpenSelect(null);
    setHelpKey((current) => (current === next ? null : next));
  }

  function setSelectOpen(key: SettingsSelectKey, open: boolean) {
    if (open) setHelpKey(null);
    setOpenSelect(open ? key : null);
  }

  function changeModel(label: string) {
    const option = MODELS.find((candidate) => candidate.label === label);
    if (option) setModel(option.value);
  }

  function changeResolutionPreset(preset: string) {
    const next = presetResolution(preset, currentOrientation);
    if (next) setResolution(next);
  }

  function changeOrientation(orientation: ResolutionOrientation) {
    const preset = currentPreset === "Custom" ? "Normal" : currentPreset;
    const next = presetResolution(preset, orientation);
    if (next) setResolution(next);
  }

  function changeSampler(label: string) {
    const option = SAMPLERS.find((candidate) => candidate.label === label);
    if (option) setSampler(option.value);
  }

  function changeSchedule(label: string) {
    const option = NOISE_SCHEDULES.find(
      (candidate) => candidate.label === label,
    );
    if (option) setSchedule(option.value);
  }

  return (
    <BottomSheetKeyboardAwareScrollView
      ref={scrollRef}
      active={active}
      enabled={active}
      style={styles.settingsScroll}
      contentContainerStyle={[
        styles.settingsScrollContent,
        { paddingBottom: sheetContentPaddingBottom },
      ]}
      bottomOffset={SETTINGS_ACTION_BAR_HEIGHT + SETTINGS_KEYBOARD_GAP}
      extraKeyboardSpace={SETTINGS_ACTION_BAR_HEIGHT}
      mode={SETTINGS_KEYBOARD_SCROLL_MODE}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      scrollEnabled={openSelect === null}
    >
      <SheetSelect
        label="Model"
        value={modelLabel}
        options={MODEL_OPTIONS}
        onChange={changeModel}
        open={openSelect === "model"}
        onOpenChange={(open) => setSelectOpen("model", open)}
      />

      <View style={styles.settingsSection}>
        <Text style={styles.settingsEyebrow}>IMAGE SETTINGS</Text>
        <View style={styles.resolutionField}>
          <View style={styles.resolutionHeader}>
            <Text style={styles.settingsFieldLabel}>Resolution</Text>
            <ResolutionDimensionInputs
              active={active}
              resolution={resolution}
              onChange={setResolution}
            />
          </View>
          <View style={styles.resolutionControls}>
            <SheetSelect
              accessibilityLabel="Resolution preset"
              value={currentPreset}
              options={RESOLUTION_PRESET_OPTIONS}
              onChange={changeResolutionPreset}
              open={openSelect === "resolution"}
              onOpenChange={(open) => setSelectOpen("resolution", open)}
              style={styles.resolutionPresetSelect}
            />
            <View style={styles.orientationControl}>
              {ORIENTATION_OPTIONS.map((option) => {
                const selected = option.value === currentOrientation;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="button"
                    accessibilityLabel={`${option.value} resolution`}
                    accessibilityState={{ selected }}
                    onPress={() => changeOrientation(option.value)}
                    style={({ pressed }) => [
                      styles.orientationButton,
                      selected && styles.orientationButtonSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Ionicons
                      name={option.icon}
                      size={19}
                      color={
                        selected
                          ? tokens.color.textPrimary
                          : tokens.color.textTertiary
                      }
                    />
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </View>

      <View style={styles.settingsSectionWide}>
        <Text style={styles.settingsEyebrow}>AI SETTINGS</Text>
        <SettingsSlider
          active={active}
          label="Steps"
          helpKey="steps"
          helpOpen={helpKey === "steps"}
          value={steps}
          min={1}
          max={50}
          step={1}
          precision={0}
          onHelpToggle={() => toggleHelp("steps")}
          onChange={setSteps}
        />
        <SettingsSlider
          active={active}
          label="Prompt Guidance"
          helpKey="promptGuidance"
          helpOpen={helpKey === "promptGuidance"}
          value={promptGuidance}
          min={0}
          max={10}
          step={0.1}
          precision={1}
          onHelpToggle={() => toggleHelp("promptGuidance")}
          onChange={setPromptGuidance}
          trailing={
            capabilities.varietyPlusBaseSigma === undefined ? undefined : (
              <View style={styles.varietyControl}>
                <Text style={styles.varietyLabel}>Variety+</Text>
                <SettingsHelpButton
                  helpKey="variety"
                  open={helpKey === "variety"}
                  onToggle={() => toggleHelp("variety")}
                />
                <Toggle
                  value={varietyPlus}
                  label="Variety+"
                  onChange={setVarietyPlus}
                />
              </View>
            )
          }
        />
        <View style={styles.aiColumns}>
          <View style={styles.seedColumn}>
            <Text style={styles.settingsFieldLabel}>Seed</Text>
            <SettingsSeedInput active={active} />
          </View>
          <SheetSelect
            label="Sampler"
            value={samplerLabel}
            options={
              capabilities.v5Request ? V5_SAMPLER_OPTIONS : SAMPLER_OPTIONS
            }
            onChange={changeSampler}
            open={openSelect === "sampler"}
            onOpenChange={(open) => setSelectOpen("sampler", open)}
            style={styles.aiColumn}
          />
        </View>
      </View>

      <View style={styles.settingsSectionWide}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Advanced Settings"
          accessibilityState={{ expanded: advancedOpen }}
          onPress={() => setAdvancedOpen((open) => !open)}
          style={({ pressed }) => [
            styles.advancedHeader,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.settingsEyebrow}>ADVANCED SETTINGS</Text>
          <Ionicons
            name={advancedOpen ? "chevron-up" : "chevron-down"}
            size={15}
            color={tokens.color.textTertiary}
          />
        </Pressable>
        {advancedOpen ? (
          <View style={styles.advancedContent}>
            <SettingsSlider
              active={active}
              label="Prompt Guidance Rescale"
              helpKey="rescale"
              helpOpen={helpKey === "rescale"}
              value={promptGuidanceRescale}
              min={0}
              max={1}
              step={0.02}
              precision={2}
              onHelpToggle={() => toggleHelp("rescale")}
              onChange={setPromptGuidanceRescale}
            />
            {/* 공식 웹과 동일: V5는 Karras 고정이라 선택지를 보여주지 않는다. */}
            {capabilities.v5Request ? null : (
              <SheetSelect
                label="Schedule"
                value={scheduleLabel}
                options={
                  capabilities.nativeNoiseSchedule
                    ? SCHEDULE_OPTIONS
                    : V4_SCHEDULE_OPTIONS
                }
                onChange={changeSchedule}
                open={openSelect === "schedule"}
                onOpenChange={(open) => setSelectOpen("schedule", open)}
              />
            )}
          </View>
        ) : null}
      </View>
    </BottomSheetKeyboardAwareScrollView>
  );
});

const styles = StyleSheet.create({
  settingsScroll: {
    flex: 1,
  },
  settingsScrollContent: {
    paddingTop: 18,
    paddingHorizontal: 16,
    gap: 24,
  },
  settingsSection: {
    gap: 14,
  },
  settingsSectionWide: {
    gap: 18,
  },
  settingsEyebrow: {
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.semibold,
    fontSize: 12,
    letterSpacing: 0.8,
  },
  settingsFieldLabel: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.medium,
    fontSize: 15,
  },
  resolutionField: {
    gap: 9,
  },
  resolutionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  resolutionControls: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
  },
  resolutionPresetSelect: {
    width: 132,
    flexShrink: 0,
  },
  orientationControl: {
    flex: 1,
    padding: 4,
    flexDirection: "row",
    gap: 4,
    borderRadius: 14,
    backgroundColor: tokens.color.sunken,
  },
  orientationButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
  },
  orientationButtonSelected: {
    backgroundColor: tokens.color.toast,
  },
  varietyControl: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  varietyLabel: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.medium,
    fontSize: 15,
  },
  aiColumns: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  aiColumn: {
    flex: 1,
    minWidth: 0,
  },
  seedColumn: {
    flex: 1,
    minWidth: 0,
    gap: 10,
  },
  advancedHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  advancedContent: {
    gap: 18,
  },
  pressed: {
    opacity: tokens.opacity.pressed,
  },
});
