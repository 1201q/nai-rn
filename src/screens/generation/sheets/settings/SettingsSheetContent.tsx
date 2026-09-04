import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";

import { Toggle } from "../../../../components/forms/FormControls";
import { SheetSelect } from "../../../../components/forms/SheetSelect";
import { BottomSheetKeyboardAwareScrollView } from "../../../../components/generation/BottomSheetKeyboardAwareScrollView";
import { useGenerationInputCommitRegistration } from "../../../../context/GenerationInputCommitContext";
import {
  MODELS,
  NAI_RESOLUTIONS,
  NOISE_SCHEDULES,
  SAMPLERS,
  type NaiResolution,
} from "../../../../constants/generation";
import { useGenerationChromeMetrics } from "../../../../hooks/useGenerationChromeMetrics";
import { useGenerationStore } from "../../../../store/generationStore";
import { tokens } from "../../../../styles/tokens";
import { PressableSurface } from "../SheetLayers";
import {
  SettingsHelpButton,
  SettingsSlider,
  type SettingsHelpKey,
} from "./SettingsSlider";

const SETTINGS_ACTION_BAR_HEIGHT = 96;
const SETTINGS_KEYBOARD_GAP = 12;
const SETTINGS_KEYBOARD_SCROLL_MODE =
  Platform.OS === "android" ? "layout" : "insets";
const RESOLUTION_STEP = 64;
const MAX_SEED = 4_294_967_295;

const MODEL_OPTIONS = MODELS.map((option) => option.label);
const RESOLUTION_PRESET_OPTIONS = NAI_RESOLUTIONS.map((group) => group.group);
const SAMPLER_OPTIONS = SAMPLERS.map((option) => option.label);
const SCHEDULE_OPTIONS = NOISE_SCHEDULES.map((option) => option.label);

type SettingsSelectKey = "model" | "resolution" | "sampler" | "schedule";
type ResolutionOrientation = "portrait" | "landscape" | "square";

const ORIENTATION_OPTIONS: ReadonlyArray<{
  value: ResolutionOrientation;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { value: "landscape", icon: "tablet-landscape-outline" },
  { value: "portrait", icon: "tablet-portrait-outline" },
  { value: "square", icon: "square-outline" },
];

function resolutionOrientation(
  resolution: Pick<NaiResolution, "width" | "height">,
): ResolutionOrientation {
  if (resolution.width === resolution.height) return "square";
  return resolution.width > resolution.height ? "landscape" : "portrait";
}

function resolutionPreset(resolution: NaiResolution) {
  const group = NAI_RESOLUTIONS.find((candidate) =>
    candidate.options.some(
      (option) =>
        option.width === resolution.width && option.height === resolution.height,
    ),
  );
  return group?.group ?? "Custom";
}

function presetResolution(
  preset: string,
  orientation: ResolutionOrientation,
): NaiResolution | undefined {
  const group = NAI_RESOLUTIONS.find((candidate) => candidate.group === preset);
  return group?.options.find(
    (option) => resolutionOrientation(option) === orientation,
  );
}

function resolutionFromDimensions(width: number, height: number): NaiResolution {
  for (const group of NAI_RESOLUTIONS) {
    const preset = group.options.find(
      (option) => option.width === width && option.height === height,
    );
    if (preset) return preset;
  }

  return {
    label: `Custom ${width}x${height}`,
    width,
    height,
  };
}

function snapResolutionDimension(value: string) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return RESOLUTION_STEP;
  return Math.max(
    RESOLUTION_STEP,
    Math.round(parsed / RESOLUTION_STEP) * RESOLUTION_STEP,
  );
}

