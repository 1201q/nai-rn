import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import BottomSheet, {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { useNavigation } from "@react-navigation/native";
import { TabBar, TabView } from "react-native-tab-view";

import { Header } from "../components/Header";
import { useGenerationOptions } from "../context/GenerationOptionsContext";
import type { OptionScreenNavigationProp } from "../navigation/types";
import { colors } from "../styles/colors";
import { OptionTabScene, optionTabRoutes } from "./option/OptionTabs";
import { SelectionSheets } from "./option/SelectionSheets";
import { styles } from "./option/styles";

type SelectionSheetKey =
  | "model"
  | "resolution"
  | "sampler"
  | "noiseSchedule"
  | null;

export function OptionScreen() {
  const layout = useWindowDimensions();

  const navigation = useNavigation<OptionScreenNavigationProp>();
  const {
    prompt,
    setPrompt,
    negativePrompt,
    setNegativePrompt,
    characterPrompts,
    setCharacterPrompts,
    model,
    setModel,
    resolution,
    setResolution,
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
    varietyPlus,
    setVarietyPlus,
    optionTabIndex,
    setOptionTabIndex,
    hasLoadedOptions,
    isLoading,
    generateImage,
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

  return (
    <View style={styles.screen}>
      <Header title="Options" onBack={() => navigation.goBack()} />

      <TabView
        style={styles.tabView}
        initialLayout={{ width: layout.width }}
        navigationState={{ index: optionTabIndex, routes: optionTabRoutes }}
        onIndexChange={setOptionTabIndex}
        renderTabBar={(props) => (
          <TabBar
            {...props}
            style={styles.tabBar}
            indicatorStyle={styles.tabIndicator}
            activeColor={colors.colorTextPrimary}
            inactiveColor={colors.colorTextTertiary}
          />
        )}
        renderScene={({ route }) => (
          <OptionTabScene
            route={route}
            hasLoadedOptions={hasLoadedOptions}
            prompt={prompt}
            setPrompt={setPrompt}
            negativePrompt={negativePrompt}
            setNegativePrompt={setNegativePrompt}
            characterPrompts={characterPrompts}
            setCharacterPrompts={setCharacterPrompts}
            model={model}
            resolution={resolution}
            setResolution={setResolution}
            steps={steps}
            setSteps={setSteps}
            promptGuidance={promptGuidance}
            setPromptGuidance={setPromptGuidance}
            promptGuidanceRescale={promptGuidanceRescale}
            setPromptGuidanceRescale={setPromptGuidanceRescale}
            noiseSchedule={noiseSchedule}
            sampler={sampler}
            seedText={seedText}
            setSeedText={setSeedText}
            varietyPlus={varietyPlus}
            setVarietyPlus={setVarietyPlus}
            resolutionWidthText={resolutionWidthText}
            setResolutionWidthText={setResolutionWidthText}
            resolutionHeightText={resolutionHeightText}
            setResolutionHeightText={setResolutionHeightText}
            openSelectionSheet={openSelectionSheet}
          />
        )}
      />

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.generateButton, isLoading && styles.disabledButton]}
          activeOpacity={0.82}
          onPress={() => generateImage(() => navigation.goBack())}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.colorTextInverse} />
          ) : (
            <Text style={styles.generateText}>Generate</Text>
          )}
        </TouchableOpacity>
      </View>

      <SelectionSheets
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
      />
    </View>
  );
}
