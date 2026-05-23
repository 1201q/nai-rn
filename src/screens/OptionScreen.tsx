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
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { useNavigation } from "@react-navigation/native";
import { TabBar, TabView } from "react-native-tab-view";

import { Header } from "../components/Header";
import { useGenerationOptions } from "../context/GenerationOptionsContext";
import { MODELS, SAMPLERS, type AspectRatio } from "../constants/generation";
import { colors } from "../styles/colors";
import type { OptionScreenNavigationProp } from "../navigation/types";

type SelectionSheetKey = "model" | "sampler" | null;

function getOptionLabel(
  options: Array<{ label: string; value: string }>,
  value: string,
) {
  return options.find((o) => o.value === value)?.label ?? value;
}

export function OptionScreen() {
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
    scale,
    setScale,
    sampler,
    setSampler,
    seedText,
    setSeedText,
    outputCount,
    setOutputCount,
    isLoading,
    generateImage,
  } = useGenerationOptions();

  const modelSheetRef = useRef<BottomSheet>(null);
  const samplerSheetRef = useRef<BottomSheet>(null);
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
      activeSheetRef.current = "model";
      requestAnimationFrame(() => modelSheetRef.current?.snapToIndex(0));
      return;
    }
    modelSheetRef.current?.close();
    activeSheetRef.current = "sampler";
    requestAnimationFrame(() => samplerSheetRef.current?.snapToIndex(0));
  }

  function closeSelectionSheet() {
    if (activeSheetRef.current === "model") {
      modelSheetRef.current?.close();
      return;
    }
    if (activeSheetRef.current === "sampler") {
      samplerSheetRef.current?.close();
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

  function randomizeSeed() {
    setSeedText(String(Math.floor(Math.random() * 4_294_967_296)));
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
        <StepperRow
          label="Steps"
          value={steps}
          onMinus={() => setSteps(Math.max(1, steps - 1))}
          onPlus={() => setSteps(Math.min(50, steps + 1))}
        />
        <StepperRow
          label="Guidance Scale"
          value={scale}
          onMinus={() =>
            setScale(Math.max(1, Number((scale - 0.5).toFixed(1))))
          }
          onPlus={() =>
            setScale(Math.min(15, Number((scale + 0.5).toFixed(1))))
          }
        />
        <OptionBlock label="Seed">
          <View style={styles.seedRow}>
            <TextInput
              value={seedText}
              onChangeText={setSeedText}
              keyboardType="number-pad"
              placeholder="Random"
              placeholderTextColor={colors.grey500}
              style={styles.seedInput}
            />
            <TouchableOpacity
              style={styles.randomButton}
              activeOpacity={0.78}
              onPress={randomizeSeed}
            >
              <Text style={styles.randomButtonText}>↻</Text>
            </TouchableOpacity>
          </View>
        </OptionBlock>
        <SelectOption
          label="Sampler"
          value={getOptionLabel(SAMPLERS, sampler)}
          onPress={() => openSelectionSheet("sampler")}
        />
        <OptionBlock label="Output Count">
          <View style={styles.segmentRow}>
            {[1, 2, 3, 4].map((count) => (
              <SegmentButton
                key={count}
                label={String(count)}
                active={outputCount === count}
                onPress={() => setOutputCount(count)}
              />
            ))}
          </View>
        </OptionBlock>
      </ScrollView>
    );
  }

  return (
    <View style={styles.screen}>
      <Header title="Options" onBack={() => navigation.goBack()} />

      <TabView
        style={styles.tabView}
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
  onMinus,
  onPlus,
}: {
  label: string;
  value: number;
  onMinus: () => void;
  onPlus: () => void;
}) {
  return (
    <View style={styles.stepperRow}>
      <Text style={styles.optionLabel}>{label}</Text>
      <View style={styles.stepper}>
        <TouchableOpacity
          style={styles.stepButton}
          activeOpacity={0.78}
          onPress={onMinus}
        >
          <Text style={styles.stepButtonText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.stepValue}>{value}</Text>
        <TouchableOpacity
          style={styles.stepButton}
          activeOpacity={0.78}
          onPress={onPlus}
        >
          <Text style={styles.stepButtonText}>+</Text>
        </TouchableOpacity>
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
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
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
  // Seed
  seedRow: {
    flexDirection: "row",
    gap: 10,
  },
  seedInput: {
    flex: 1,
    height: 42,
    borderWidth: 1,
    borderColor: colors.greyOpacity500,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.greyOpacity200,
    color: colors.background,
  },
  randomButton: {
    width: 46,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: colors.greyOpacity300,
  },
  randomButtonText: {
    color: colors.background,
    fontSize: 20,
    fontWeight: "800",
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
