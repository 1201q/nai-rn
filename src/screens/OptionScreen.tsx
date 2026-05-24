import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { useNavigation } from "@react-navigation/native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { TabBar, TabView } from "react-native-tab-view";

import { Header } from "../components/Header";
import { useGenerationOptions } from "../context/GenerationOptionsContext";
import {
  MODELS,
  NOISE_SCHEDULES,
  SAMPLERS,
  type AspectRatio,
} from "../constants/generation";
import { colors } from "../styles/colors";
import type { OptionScreenNavigationProp } from "../navigation/types";

import { useWindowDimensions } from "react-native";

type SelectionSheetKey = "model" | "sampler" | "noiseSchedule" | null;

const SEEK_THUMB_WIDTH = 8;
const SEEK_THUMB_HEIGHT = 20;
const SEEK_THUMB_TOUCH_SIZE = 38;
const MIN_HAPTIC_INTERVAL_MS = 35;

function triggerSelectionHaptic() {
  Haptics.selectionAsync().catch(() => {});
}

function getOptionLabel(
  options: Array<{ label: string; value: string }>,
  value: string,
) {
  return options.find((o) => o.value === value)?.label ?? value;
}

export function OptionScreen() {
  const layout = useWindowDimensions();

  const navigation = useNavigation<OptionScreenNavigationProp>();
  const {
    prompt,
    setPrompt,
    negativePrompt,
    setNegativePrompt,
    model,
    setModel,
    aspectRatio,
    setAspectRatio,
    steps,
    setSteps,
    promptGuidance,
    setPromptGuidance,
    promptGuidanceRescale,
    setPromptGuidanceRescale,
    noiseSchedule,
    setNoiseSchedule,
    sampler,
    setSampler,
    seedText,
    setSeedText,
    isLoading,
    generateImage,
  } = useGenerationOptions();

  const modelSheetRef = useRef<BottomSheet>(null);
  const samplerSheetRef = useRef<BottomSheet>(null);
  const noiseScheduleSheetRef = useRef<BottomSheet>(null);
  const activeSheetRef = useRef<SelectionSheetKey>(null);

  const [tabIndex, setTabIndex] = useState(1);
  const [tabRoutes] = useState([
    { key: "prompt", title: "Prompt" },
    { key: "options", title: "Options" },
  ]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (activeSheetRef.current) {
          closeSelectionSheet();
          return true;
        }
        return false;
      },
    );
    return () => subscription.remove();
  }, []);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
      />
    ),
    [],
  );

  function openSelectionSheet(next: Exclude<SelectionSheetKey, null>) {
    if (next === "model") {
      samplerSheetRef.current?.close();
      noiseScheduleSheetRef.current?.close();
      activeSheetRef.current = "model";
      requestAnimationFrame(() => modelSheetRef.current?.snapToIndex(0));
      return;
    }

    if (next === "sampler") {
      modelSheetRef.current?.close();
      noiseScheduleSheetRef.current?.close();
      activeSheetRef.current = "sampler";
      requestAnimationFrame(() => samplerSheetRef.current?.snapToIndex(0));
      return;
    }

    modelSheetRef.current?.close();
    samplerSheetRef.current?.close();
    activeSheetRef.current = "noiseSchedule";
    requestAnimationFrame(() => noiseScheduleSheetRef.current?.snapToIndex(0));
  }

  function closeSelectionSheet() {
    if (activeSheetRef.current === "model") {
      modelSheetRef.current?.close();
      return;
    }
    if (activeSheetRef.current === "sampler") {
      samplerSheetRef.current?.close();
      return;
    }
    if (activeSheetRef.current === "noiseSchedule") {
      noiseScheduleSheetRef.current?.close();
    }
  }

  function handleSheetChange(
    sheet: Exclude<SelectionSheetKey, null>,
    index: number,
  ) {
    if (index >= 0) {
      activeSheetRef.current = sheet;
      return;
    }
    if (activeSheetRef.current === sheet) {
      activeSheetRef.current = null;
    }
  }

  function adjustDecimal(
    value: number,
    delta: number,
    min: number,
    max: number,
    precision = 1,
  ) {
    return Math.min(
      max,
      Math.max(min, Number((value + delta).toFixed(precision))),
    );
  }

  function formatDecimal(value: number, precision = 1) {
    return value.toFixed(precision).replace(/\.?0+$/, "");
  }

  function renderScene({ route }: { route: { key: string } }) {
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
        <CollapsibleSection title="Image Settings">
          <OptionBlock label="Aspect Ratio">
            <View style={styles.segmentRow}>
              {(["1:1", "3:4", "16:9"] as AspectRatio[]).map((ratio) => (
                <SegmentButton
                  key={ratio}
                  label={ratio}
                  active={aspectRatio === ratio}
                  onPress={() => setAspectRatio(ratio)}
                />
              ))}
            </View>
          </OptionBlock>
        </CollapsibleSection>
        <CollapsibleSection title="AI Settings">
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
        <CollapsibleSection title="Advanced Settings">
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

  return (
    <View style={styles.screen}>
      <Header title="Options" onBack={() => navigation.goBack()} />

      <TabView
        style={styles.tabView}
        initialLayout={{ width: layout.width }}
        navigationState={{ index: tabIndex, routes: tabRoutes }}
        onIndexChange={setTabIndex}
        renderTabBar={(props) => (
          <TabBar
            {...props}
            style={styles.tabBar}
            indicatorStyle={styles.tabIndicator}
            activeColor={colors.background}
            inactiveColor={colors.grey500}
          />
        )}
        renderScene={renderScene}
      />

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.generateButton, isLoading && styles.disabledButton]}
          activeOpacity={0.82}
          onPress={() => generateImage(() => navigation.goBack())}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.generateText}>Generate</Text>
          )}
        </TouchableOpacity>
      </View>

      <BottomSheet
        ref={modelSheetRef}
        index={-1}
        snapPoints={[390]}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        detached
        bottomInset={14}
        style={styles.sheetContainer}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.sheetHandle}
        enableDynamicSizing={false}
        onChange={(index) => handleSheetChange("model", index)}
      >
        <BottomSheetScrollView
          contentContainerStyle={styles.sheetContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sheetTitle}>Select Model</Text>
          {MODELS.map((item) => (
            <SelectionSheetItem
              key={item.value}
              label={item.label}
              active={model === item.value}
              onPress={() => {
                setModel(item.value);
                closeSelectionSheet();
              }}
            />
          ))}
        </BottomSheetScrollView>
      </BottomSheet>

      <BottomSheet
        ref={samplerSheetRef}
        index={-1}
        snapPoints={[500]}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        detached
        bottomInset={14}
        style={styles.sheetContainer}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.sheetHandle}
        enableDynamicSizing={false}
        onChange={(index) => handleSheetChange("sampler", index)}
      >
        <BottomSheetScrollView
          contentContainerStyle={styles.sheetContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sheetTitle}>Select Sampler</Text>
          {SAMPLERS.map((item) => (
            <SelectionSheetItem
              key={item.value}
              label={item.label}
              active={sampler === item.value}
              onPress={() => {
                setSampler(item.value);
                closeSelectionSheet();
              }}
            />
          ))}
        </BottomSheetScrollView>
      </BottomSheet>

      <BottomSheet
        ref={noiseScheduleSheetRef}
        index={-1}
        snapPoints={[300]}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        detached
        bottomInset={14}
        style={styles.sheetContainer}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.sheetHandle}
        enableDynamicSizing={false}
        onChange={(index) => handleSheetChange("noiseSchedule", index)}
      >
        <View style={styles.sheetContent}>
          <Text style={styles.sheetTitle}>Select Noise Schedule</Text>
          {NOISE_SCHEDULES.map((item) => (
            <SelectionSheetItem
              key={item.value}
              label={item.label}
              active={noiseSchedule === item.value}
              onPress={() => {
                setNoiseSchedule(item.value);
                closeSelectionSheet();
              }}
            />
          ))}
        </View>
      </BottomSheet>
    </View>
  );
}

