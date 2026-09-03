import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BackHandler,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import BottomSheet, {
  type BottomSheetFooterProps,
  type BottomSheetHandleProps,
  BottomSheetTextInput,
  BottomSheetView,
  useBottomSheetTimingConfigs,
} from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Reanimated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import {
  usePredictiveBackHandler,
  type PredictiveBackEvent,
} from "../../native/predictiveBack";
import { Slider } from "../../components/forms/Slider";
import { SheetSelect } from "../../components/forms/SheetSelect";
import { Toggle } from "../../components/forms/FormControls";
import { BottomSheetKeyboardAwareScrollView } from "../../components/generation/BottomSheetKeyboardAwareScrollView";
import {
  HistorySheetContent,
  HistorySheetFooter,
  HistorySheetHandle,
  type HistorySheetController,
  useHistorySheetController,
} from "../../components/generation/HistorySheetContent";
import { PromptSheetContent } from "../../components/generation/PromptSheetContent";
import {
  useGenerationInputCommit,
  useGenerationInputCommitRegistration,
} from "../../context/GenerationInputCommitContext";
import {
  MODELS,
  NAI_RESOLUTIONS,
  NOISE_SCHEDULES,
  SAMPLERS,
  type NaiResolution,
} from "../../constants/generation";
import { useGenerationChromeMetrics } from "../../hooks/useGenerationChromeMetrics";
import { useGenerationStore } from "../../store/generationStore";
import { tokens } from "../../styles/tokens";

export type UtilitySheet = "settings" | "history";
export type PromptSheetStage = "collapsed" | "half" | "full";

type PromptTab = "prompt" | "reference" | "chunks";

const PROMPT_HALF_TOP = 400;
const PROMPT_PAGE_SWIPE_THRESHOLD = 0.18;
const PROMPT_PAGE_VELOCITY_THRESHOLD = 650;
const PROMPT_PAGE_ANIMATION_DURATION = 260;
const SETTINGS_ACTION_BAR_HEIGHT = 96;
const SETTINGS_KEYBOARD_GAP = 12;
const SETTINGS_KEYBOARD_SCROLL_MODE =
  Platform.OS === "android" ? "layout" : "insets";
const RESOLUTION_STEP = 64;
const MAX_SEED = 4_294_967_295;
const PREDICTIVE_BACK_SCALE_STOP = 0.6;
const PREDICTIVE_BACK_MIN_SCALE = 0.94;
const PREDICTIVE_BACK_CANCEL_SPRING = {
  damping: 30,
  stiffness: 320,
  mass: 0.75,
};
const PROMPT_BACKDROP_Z_INDEX = 70;
const PROMPT_SHEET_Z_INDEX = 80;
const UTILITY_BACKDROP_Z_INDEX = 82;
const UTILITY_SHEET_Z_INDEX = 85;
const AnimatedBottomSheetTextInput =
  Reanimated.createAnimatedComponent(BottomSheetTextInput);

const PROMPT_TABS: Array<{ key: PromptTab; label: string }> = [
  { key: "prompt", label: "Prompt" },
  { key: "reference", label: "Reference Images" },
  { key: "chunks", label: "Chunks" },
];

const MODEL_OPTIONS = MODELS.map((option) => option.label);
const RESOLUTION_PRESET_OPTIONS = NAI_RESOLUTIONS.map((group) => group.group);
const SAMPLER_OPTIONS = SAMPLERS.map((option) => option.label);
const SCHEDULE_OPTIONS = NOISE_SCHEDULES.map((option) => option.label);

type SettingsSelectKey = "model" | "resolution" | "sampler" | "schedule";
type SettingsHelpKey = "steps" | "promptGuidance" | "rescale" | "variety";
type ResolutionOrientation = "portrait" | "landscape" | "square";

const SETTINGS_HELP: Record<SettingsHelpKey, string> = {
  steps:
    "이미지를 정제하는 반복 횟수입니다. 낮으면 빠르게 구도를 시험할 수 있고, 높으면 시간과 비용이 늘지만 항상 더 좋아지지는 않습니다.",
  promptGuidance:
    "프롬프트를 따르는 강도입니다. 낮으면 더 자유롭고 부드러우며, 높으면 지시와 세부 표현이 강해집니다.",
  rescale:
    "높은 Prompt Guidance에서 색이 지나치게 진하거나 경계가 거칠어질 때 완화합니다.",
  variety:
    "초기 구도 단계의 프롬프트 제약을 줄여 포즈와 배경의 다양성을 높입니다.",
};

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