function ResolutionDimensionInputs({
  resolution,
  onChange,
}: {
  resolution: NaiResolution;
  onChange: (resolution: NaiResolution) => void;
}) {
  const focusedInputRef = useRef<"width" | "height" | null>(null);
  const [widthText, setWidthText] = useState(String(resolution.width));
  const [heightText, setHeightText] = useState(String(resolution.height));
  const widthTextRef = useRef(widthText);
  const heightTextRef = useRef(heightText);

  useEffect(() => {
    if (focusedInputRef.current !== null) return;
    const nextWidth = String(resolution.width);
    const nextHeight = String(resolution.height);
    widthTextRef.current = nextWidth;
    heightTextRef.current = nextHeight;
    setWidthText(nextWidth);
    setHeightText(nextHeight);
  }, [resolution.height, resolution.width]);

  const commitDimensions = useCallback(() => {
    const width = snapResolutionDimension(widthTextRef.current);
    const height = snapResolutionDimension(heightTextRef.current);
    const nextWidth = String(width);
    const nextHeight = String(height);
    widthTextRef.current = nextWidth;
    heightTextRef.current = nextHeight;
    setWidthText(nextWidth);
    setHeightText(nextHeight);
    onChange(resolutionFromDimensions(width, height));
  }, [onChange]);
  const widthCommit = useGenerationInputCommitRegistration(commitDimensions);
  const heightCommit = useGenerationInputCommitRegistration(commitDimensions);

  function swapDimensions() {
    const width = snapResolutionDimension(heightTextRef.current);
    const height = snapResolutionDimension(widthTextRef.current);
    const nextWidth = String(width);
    const nextHeight = String(height);
    widthTextRef.current = nextWidth;
    heightTextRef.current = nextHeight;
    setWidthText(nextWidth);
    setHeightText(nextHeight);
    onChange(resolutionFromDimensions(width, height));
  }

  return (
    <View style={styles.resolutionValue}>
      <BottomSheetTextInput
        accessibilityLabel="Resolution width"
        value={widthText}
        onChangeText={(value) => {
          const next = value.replace(/\D/g, "");
          widthTextRef.current = next;
          setWidthText(next);
        }}
        onFocus={() => {
          focusedInputRef.current = "width";
          widthCommit.activate();
        }}
        onBlur={() => {
          focusedInputRef.current = null;
          widthCommit.commitAndDeactivate();
        }}
        onSubmitEditing={commitDimensions}
        keyboardType="number-pad"
        returnKeyType="done"
        submitBehavior="blurAndSubmit"
        selectTextOnFocus
        style={styles.resolutionDimensionInput}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Width와 Height 바꾸기"
        onPress={swapDimensions}
        style={({ pressed }) => [
          styles.resolutionSwapButton,
          pressed && styles.pressed,
        ]}
      >
        <Ionicons
          name="close"
          size={14}
          color={tokens.color.textMuted}
        />
      </Pressable>
      <BottomSheetTextInput
        accessibilityLabel="Resolution height"
        value={heightText}
        onChangeText={(value) => {
          const next = value.replace(/\D/g, "");
          heightTextRef.current = next;
          setHeightText(next);
        }}
        onFocus={() => {
          focusedInputRef.current = "height";
          heightCommit.activate();
        }}
        onBlur={() => {
          focusedInputRef.current = null;
          heightCommit.commitAndDeactivate();
        }}
        onSubmitEditing={commitDimensions}
        keyboardType="number-pad"
        returnKeyType="done"
        submitBehavior="blurAndSubmit"
        selectTextOnFocus
        style={styles.resolutionDimensionInput}
      />
    </View>
  );
}