// --------- 서브 컴포넌트 -------------------------------------------------------

function SelectOption({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.selectOption}
      activeOpacity={0.78}
      onPress={onPress}
    >
      <Text style={styles.optionLabel}>{label}</Text>
      <View style={styles.selectValueWrap}>
        <Text style={styles.optionValue} numberOfLines={1} ellipsizeMode="tail">
          {value}
        </Text>
        <Text style={styles.selectChevron}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

function SelectionSheetItem({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.sheetItem, active && styles.sheetItemActive]}
      activeOpacity={0.78}
      onPress={onPress}
    >
      <Text
        style={[styles.sheetItemText, active && styles.sheetItemTextActive]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function LabeledInput({
  label,
  value,
  onChangeText,
  minHeight,
  count,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  minHeight: number;
  count: string;
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={[styles.textAreaWrap, { minHeight }]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          multiline
          textAlignVertical="top"
          placeholderTextColor={colors.grey500}
          style={styles.textArea}
        />
        <Text style={styles.countText}>{count}</Text>
      </View>
    </View>
  );
}

function OptionBlock({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.optionBlock}>
      <Text style={styles.optionLabel}>{label}</Text>
      <View style={styles.optionBody}>{children}</View>
    </View>
  );
}

function CollapsibleSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(true);
  const [contentHeight, setContentHeight] = useState(0);
  const progress = useSharedValue(1);

  useEffect(() => {
    progress.value = withTiming(expanded ? 1 : 0, { duration: 180 });
  }, [expanded, progress]);

  const animatedBodyStyle = useAnimatedStyle(() => ({
    height: contentHeight * progress.value,
    opacity: progress.value,
  }));

  return (
    <View style={styles.section}>
      <TouchableOpacity
        style={styles.sectionHeader}
        activeOpacity={0.78}
        onPress={() => setExpanded((current) => !current)}
      >
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionChevron}>{expanded ? "−" : "+"}</Text>
      </TouchableOpacity>
      <Animated.View
        style={[
          styles.sectionBody,
          contentHeight > 0 ? animatedBodyStyle : undefined,
        ]}
      >
        <View
          style={styles.sectionContent}
          onLayout={(event) => {
            setContentHeight(event.nativeEvent.layout.height);
          }}
        >
          {children}
        </View>
      </Animated.View>
    </View>
  );
}

function SegmentButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.segmentButton, active && styles.segmentButtonActive]}
      activeOpacity={0.78}
      onPress={onPress}
    >
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function StepperRow({
  label,
  value,
  valueText,
  onMinus,
  onPlus,
  seekMin,
  seekMax,
  seekStep,
  seekPrecision,
  onSeekChange,
}: {
  label: string;
  value: number;
  valueText?: string;
  onMinus: () => void;
  onPlus: () => void;
  seekMin?: number;
  seekMax?: number;
  seekStep?: number;
  seekPrecision?: number;
  onSeekChange?: (v: number) => void;
}) {
  const shouldShowSeekBar =
    seekMin !== undefined &&
    seekMax !== undefined &&
    seekStep !== undefined &&
    onSeekChange !== undefined;

  return (
    <View style={styles.stepperRow}>
      <View style={styles.stepperTopRow}>
        <Text style={[styles.optionLabel, styles.stepperLabel]}>{label}</Text>
        <View style={styles.stepper}>
          <TouchableOpacity
            style={styles.stepButton}
            activeOpacity={0.78}
            onPress={onMinus}
          >
            <Text style={styles.stepButtonText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.stepValue}>{valueText ?? value}</Text>
          <TouchableOpacity
            style={styles.stepButton}
            activeOpacity={0.78}
            onPress={onPlus}
          >
            <Text style={styles.stepButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
      {shouldShowSeekBar ? (
        <SteppedSeekBar
          value={value}
          min={seekMin}
          max={seekMax}
          step={seekStep}
          precision={seekPrecision ?? 0}
          onChange={onSeekChange}
        />
      ) : null}
    </View>
  );
}

function SteppedSeekBar({
  value,
  min,
  max,
  step,
  precision,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  precision: number;
  onChange: (v: number) => void;
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const progress = useSharedValue(0);
  const dragStartProgress = useSharedValue(0);
  const lastIndex = useSharedValue(0);
  const hapticAtRef = useRef(0);
  const stepCount = Math.round((max - min) / step);

  const valueToIndex = useCallback(
    (nextValue: number) =>
      Math.min(stepCount, Math.max(0, Math.round((nextValue - min) / step))),
    [min, step, stepCount],
  );

  const indexToValue = useCallback(
    (index: number) => Number((min + index * step).toFixed(precision)),
    [min, precision, step],
  );

  const commitIndex = useCallback(
    (index: number) => {
      const nextValue = indexToValue(index);
      onChange(nextValue);

      const now = Date.now();
      if (now - hapticAtRef.current < MIN_HAPTIC_INTERVAL_MS) {
        return;
      }
      hapticAtRef.current = now;
      Haptics.selectionAsync().catch(() => {});
    },
    [indexToValue, onChange],
  );

  useEffect(() => {
    const nextIndex = valueToIndex(value);
    const nextProgress = stepCount > 0 ? nextIndex / stepCount : 0;
    lastIndex.value = nextIndex;
    progress.value = withTiming(nextProgress, { duration: 120 });
  }, [lastIndex, progress, stepCount, value, valueToIndex]);

  const panGesture = Gesture.Pan()
    .minDistance(0)
    .onBegin(() => {
      dragStartProgress.value = progress.value;
      lastIndex.value = Math.round(progress.value * stepCount);
    })
    .onUpdate((event) => {
      if (trackWidth <= SEEK_THUMB_WIDTH || stepCount <= 0) {
        return;
      }

      const usableWidth = trackWidth - SEEK_THUMB_WIDTH;
      const nextProgress = Math.min(
        1,
        Math.max(0, dragStartProgress.value + event.translationX / usableWidth),
      );
      const nextIndex = Math.min(
        stepCount,
        Math.max(0, Math.round(nextProgress * stepCount)),
      );

      progress.value = nextIndex / stepCount;
      if (nextIndex !== lastIndex.value) {
        lastIndex.value = nextIndex;
        runOnJS(commitIndex)(nextIndex);
      }
    });

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX:
          progress.value * Math.max(0, trackWidth - SEEK_THUMB_WIDTH) -
          (SEEK_THUMB_TOUCH_SIZE - SEEK_THUMB_WIDTH) / 2,
      },
    ],
  }));

  return (
    <View style={styles.seekContainer}>
      <View
        style={styles.seekTrackWrap}
        onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
      >
        <View pointerEvents="none" style={styles.seekTrack} />
        {trackWidth > 0 ? (
          <GestureDetector gesture={panGesture}>
            <Animated.View style={[styles.seekThumbTouch, thumbStyle]}>
              <View style={styles.seekThumb} />
            </Animated.View>
          </GestureDetector>
        ) : null}
      </View>
    </View>
  );
}