function formatSliderValue(value: number, precision: number) {
  return Number(value.toFixed(precision)).toString();
}

function PredictiveBackSheetLayer({
  progress,
  zIndex,
  children,
}: {
  progress: SharedValue<number>;
  zIndex: number;
  children: React.ReactNode;
}) {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(
          progress.value,
          [0, PREDICTIVE_BACK_SCALE_STOP],
          [1, PREDICTIVE_BACK_MIN_SCALE],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  return (
    <Reanimated.View
      pointerEvents="box-none"
      style={[
        styles.predictiveBackSheetLayer,
        { zIndex, elevation: zIndex },
        animatedStyle,
      ]}
    >
      {children}
    </Reanimated.View>
  );
}

function FixedSheetBackdrop({
  animatedIndex,
  appearsOnIndex,
  disappearsOnIndex,
  visible,
  zIndex,
  accessibilityLabel,
  onPress,
}: {
  animatedIndex: SharedValue<number>;
  appearsOnIndex: number;
  disappearsOnIndex: number;
  visible: boolean;
  zIndex: number;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      animatedIndex.value,
      [disappearsOnIndex, appearsOnIndex],
      [0, 0.62],
      Extrapolation.CLAMP,
    ),
  }));

  return (
    <Reanimated.View
      pointerEvents={visible ? "auto" : "none"}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? "auto" : "no-hide-descendants"}
      style={[
        styles.fixedSheetBackdrop,
        { zIndex, elevation: zIndex },
        animatedStyle,
      ]}
    >
      <Pressable
        accessible={visible}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={styles.fixedSheetBackdropPressable}
      />
    </Reanimated.View>
  );
}

function PressableSurface({
  accessibilityLabel,
  disabled = false,
  onPress,
  style,
  children,
}: {
  accessibilityLabel: string;
  disabled?: boolean;
  onPress: () => void;
  style: object;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        style,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {children}
    </Pressable>
  );
}

