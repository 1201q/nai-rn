import { useCallback, useEffect, useRef, useState } from "react";
import {
  BackHandler,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import BottomSheet, {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { Header } from "../components/Header";
import { useGenerationOptions } from "../context/GenerationOptionsContext";
import type { ImageSettingScreenNavigationProp } from "../navigation/types";
import { MODELS, NOISE_SCHEDULES, SAMPLERS } from "../constants/generation";
import {
  formatDecimal,
  resolveResolution,
  snapResolutionValue,
} from "./option/helpers";
import { SteppedSeekBar } from "./option/OptionControls";
import { colors } from "../styles/colors";
import { SettingSheets } from "./imageSetting/SettingSheets";
import { styles } from "./imageSetting/styles";
import { styles as optionStyles } from "./option/styles";

type SelectionSheetKey =
  | "model"
  | "resolution"
  | "sampler"
  | "noiseSchedule"
  | null;

export function ImageSettingScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<ImageSettingScreenNavigationProp>();
  const {
    model,
    resolution,
    setResolution,
    setModel,
    sampler,
    setSampler,
    noiseSchedule,
    setNoiseSchedule,
    steps,
    setSteps,
    promptGuidance,
    setPromptGuidance,
    promptGuidanceRescale,
    setPromptGuidanceRescale,
    seedText,
    setSeedText,
    varietyPlus,
    setVarietyPlus,
  } = useGenerationOptions();

  const modelSheetRef = useRef<BottomSheet>(null);
  const resolutionSheetRef = useRef<BottomSheet>(null);
  const samplerSheetRef = useRef<BottomSheet>(null);
  const noiseScheduleSheetRef = useRef<BottomSheet>(null);
  const activeSheetRef = useRef<SelectionSheetKey>(null);

  const [resolutionWidthText, setResolutionWidthText] = useState(
    String(resolution.width),
  );
  const [resolutionHeightText, setResolutionHeightText] = useState(
    String(resolution.height),
  );

  useEffect(() => {
    setResolutionWidthText(String(resolution.width));
    setResolutionHeightText(String(resolution.height));
  }, [resolution.width, resolution.height]);

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
      resolutionSheetRef.current?.close();
      samplerSheetRef.current?.close();
      noiseScheduleSheetRef.current?.close();
      activeSheetRef.current = "model";
      requestAnimationFrame(() => modelSheetRef.current?.snapToIndex(0));
      return;
    }

    if (next === "resolution") {
      modelSheetRef.current?.close();
      samplerSheetRef.current?.close();
      noiseScheduleSheetRef.current?.close();
      activeSheetRef.current = "resolution";
      requestAnimationFrame(() => resolutionSheetRef.current?.snapToIndex(0));
      return;
    }

    if (next === "sampler") {
      modelSheetRef.current?.close();
      resolutionSheetRef.current?.close();
      noiseScheduleSheetRef.current?.close();
      activeSheetRef.current = "sampler";
      requestAnimationFrame(() => samplerSheetRef.current?.snapToIndex(0));
      return;
    }

    modelSheetRef.current?.close();
    resolutionSheetRef.current?.close();
    samplerSheetRef.current?.close();
    activeSheetRef.current = "noiseSchedule";
    requestAnimationFrame(() => noiseScheduleSheetRef.current?.snapToIndex(0));
  }

  function closeSelectionSheet() {
    if (activeSheetRef.current === "model") {
      modelSheetRef.current?.close();
      return;
    }
    if (activeSheetRef.current === "resolution") {
      resolutionSheetRef.current?.close();
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
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Header title="Image Setting" onBack={() => navigation.goBack()} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={styles.sheetOptionRow}
          activeOpacity={0.78}
          onPress={() => openSelectionSheet("model")}
        >
          <View style={styles.sheetOptionIconWrap}>
            <Ionicons
              name="layers-outline"
              size={20}
              color={colors.colorTextPrimary}
            />
          </View>
          <View style={styles.sheetOptionTextGroup}>
            <Text style={styles.sheetOptionTitle}>Model</Text>
            <Text style={styles.sheetOptionSubtitle} numberOfLines={1}>
              {MODELS.find((m) => m.value === model)?.label ?? model}
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={colors.colorTextTertiary}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.sheetOptionRow}
          activeOpacity={0.78}
          onPress={() => openSelectionSheet("resolution")}
        >
          <View style={styles.sheetOptionIconWrap}>
            <Ionicons
              name="scan-outline"
              size={20}
              color={colors.colorTextPrimary}
            />
          </View>
          <View style={styles.sheetOptionTextGroup}>
            <Text style={styles.sheetOptionTitle}>Resolution</Text>
            <Text style={styles.sheetOptionSubtitle} numberOfLines={1}>
              {resolution.width}×{resolution.height}
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={colors.colorTextTertiary}
          />
        </TouchableOpacity>

        <View style={styles.sheetDivider} />

        <View style={styles.sheetOptionRow}>
          <View style={styles.sheetOptionIconWrap}>
            <Ionicons
              name="dice-outline"
              size={20}
              color={colors.colorTextPrimary}
            />
          </View>
          <Text style={[styles.sheetOptionTitle, styles.sheetOptionTextGroup]}>
            Seed
          </Text>
          <View style={optionStyles.seedRow}>
            <TextInput
              value={seedText}
              onChangeText={(text) => setSeedText(text.replace(/\D/g, ""))}
              keyboardType="number-pad"
              placeholder="Random"
              placeholderTextColor={colors.colorTextTertiary}
              style={optionStyles.seedInput}
            />
          </View>
        </View>

        <View style={styles.sliderOptionRow}>
          <View style={styles.sheetOptionIconWrap}>
            <Ionicons
              name="footsteps-outline"
              size={20}
              color={colors.colorTextPrimary}
            />
          </View>
          <View style={styles.sliderOptionTextGroup}>
            <Text style={styles.sheetOptionTitle}>Steps</Text>
            <Text style={styles.sheetOptionSubtitle}>{steps}</Text>
          </View>
          <View style={styles.sliderOptionTrack}>
            <SteppedSeekBar
              value={steps}
              min={1}
              max={50}
              step={1}
              precision={0}
              onChange={setSteps}
            />
          </View>
        </View>

        <View style={styles.sliderOptionRow}>
          <View style={styles.sheetOptionIconWrap}>
            <Ionicons
              name="options-outline"
              size={20}
              color={colors.colorTextPrimary}
            />
          </View>
          <View style={styles.sliderOptionTextGroup}>
            <Text style={styles.sheetOptionTitle}>CFG Scale</Text>
            <Text style={styles.sheetOptionSubtitle}>
              {formatDecimal(promptGuidance)}
            </Text>
          </View>
          <View style={styles.sliderOptionTrack}>
            <SteppedSeekBar
              value={promptGuidance}
              min={0}
              max={10}
              step={0.1}
              precision={1}
              onChange={setPromptGuidance}
            />
          </View>
        </View>

        <View style={styles.sliderOptionRow}>
          <View style={styles.sheetOptionIconWrap}>
            <Ionicons
              name="git-branch-outline"
              size={20}
              color={colors.colorTextPrimary}
            />
          </View>
          <View style={styles.sliderOptionTextGroup}>
            <Text style={styles.sheetOptionTitle}>CFG Rescale</Text>
            <Text style={styles.sheetOptionSubtitle}>
              {formatDecimal(promptGuidanceRescale, 2)}
            </Text>
          </View>
          <View style={styles.sliderOptionTrack}>
            <SteppedSeekBar
              value={promptGuidanceRescale}
              min={0}
              max={1}
              step={0.02}
              precision={2}
              onChange={setPromptGuidanceRescale}
            />
          </View>
        </View>

        <View style={styles.sheetDivider} />

        <TouchableOpacity
          style={styles.sheetOptionRow}
          activeOpacity={0.78}
          onPress={() => openSelectionSheet("sampler")}
        >
          <View style={styles.sheetOptionIconWrap}>
            <Ionicons
              name="shuffle-outline"
              size={20}
              color={colors.colorTextPrimary}
            />
          </View>
          <View style={styles.sheetOptionTextGroup}>
            <Text style={styles.sheetOptionTitle}>Sampler</Text>
            <Text style={styles.sheetOptionSubtitle} numberOfLines={1}>
              {SAMPLERS.find((s) => s.value === sampler)?.label ?? sampler}
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={colors.colorTextTertiary}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.sheetOptionRow}
          activeOpacity={0.78}
          onPress={() => openSelectionSheet("noiseSchedule")}
        >
          <View style={styles.sheetOptionIconWrap}>
            <Ionicons
              name="pulse-outline"
              size={20}
              color={colors.colorTextPrimary}
            />
          </View>
          <View style={styles.sheetOptionTextGroup}>
            <Text style={styles.sheetOptionTitle}>Noise Schedule</Text>
            <Text style={styles.sheetOptionSubtitle} numberOfLines={1}>
              {NOISE_SCHEDULES.find((n) => n.value === noiseSchedule)?.label ??
                noiseSchedule}
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={colors.colorTextTertiary}
          />
        </TouchableOpacity>

        <View style={styles.sheetDivider} />

        <View style={[styles.sheetOptionRow, { justifyContent: "space-between" }]}>
          <View
            style={{ flexDirection: "row", alignItems: "center", gap: 14 }}
          >
            <View style={styles.sheetOptionIconWrap}>
              <Ionicons
                name="sparkles-outline"
                size={20}
                color={colors.colorTextPrimary}
              />
            </View>
            <Text style={styles.sheetOptionTitle}>Variety+</Text>
          </View>
          <Switch
            value={varietyPlus}
            onValueChange={setVarietyPlus}
            trackColor={{
              false: colors.colorBackgroundSecondary,
              true: colors.colorBorderInfo,
            }}
            thumbColor={colors.colorTextPrimary}
          />
        </View>
      </ScrollView>

      <SettingSheets
        modelSheetRef={modelSheetRef}
        resolutionSheetRef={resolutionSheetRef}
        samplerSheetRef={samplerSheetRef}
        noiseScheduleSheetRef={noiseScheduleSheetRef}
        renderBackdrop={renderBackdrop}
        handleSheetChange={handleSheetChange}
        closeSelectionSheet={closeSelectionSheet}
        model={model}
        setModel={setModel}
        resolution={resolution}
        setResolution={setResolution}
        sampler={sampler}
        setSampler={setSampler}
        noiseSchedule={noiseSchedule}
        setNoiseSchedule={setNoiseSchedule}
        resolutionWidthText={resolutionWidthText}
        setResolutionWidthText={setResolutionWidthText}
        resolutionHeightText={resolutionHeightText}
        setResolutionHeightText={setResolutionHeightText}
        commitResolutionInput={commitResolutionInput}
        swapResolutionInput={swapResolutionInput}
      />
    </View>
  );
}