//  --------- 스타일 -------------------------------------------------------

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? 28 : 0,
    backgroundColor: colors.grey900,
  },
  tabView: {
    flex: 1,
  },
  tabBar: {
    marginHorizontal: 16,
    backgroundColor: "transparent",
    elevation: 0,
    shadowColor: "transparent",
    shadowOpacity: 0,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 0,
  },
  tabIndicator: {
    height: 3,
    backgroundColor: colors.purple300,
  },
  tabContent: {
    padding: 16,
    paddingBottom: 24,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 18,
    backgroundColor: colors.grey900,
  },
  generateButton: {
    height: 60,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: colors.blue500,
  },
  disabledButton: {
    opacity: 0.62,
  },
  generateText: {
    color: colors.background,
    fontSize: 18,
    fontWeight: "800",
  },
  // 입력
  inputGroup: {
    marginBottom: 22,
  },
  inputLabel: {
    marginBottom: 10,
    color: colors.background,
    fontSize: 15,
    fontWeight: "700",
  },
  textAreaWrap: {
    borderWidth: 1,
    borderColor: colors.greyOpacity400,
    borderRadius: 14,
    padding: 14,
    backgroundColor: colors.grey800,
  },
  textArea: {
    flex: 1,
    minHeight: 70,
    color: colors.background,
    fontSize: 15,
    lineHeight: 23,
  },
  countText: {
    alignSelf: "flex-end",
    marginTop: 8,
    color: colors.grey400,
    fontSize: 12,
  },
  // 옵션 공통
  optionLabel: {
    color: colors.background,
    fontSize: 15,
    fontWeight: "700",
  },
  optionValue: {
    maxWidth: "58%",
    color: colors.grey400,
    fontSize: 14,
    textAlign: "right",
  },
  optionBlock: {
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.greyOpacity300,
    borderRadius: 14,
    padding: 16,
    backgroundColor: colors.grey800,
  },
  optionBody: {
    marginTop: 12,
  },
  section: {
    marginBottom: 10,
  },
  sectionHeader: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    paddingLeft: 3,
    color: colors.background,
    fontSize: 15,
    fontWeight: "800",
  },
  sectionChevron: {
    width: 28,
    color: colors.grey300,
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    marginRight: -3,
  },
  sectionBody: {
    overflow: "hidden",
  },
  sectionContent: {
    paddingTop: 10,
  },
  // SelectOption
  selectOption: {
    marginBottom: 10,
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.greyOpacity300,
    borderRadius: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.grey800,
  },
  selectValueWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    justifyContent: "flex-end",
    marginLeft: 16,
  },
  selectChevron: {
    color: colors.grey400,
    fontSize: 22,
    fontWeight: "800",
  },
  // Segment
  segmentRow: {
    flexDirection: "row",
    gap: 10,
  },
  segmentButton: {
    flex: 1,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.greyOpacity500,
    borderRadius: 10,
    backgroundColor: colors.greyOpacity200,
  },
  segmentButtonActive: {
    borderColor: colors.purple400,
    backgroundColor: colors.greyOpacity300,
  },
  segmentText: {
    color: colors.grey400,
    fontWeight: "700",
  },
  segmentTextActive: {
    color: colors.background,
  },
  // Stepper
  stepperRow: {
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.greyOpacity300,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 2,
    backgroundColor: colors.grey800,
  },
  stepperTopRow: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stepperLabel: {
    flex: 1,
    marginRight: 12,
  },
  stepButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: colors.greyOpacity300,
  },
  stepButtonText: {
    color: colors.background,
    fontSize: 20,
    fontWeight: "800",
  },
  stepValue: {
    width: 48,
    color: colors.background,
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
  },
  seekContainer: {
    marginTop: 0,
  },
  seekTrackWrap: {
    height: SEEK_THUMB_TOUCH_SIZE,
    justifyContent: "center",
  },
  seekTrack: {
    height: 12,
    overflow: "hidden",
    borderRadius: 6,
    backgroundColor: colors.greyOpacity400,
  },
  seekThumbTouch: {
    position: "absolute",
    top: 0,
    left: 0,
    width: SEEK_THUMB_TOUCH_SIZE,
    height: SEEK_THUMB_TOUCH_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  seekThumb: {
    width: SEEK_THUMB_WIDTH,
    height: SEEK_THUMB_HEIGHT,
    borderRadius: 4,
    backgroundColor: colors.background,
  },
  // Seed
  seedOptionRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.greyOpacity300,
    borderRadius: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.grey800,
  },
  seedRow: {
    width: 136,
    flexDirection: "row",
    gap: 10,
    marginLeft: 16,
  },
  seedInput: {
    flex: 1,
    height: 38,
    borderWidth: 1,
    borderColor: colors.greyOpacity500,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 0,
    backgroundColor: colors.greyOpacity200,
    color: colors.background,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  // BottomSheet
  sheetContainer: {
    marginHorizontal: 14,
    zIndex: 20,
    elevation: 20,
  },
  sheetBackground: {
    borderRadius: 28,
    backgroundColor: colors.grey800,
  },
  sheetHandle: {
    width: 56,
    height: 5,
    backgroundColor: colors.grey600,
  },
  sheetContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  sheetTitle: {
    marginBottom: 16,
    paddingLeft: 6,
    paddingTop: 6,
    color: colors.background,
    fontSize: 20,
    fontWeight: "800",
  },
  sheetItem: {
    minHeight: 48,
    justifyContent: "center",
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 6,
  },
  sheetItemActive: {
    backgroundColor: colors.greyOpacity300,
  },
  sheetItemText: {
    color: colors.grey300,
    fontSize: 16,
    fontWeight: "700",
  },
  sheetItemTextActive: {
    color: colors.background,
  },
});