export function SettingsSheetContent() {
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
  const seed = useGenerationStore((state) => state.seed);
  const setSeed = useGenerationStore((state) => state.setSeed);
  const seedLocked = useGenerationStore((state) => state.seedLocked);
  const setSeedLocked = useGenerationStore((state) => state.setSeedLocked);
  const currentImageSeed = useGenerationStore(
    (state) => state.currentGeneration?.seed ?? null,
  );
  const canUseCurrentImageSeed = useGenerationStore(
    (state) =>
      state.currentGeneration?.seed != null &&
      !state.isLoading &&
      state.streamingPreviewUri == null,
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
  const seedInputFocusedRef = useRef(false);
  const [seedDraft, setSeedDraft] = useState(seedLocked ? String(seed) : "");
  const seedDraftRef = useRef(seedDraft);

  useEffect(() => {
    if (!seedInputFocusedRef.current) {
      const next = seedLocked ? String(seed) : "";
      seedDraftRef.current = next;
      setSeedDraft(next);
    }
  }, [seed, seedLocked]);

  const modelLabel =
    MODELS.find((option) => option.value === model)?.label ?? model;
  const samplerLabel =
    SAMPLERS.find((option) => option.value === sampler)?.label ?? sampler;
  const scheduleLabel =
    NOISE_SCHEDULES.find((option) => option.value === schedule)?.label ??
    schedule;
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
    const option = NOISE_SCHEDULES.find((candidate) => candidate.label === label);
    if (option) setSchedule(option.value);
  }

  function applySeedText(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 10);
    seedDraftRef.current = digits;
    setSeedDraft(digits);

    if (digits === "") {
      setSeed(0);
      setSeedLocked(false);
      return;
    }

    const parsed = Number(digits);
    if (Number.isSafeInteger(parsed) && parsed <= MAX_SEED) {
      setSeed(parsed);
      setSeedLocked(true);
    }
  }

  const commitSeedDraft = useCallback(() => {
    if (seedDraftRef.current === "") {
      setSeed(0);
      setSeedLocked(false);
      return;
    }

    const parsed = Number(seedDraftRef.current);
    const next = Number.isSafeInteger(parsed)
      ? Math.min(MAX_SEED, Math.max(0, parsed))
      : 0;
    const nextText = String(next);
    seedDraftRef.current = nextText;
    setSeedDraft(nextText);
    setSeed(next);
    setSeedLocked(true);
  }, [setSeed, setSeedLocked]);
  const seedCommit = useGenerationInputCommitRegistration(commitSeedDraft);

  function handleSeedAction() {
    if (seedDraft !== "") {
      seedDraftRef.current = "";
      setSeedDraft("");
      setSeed(0);
      setSeedLocked(false);
      return;
    }

    if (currentImageSeed == null || !canUseCurrentImageSeed) return;
    const next = String(currentImageSeed);
    seedDraftRef.current = next;
    setSeedDraft(next);
    setSeed(currentImageSeed);
    setSeedLocked(true);
  }

  return (
    <BottomSheetKeyboardAwareScrollView
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
          overlayOpen={helpKey === "variety"}
          trailing={
            <View style={styles.varietyControl}>
              <Text style={styles.varietyLabel}>Variety+</Text>
              <SettingsHelpButton
                helpKey="variety"
                open={helpKey === "variety"}
                alignRight
                onToggle={() => toggleHelp("variety")}
              />
              <Toggle
                value={varietyPlus}
                label="Variety+"
                onChange={setVarietyPlus}
              />
            </View>
          }
        />
        <View style={styles.aiColumns}>
          <View style={styles.seedColumn}>
            <Text style={styles.settingsFieldLabel}>Seed</Text>
            <View style={styles.seedField}>
              <BottomSheetTextInput
                accessibilityLabel="Seed 값"
                value={seedDraft}
                onChangeText={applySeedText}
                onFocus={() => {
                  seedInputFocusedRef.current = true;
                  seedCommit.activate();
                }}
                onBlur={() => {
                  seedInputFocusedRef.current = false;
                  seedCommit.commitAndDeactivate();
                }}
                onSubmitEditing={commitSeedDraft}
                keyboardType="number-pad"
                returnKeyType="done"
                submitBehavior="blurAndSubmit"
                maxLength={10}
                placeholder="Enter a seed"
                placeholderTextColor={tokens.color.textMuted}
                selectTextOnFocus
                style={styles.seedValueText}
              />
              <PressableSurface
                accessibilityLabel={
                  seedDraft === ""
                    ? "현재 이미지 Seed 가져오기"
                    : "Seed 지우기"
                }
                disabled={seedDraft === "" && !canUseCurrentImageSeed}
                onPress={handleSeedAction}
                style={styles.seedActionButton}
              >
                <Ionicons
                  name={seedDraft === "" ? "dice-outline" : "close"}
                  size={18}
                  color={tokens.color.textSecondary}
                />
              </PressableSurface>
            </View>
          </View>
          <SheetSelect
            label="Sampler"
            value={samplerLabel}
            options={SAMPLER_OPTIONS}
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
            <SheetSelect
              label="Schedule"
              value={scheduleLabel}
              options={SCHEDULE_OPTIONS}
              onChange={changeSchedule}
              open={openSelect === "schedule"}
              onOpenChange={(open) => setSelectOpen("schedule", open)}
            />
          </View>
        ) : null}
      </View>
    </BottomSheetKeyboardAwareScrollView>
  );
}

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
  resolutionValue: {
    height: 34,
    marginLeft: "auto",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 10,
    backgroundColor: tokens.color.raised,
  },
  resolutionDimensionInput: {
    width: 36,
    height: 34,
    padding: 0,
    textAlign: "center",
    textAlignVertical: "center",
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.medium,
    fontSize: 14,
    fontVariant: ["tabular-nums"],
  },
  resolutionSwapButton: {
    width: 20,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
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
  seedField: {
    height: 46,
    paddingLeft: 12,
    paddingRight: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 14,
    backgroundColor: tokens.color.raised,
  },
  seedValueText: {
    flex: 1,
    minWidth: 0,
    height: 46,
    padding: 0,
    textAlignVertical: "center",
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.regular,
    fontSize: 15,
    fontVariant: ["tabular-nums"],
  },
  seedActionButton: {
    width: 36,
    height: 36,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    backgroundColor: tokens.color.sunken,
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
    opacity: 0.65,
  },
});