function SettingsHelpButton({
  helpKey,
  open,
  alignRight = false,
  onToggle,
}: {
  helpKey: SettingsHelpKey;
  open: boolean;
  alignRight?: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.settingsHelpAnchor}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${helpKey} 설명`}
        accessibilityState={{ expanded: open }}
        hitSlop={6}
        onPress={onToggle}
        style={({ pressed }) => [
          styles.settingsHelpButton,
          open && styles.settingsHelpButtonOpen,
          pressed && styles.pressed,
        ]}
      >
        <Ionicons
          name="information"
          size={12}
          color={open ? tokens.color.onAccent : tokens.color.textMuted}
        />
      </Pressable>
      {open ? (
        <View
          style={[
            styles.settingsHelpTooltip,
            alignRight && styles.settingsHelpTooltipRight,
          ]}
        >
          <Text style={styles.settingsHelpTooltipText}>
            {SETTINGS_HELP[helpKey]}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function SettingsSlider({
  label,
  helpKey,
  helpOpen,
  value,
  min,
  max,
  step,
  precision,
  onHelpToggle,
  onChange,
  trailing,
  overlayOpen = false,
}: {
  label: string;
  helpKey: SettingsHelpKey;
  helpOpen: boolean;
  value: number;
  min: number;
  max: number;
  step: number;
  precision: number;
  onHelpToggle: () => void;
  onChange: (value: number) => void;
  trailing?: React.ReactNode;
  overlayOpen?: boolean;
}) {
  const inputFocusedRef = useRef(false);
  const [draftValue, setDraftValue] = useState(() =>
    formatSliderValue(value, precision),
  );
  const draftValueRef = useRef(draftValue);
  const slidingRef = useRef(false);
  const { commitPendingInput } = useGenerationInputCommit();
  const display = useSharedValue(value);
  const editing = useSharedValue(false);
  const animatedInputProps = useAnimatedProps(() => {
    if (editing.value) return {};
    const text = String(Number(display.value.toFixed(precision)));
    return { text, defaultValue: text } as object;
  });

  useEffect(() => {
    if (!inputFocusedRef.current && !slidingRef.current) {
      const next = formatSliderValue(value, precision);
      draftValueRef.current = next;
      setDraftValue(next);
      display.value = value;
    }
  }, [display, precision, value]);

  const commitDraft = useCallback(() => {
    const parsed = slidingRef.current
      ? display.value
      : Number(draftValueRef.current.trim().replace(",", "."));
    if (!Number.isFinite(parsed)) {
      const fallback = formatSliderValue(value, precision);
      draftValueRef.current = fallback;
      setDraftValue(fallback);
      display.value = value;
      return;
    }

    const clamped = Math.min(max, Math.max(min, parsed));
    const stepped = min + Math.round((clamped - min) / step) * step;
    const next = Number(
      Math.min(max, Math.max(min, stepped)).toFixed(precision),
    );
    const formatted = formatSliderValue(next, precision);
    draftValueRef.current = formatted;
    setDraftValue(formatted);
    display.value = next;
    onChange(next);
  }, [display, max, min, onChange, precision, step, value]);
  const inputCommit = useGenerationInputCommitRegistration(commitDraft);

  function handleSliderComplete(next: number) {
    const formatted = formatSliderValue(next, precision);
    slidingRef.current = false;
    draftValueRef.current = formatted;
    inputCommit.commitAndDeactivate();
  }

  return (
    <View
      style={[
        styles.settingsSliderField,
        (helpOpen || overlayOpen) && styles.settingsSliderFieldOverlayOpen,
      ]}
    >
      <View style={styles.settingsSliderHeader}>
        <View style={styles.settingsFieldLabelRow}>
          <Text style={styles.settingsFieldLabel}>{label}</Text>
          <SettingsHelpButton
            helpKey={helpKey}
            open={helpOpen}
            onToggle={onHelpToggle}
          />
        </View>
        {trailing}
      </View>
      <View style={styles.settingsSliderControls}>
        <View style={styles.settingsSliderValueBox}>
          <AnimatedBottomSheetTextInput
            accessibilityLabel={`${label} 값`}
            value={draftValue}
            animatedProps={animatedInputProps}
            onChangeText={(next) => {
              editing.value = true;
              draftValueRef.current = next;
              setDraftValue(next);
            }}
            onFocus={() => {
              inputFocusedRef.current = true;
              editing.value = true;
              const next = formatSliderValue(display.value, precision);
              draftValueRef.current = next;
              setDraftValue(next);
              inputCommit.activate();
            }}
            onBlur={() => {
              inputFocusedRef.current = false;
              editing.value = false;
              inputCommit.commitAndDeactivate();
              if (slidingRef.current) inputCommit.activate();
            }}
            onSubmitEditing={commitDraft}
            keyboardType={precision === 0 ? "number-pad" : "decimal-pad"}
            returnKeyType="done"
            submitBehavior="blurAndSubmit"
            selectTextOnFocus
            style={styles.settingsSliderValue}
          />
        </View>
        <Slider
          accessibilityLabel={label}
          value={value}
          min={min}
          max={max}
          step={step}
          precision={precision}
          display={display}
          trackHeight={6}
          thumbSize={24}
          pill
          jumpOnTap
          onSlidingStart={() => {
            slidingRef.current = true;
            editing.value = false;
            commitPendingInput();
            inputCommit.activate();
          }}
          trackBg={tokens.color.sunken}
          thumbBorderWidth={0}
          onSlidingComplete={handleSliderComplete}
          style={styles.settingsSliderTrack}
        />
      </View>
    </View>
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

function SettingsSheetContent() {
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

const UtilitySheetContent = memo(function UtilitySheetContent({
  sheet,
  onClose,
  historyController,
}: {
  sheet: UtilitySheet;
  onClose: () => void;
  historyController: HistorySheetController;
}) {
  if (sheet === "history") {
    return <HistorySheetContent controller={historyController} />;
  }

  const title = "Settings";

  return (
    <BottomSheetView style={styles.sheetBody}>
      <View style={styles.utilityHeader}>
        <Text style={styles.utilityTitle}>{title}</Text>
        <PressableSurface
          accessibilityLabel={`${title} 닫기`}
          onPress={onClose}
          style={styles.closeButton}
        >
          <Ionicons name="close" size={21} color={tokens.color.textPrimary} />
        </PressableSurface>
      </View>
      <View style={styles.divider} />
      <SettingsSheetContent />
    </BottomSheetView>
  );
});

function PromptHeader({
  preview,
  stage,
  animatedIndex,
  tab,
  counts,
  onTabChange,
  onExpand,
  onCollapse,
}: {
  preview: string;
  stage: PromptSheetStage;
  animatedIndex: SharedValue<number>;
  tab: PromptTab;
  counts: Record<PromptTab, number>;
  onTabChange: (tab: PromptTab) => void;
  onExpand: () => void;
  onCollapse: () => void;
}) {
  const previewStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      animatedIndex.value,
      [0, 0.55, 1],
      [1, 0.2, 0],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateY: interpolate(
          animatedIndex.value,
          [0, 1],
          [0, -5],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));
  const tabsStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      animatedIndex.value,
      [0, 0.45, 1],
      [0, 0.8, 1],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateY: interpolate(
          animatedIndex.value,
          [0, 1],
          [5, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));
  const collapsed = stage === "collapsed";

  return (
    <View style={styles.promptHeader}>
      <Reanimated.View
        pointerEvents={collapsed ? "auto" : "none"}
        accessibilityElementsHidden={!collapsed}
        importantForAccessibility={collapsed ? "auto" : "no-hide-descendants"}
        style={[styles.promptHeaderLayer, styles.previewLayer, previewStyle]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Prompt 펼치기"
          onPress={onExpand}
          style={({ pressed }) => [
            styles.promptPreviewButton,
            pressed && styles.pressed,
          ]}
        >
          <Text numberOfLines={1} style={styles.promptPreviewText}>
            {preview.trim() || "Prompt를 입력하세요"}
          </Text>
          <Ionicons
            name="chevron-up"
            size={17}
            color={tokens.color.textSecondary}
          />
        </Pressable>
      </Reanimated.View>

      <Reanimated.View
        pointerEvents={collapsed ? "none" : "auto"}
        accessibilityElementsHidden={collapsed}
        importantForAccessibility={collapsed ? "no-hide-descendants" : "auto"}
        style={[styles.promptHeaderLayer, styles.tabsLayer, tabsStyle]}
      >
        <View style={styles.promptTabs}>
          {PROMPT_TABS.map((item) => {
            const active = item.key === tab;
            return (
              <Pressable
                key={item.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => onTabChange(item.key)}
                style={({ pressed }) => [
                  styles.promptTab,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.promptTabContent}>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.promptTabLabel,
                      active && styles.promptTabLabelActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                  {item.key !== "chunks" && counts[item.key] > 0 ? (
                    <View style={styles.promptTabBadge}>
                      <Text style={styles.promptTabBadgeText}>
                        {counts[item.key]}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <View
                  style={[
                    styles.promptTabIndicator,
                    active && styles.promptTabIndicatorActive,
                  ]}
                />
              </Pressable>
            );
          })}
        </View>
        <PressableSurface
          accessibilityLabel="Prompt 접기"
          onPress={onCollapse}
          style={styles.promptCloseButton}
        >
          <Ionicons
            name="chevron-down"
            size={19}
            color={tokens.color.textPrimary}
          />
        </PressableSurface>
      </Reanimated.View>
    </View>
  );
}

export function PromptSheetHost({
  promptPreview,
  promptStage,
  predictiveBackProgress,
  onPromptStageChange,
}: {
  promptPreview: string;
  promptStage: PromptSheetStage;
  predictiveBackProgress: SharedValue<number>;
  onPromptStageChange: (stage: PromptSheetStage) => void;
}) {
  const sheetRef = useRef<BottomSheet>(null);
  const { commitPendingInput } = useGenerationInputCommit();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const { promptCollapsedHeight, promptFullTop } = useGenerationChromeMetrics();
  const [promptTab, setPromptTab] = useState<PromptTab>("prompt");
  const referenceCount = useGenerationStore(
    (state) =>
      (state.i2iSourceImage ? 1 : 0) +
      state.vibeReferences.length +
      state.preciseReferences.length,
  );
  const animatedIndex = useSharedValue(0);
  const promptPageIndex = useSharedValue(0);
  const promptPageTranslateX = useSharedValue(0);
  const promptPageDragStartX = useSharedValue(0);
  const animationConfigs = useBottomSheetTimingConfigs({
    duration: 300,
    easing: Easing.bezier(0.32, 0.72, 0, 1),
  });
  const snapPoints = useMemo(
    () => [
      promptCollapsedHeight,
      Math.max(promptCollapsedHeight, windowHeight - PROMPT_HALF_TOP),
      Math.max(promptCollapsedHeight, windowHeight - promptFullTop),
    ],
    [promptCollapsedHeight, promptFullTop, windowHeight],
  );
  const stageIndex =
    promptStage === "collapsed" ? 0 : promptStage === "half" ? 1 : 2;

  useEffect(() => {
    sheetRef.current?.snapToIndex(stageIndex);
  }, [stageIndex]);

  const handleSheetChange = useCallback(
    (index: number) => {
      if (index === 0) onPromptStageChange("collapsed");
      if (index === 1) onPromptStageChange("half");
      if (index === 2) onPromptStageChange("full");
    },
    [onPromptStageChange],
  );
  const expandPrompt = useCallback(() => {
    sheetRef.current?.snapToIndex(1);
  }, []);
  const collapsePrompt = useCallback(() => {
    commitPendingInput();
    Keyboard.dismiss();
    sheetRef.current?.snapToIndex(0);
  }, [commitPendingInput]);
  const selectPromptPage = useCallback(
    (index: number) => {
      const nextTab = PROMPT_TABS[index]?.key;
      if (!nextTab) return;
      commitPendingInput();
      Keyboard.dismiss();
      setPromptTab(nextTab);
    },
    [commitPendingInput],
  );
  const changePromptTab = useCallback(
    (tab: PromptTab) => {
      const nextIndex = PROMPT_TABS.findIndex((item) => item.key === tab);
      if (nextIndex < 0) return;

      commitPendingInput();
      Keyboard.dismiss();
      setPromptTab(tab);
      promptPageIndex.value = nextIndex;
      promptPageTranslateX.value = withTiming(-nextIndex * windowWidth, {
        duration: PROMPT_PAGE_ANIMATION_DURATION,
        easing: Easing.bezier(0.32, 0.72, 0, 1),
      });
    },
    [commitPendingInput, promptPageIndex, promptPageTranslateX, windowWidth],
  );
  const promptPageGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(promptStage !== "collapsed")
        .activeOffsetX([-18, 18])
        .failOffsetY([-10, 10])
        .shouldCancelWhenOutside(false)
        .onStart(() => {
          cancelAnimation(promptPageTranslateX);
          promptPageDragStartX.value = promptPageTranslateX.value;
        })
        .onUpdate((event) => {
          const minimumTranslateX = -windowWidth * (PROMPT_TABS.length - 1);
          const nextTranslateX = promptPageDragStartX.value + event.translationX;

          if (nextTranslateX > 0) {
            promptPageTranslateX.value = nextTranslateX * 0.2;
          } else if (nextTranslateX < minimumTranslateX) {
            promptPageTranslateX.value =
              minimumTranslateX + (nextTranslateX - minimumTranslateX) * 0.2;
          } else {
            promptPageTranslateX.value = nextTranslateX;
          }
        })
        .onEnd((event) => {
          const currentIndex = promptPageIndex.value;
          const movedToNext =
            event.translationX < -windowWidth * PROMPT_PAGE_SWIPE_THRESHOLD ||
            event.velocityX < -PROMPT_PAGE_VELOCITY_THRESHOLD;
          const movedToPrevious =
            event.translationX > windowWidth * PROMPT_PAGE_SWIPE_THRESHOLD ||
            event.velocityX > PROMPT_PAGE_VELOCITY_THRESHOLD;
          const nextIndex = Math.min(
            PROMPT_TABS.length - 1,
            Math.max(
              0,
              currentIndex + (movedToNext ? 1 : movedToPrevious ? -1 : 0),
            ),
          );

          promptPageIndex.value = nextIndex;
          promptPageTranslateX.value = withTiming(-nextIndex * windowWidth, {
            duration: PROMPT_PAGE_ANIMATION_DURATION,
            easing: Easing.bezier(0.32, 0.72, 0, 1),
          });
          runOnJS(selectPromptPage)(nextIndex);
        })
        .onFinalize((_event, success) => {
          if (success) return;
          promptPageTranslateX.value = withTiming(
            -promptPageIndex.value * windowWidth,
            {
              duration: PROMPT_PAGE_ANIMATION_DURATION,
              easing: Easing.bezier(0.32, 0.72, 0, 1),
            },
          );
        }),
    [
      promptPageDragStartX,
      promptPageIndex,
      promptPageTranslateX,
      promptStage,
      selectPromptPage,
      windowWidth,
    ],
  );
  const promptPageTrackStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: promptPageTranslateX.value }],
  }));

  useEffect(() => {
    promptPageTranslateX.value = -promptPageIndex.value * windowWidth;
  }, [promptPageIndex, promptPageTranslateX, windowWidth]);

  return (
    <>
      <FixedSheetBackdrop
        animatedIndex={animatedIndex}
        appearsOnIndex={1}
        disappearsOnIndex={0}
        visible={promptStage !== "collapsed"}
        zIndex={PROMPT_BACKDROP_Z_INDEX}
        accessibilityLabel="Prompt 접기"
        onPress={collapsePrompt}
      />
      <PredictiveBackSheetLayer
        progress={predictiveBackProgress}
        zIndex={PROMPT_SHEET_Z_INDEX}
      >
        <BottomSheet
          ref={sheetRef}
          index={stageIndex}
          snapPoints={snapPoints}
          animatedIndex={animatedIndex}
          animationConfigs={animationConfigs}
          animateOnMount={false}
          enableDynamicSizing={false}
          enableContentPanningGesture
          enableHandlePanningGesture
          enableOverDrag={false}
          enablePanDownToClose={false}
          enableBlurKeyboardOnGesture
          keyboardBehavior="extend"
          keyboardBlurBehavior="restore"
          android_keyboardInputMode="adjustResize"
          activeOffsetY={[-10, 10]}
          failOffsetX={[-18, 18]}
          waitFor={promptPageGesture}
          handleStyle={styles.handleArea}
          handleIndicatorStyle={styles.handleIndicator}
          containerStyle={styles.promptSheetContainer}
          backgroundStyle={styles.sheetBackground}
          onChange={handleSheetChange}
        >
          <BottomSheetView style={styles.sheetBody}>
            <PromptHeader
              preview={promptPreview}
              stage={promptStage}
              animatedIndex={animatedIndex}
              tab={promptTab}
              counts={{
                prompt: 0,
                reference: referenceCount,
                chunks: 0,
              }}
              onTabChange={changePromptTab}
              onExpand={expandPrompt}
              onCollapse={collapsePrompt}
            />
            <GestureDetector gesture={promptPageGesture}>
              <View style={styles.promptPagerViewport}>
                <Reanimated.View
                  style={[
                    styles.promptPagerTrack,
                    { width: windowWidth * PROMPT_TABS.length },
                    promptPageTrackStyle,
                  ]}
                >
                  {PROMPT_TABS.map((item) => {
                    const active =
                      promptTab === item.key && promptStage !== "collapsed";
                    return (
                      <View
                        key={item.key}
                        testID={`prompt-page-${item.key}`}
                        accessibilityElementsHidden={!active}
                        importantForAccessibility={
                          active ? "auto" : "no-hide-descendants"
                        }
                        style={[styles.promptPage, { width: windowWidth }]}
                      >
                        {item.key === "prompt" ? (
                          <PromptSheetContent active={active} />
                        ) : (
                          <View style={styles.emptyPromptPage} />
                        )}
                      </View>
                    );
                  })}
                </Reanimated.View>
              </View>
            </GestureDetector>
          </BottomSheetView>
        </BottomSheet>
      </PredictiveBackSheetLayer>
    </>
  );
}

export function UtilitySheetHost({
  sheet,
  predictiveBackProgress,
  onClose,
}: {
  sheet: UtilitySheet | null;
  predictiveBackProgress: SharedValue<number>;
  onClose: () => void;
}) {
  const sheetRef = useRef<BottomSheet>(null);
  const animatedIndex = useSharedValue(-1);
  const [renderedSheet, setRenderedSheet] =
    useState<UtilitySheet | null>(sheet);
  const historyController = useHistorySheetController({ onClose });
  const { height: windowHeight } = useWindowDimensions();
  const { utilitySheetTop } = useGenerationChromeMetrics();
  const snapPoints = useMemo(
    () => [Math.max(1, windowHeight - utilitySheetTop)],
    [utilitySheetTop, windowHeight],
  );
  const animationConfigs = useBottomSheetTimingConfigs({
    duration: 300,
    easing: Easing.bezier(0.32, 0.72, 0, 1),
  });
  const handleSheetClosed = useCallback(() => {
    setRenderedSheet(null);
    onClose();
  }, [onClose]);
  const renderHistoryFooter = useCallback(
    (props: BottomSheetFooterProps) => (
      <HistorySheetFooter {...props} controller={historyController} />
    ),
    [historyController],
  );
  const renderHistoryHandle = useCallback(
    (_props: BottomSheetHandleProps) => (
      <HistorySheetHandle controller={historyController} />
    ),
    [historyController],
  );
  const historySelectionBackActive =
    renderedSheet === "history" && historyController.selectionMode;

  usePredictiveBackHandler(historySelectionBackActive, {
    onStart: () => {
      cancelAnimation(predictiveBackProgress);
      predictiveBackProgress.value = 0;
    },
    onProgress: () => {
      predictiveBackProgress.value = 0;
    },
    onCancel: () => {
      predictiveBackProgress.value = 0;
    },
    onCommit: () => {
      predictiveBackProgress.value = 0;
      historyController.exitSelectionMode();
    },
  });

  useEffect(() => {
    if (sheet === null) {
      if (renderedSheet !== null) sheetRef.current?.close();
      return;
    }

    if (sheet !== renderedSheet) {
      setRenderedSheet(sheet);
    }
  }, [renderedSheet, sheet]);

  useEffect(() => {
    if (sheet !== "history") historyController.exitSelectionMode();
  }, [historyController.exitSelectionMode, sheet]);

  useEffect(() => {
    if (!historySelectionBackActive) return;

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        historyController.exitSelectionMode();
        return true;
      },
    );
    return () => subscription.remove();
  }, [historyController.exitSelectionMode, historySelectionBackActive]);

  if (renderedSheet === null) return null;

  return (
    <>
      <FixedSheetBackdrop
        animatedIndex={animatedIndex}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        visible
        zIndex={UTILITY_BACKDROP_Z_INDEX}
        accessibilityLabel={`${renderedSheet === "settings" ? "Settings" : "History"} 닫기`}
        onPress={onClose}
      />
      <PredictiveBackSheetLayer
        progress={predictiveBackProgress}
        zIndex={UTILITY_SHEET_Z_INDEX}
      >
        <BottomSheet
          key={renderedSheet}
          ref={sheetRef}
          index={0}
          snapPoints={snapPoints}
          animatedIndex={animatedIndex}
          animationConfigs={animationConfigs}
          animateOnMount
          enableDynamicSizing={false}
          enableContentPanningGesture
          enableHandlePanningGesture
          enableOverDrag={false}
          enablePanDownToClose
          enableBlurKeyboardOnGesture
          keyboardBehavior="extend"
          keyboardBlurBehavior="restore"
          android_keyboardInputMode="adjustResize"
          handleComponent={
            renderedSheet === "history" ? renderHistoryHandle : undefined
          }
          footerComponent={
            renderedSheet === "history" ? renderHistoryFooter : undefined
          }
          handleStyle={styles.handleArea}
          handleIndicatorStyle={styles.handleIndicator}
          style={styles.utilitySheetMask}
          containerStyle={styles.utilitySheetContainer}
          backgroundStyle={styles.sheetBackground}
          onClose={handleSheetClosed}
        >
          <UtilitySheetContent
            sheet={renderedSheet}
            onClose={onClose}
            historyController={historyController}
          />
        </BottomSheet>
      </PredictiveBackSheetLayer>
    </>
  );
}

const styles = StyleSheet.create({
  fixedSheetBackdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "#0A0A0C",
  },
  fixedSheetBackdropPressable: {
    flex: 1,
  },
  predictiveBackSheetLayer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    transformOrigin: "center bottom",
  },
  promptSheetContainer: {
    zIndex: 80,
    elevation: 80,
  },
  utilitySheetContainer: {
    zIndex: 85,
    elevation: 85,
  },
  utilitySheetMask: {
    overflow: "hidden",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  sheetBackground: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: tokens.color.cardAlt,
    shadowColor: "#000000",
    shadowOpacity: 0.55,
    shadowRadius: 44,
    shadowOffset: { width: 0, height: -18 },
  },
  handleArea: {
    height: 17,
    paddingTop: 9,
    paddingBottom: 3,
  },
  handleIndicator: {
    width: 38,
    height: 5,
    borderRadius: 3,
    backgroundColor: tokens.color.borderSubtleStrong,
  },
  sheetBody: {
    flex: 1,
    bottom: 0,
  },
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
  settingsFieldLabelRow: {
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  settingsHelpAnchor: {
    position: "relative",
    zIndex: 30,
  },
  settingsHelpButton: {
    width: 19,
    height: 19,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.raised,
  },
  settingsHelpButtonOpen: {
    backgroundColor: tokens.color.accent,
  },
  settingsHelpTooltip: {
    position: "absolute",
    top: 26,
    left: -12,
    width: 280,
    zIndex: 30,
    paddingHorizontal: 15,
    paddingVertical: 13,
    borderRadius: 16,
    backgroundColor: tokens.color.toast,
    ...tokens.shadow.floatMd,
  },
  settingsHelpTooltipRight: {
    right: -54,
    left: undefined,
  },
  settingsHelpTooltipText: {
    color: tokens.color.textSecondary,
    fontFamily: tokens.font.regular,
    fontSize: 13,
    lineHeight: 19,
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
  settingsSliderField: {
    gap: 10,
  },
  settingsSliderFieldOverlayOpen: {
    zIndex: 30,
  },
  settingsSliderHeader: {
    minHeight: 19,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    zIndex: 3,
  },
  settingsSliderControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  settingsSliderValueBox: {
    width: 64,
    height: 38,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    borderRadius: 12,
    backgroundColor: tokens.color.sunken,
  },
  settingsSliderValue: {
    width: "100%",
    height: "100%",
    padding: 0,
    textAlign: "center",
    textAlignVertical: "center",
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.medium,
    fontSize: 16,
    fontVariant: ["tabular-nums"],
  },
  settingsSliderTrack: {
    flex: 1,
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
  promptPagerViewport: {
    flex: 1,
    overflow: "hidden",
  },
  promptPagerTrack: {
    flex: 1,
    flexDirection: "row",
  },
  promptPage: {
    height: "100%",
  },
  utilityHeader: {
    height: 52,
    paddingLeft: 20,
    paddingRight: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  utilityTitle: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: 23,
    letterSpacing: -0.3,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.raised,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: tokens.color.borderSubtle,
  },
  promptHeader: {
    height: 46,
    position: "relative",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.color.borderSubtle,
  },
  promptHeaderLayer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  previewLayer: {
    zIndex: 2,
  },
  tabsLayer: {
    zIndex: 1,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "stretch",
  },
  promptPreviewButton: {
    height: 46,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  promptPreviewText: {
    flex: 1,
    color: tokens.color.textSecondary,
    fontFamily: tokens.font.regular,
    fontSize: 15,
    lineHeight: 20,
  },
  promptTabs: {
    flex: 1,
    flexDirection: "row",
    overflow: "hidden",
  },
  promptTab: {
    minWidth: 0,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  promptTabContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  promptTabLabel: {
    color: tokens.color.textMuted,
    fontFamily: tokens.font.semibold,
    fontSize: 15,
  },
  promptTabLabelActive: {
    color: tokens.color.textPrimary,
  },
  promptTabIndicator: {
    position: "absolute",
    right: 12,
    bottom: 0,
    left: 12,
    height: 2,
    backgroundColor: "transparent",
  },
  promptTabIndicatorActive: {
    backgroundColor: tokens.color.accent,
  },
  promptTabBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.raised,
  },
  promptTabBadgeText: {
    color: tokens.color.textSecondary,
    fontFamily: tokens.font.bold,
    fontSize: 11,
  },
  promptCloseButton: {
    width: 34,
    height: 34,
    marginTop: 2,
    marginLeft: 4,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.raised,
  },
  emptyPromptPage: {
    flex: 1,
  },
  pressed: {
    opacity: 0.65,
  },
  disabled: {
    opacity: 0.35,
  },
});
