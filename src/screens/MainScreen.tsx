import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  BackHandler,
  LayoutAnimation,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { GestureResponderEvent } from "react-native";
import * as Clipboard from "expo-clipboard";
import { File } from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  BottomSheetTextInput,
  TouchableOpacity as BottomSheetTouchableOpacity,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { useNavigation } from "@react-navigation/native";
import PagerView from "react-native-pager-view";

import {
  MODELS,
  NAI_RESOLUTIONS,
  NOISE_SCHEDULES,
  SAMPLERS,
  type NaiResolution,
  type NoiseSchedule,
} from "../constants/generation";
import {
  findResolutionPreset,
  resolveResolution,
  snapResolutionValue,
} from "./option/helpers";
import { useGenerationOptions } from "../context/GenerationOptionsContext";
import type { MainScreenNavigationProp } from "../navigation/types";
import { colors } from "../styles/colors";
import Slider from "@react-native-community/slider";
import { CreatePage } from "./main/CreatePage";
import { HistoryPage } from "./main/HistoryPage";
import { ImagePreviewModal } from "./main/ImagePreviewModal";
import { MainScreenHeader, type MainPageIndex } from "./main/MainScreenHeader";
import { styles } from "./main/styles";

const MAIN_SHEET_COLLAPSED_HEIGHT = 300;
const MAIN_SHEET_SNAP_POINTS = [MAIN_SHEET_COLLAPSED_HEIGHT, "92%"];
type MainSheetRoute =
  | "home"
  | "model"
  | "sampler"
  | "noiseSchedule"
  | "resolution";

export function MainScreen() {
  const navigation = useNavigation<MainScreenNavigationProp>();
  const {
    prompt,
    model,
    setModel,
    sampler,
    setSampler,
    noiseSchedule,
    setNoiseSchedule,
    resolution,
    setResolution,
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
    currentGeneration,
    currentImageUri,
    generationHistory,
    resolveGenerationImageUri,
    resolveGenerationThumbnailUri,
    isLoading,
    message,
    generateImage,
  } = useGenerationOptions();

  const mainPagerRef = useRef<PagerView>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const isBottomSheetOpenRef = useRef(false);
  const previewAnimation = useRef(new Animated.Value(0)).current;
  const [mainPageIndex, setMainPageIndex] = useState<MainPageIndex>(0);
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
  const [isSavingImage, setIsSavingImage] = useState(false);
  const [isCopyingImage, setIsCopyingImage] = useState(false);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [previewInitialIndex, setPreviewInitialIndex] = useState(0);
  const [bottomSheetRoute, setBottomSheetRoute] =
    useState<MainSheetRoute>("home");
  const [expandedSlider, setExpandedSlider] = useState<
    "steps" | "cfgScale" | "cfgRescale" | "seed" | null
  >(null);
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
        if (isImagePreviewOpen) {
          closeImagePreview();
          return true;
        }
        if (isBottomSheetOpenRef.current && bottomSheetRoute !== "home") {
          returnBottomSheetHome();
          return true;
        }
        if (isBottomSheetOpenRef.current) {
          bottomSheetRef.current?.close();
          return true;
        }
        return false;
      },
    );
    return () => subscription.remove();
  }, [bottomSheetRoute, isImagePreviewOpen]);

  const renderBottomSheetBackdrop = useCallback(
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

  function openImagePreview() {
    if (!currentImageUri) return;
    setPreviewImages([currentImageUri]);
    setPreviewInitialIndex(0);
    setIsImagePreviewOpen(true);
    previewAnimation.setValue(0);
    Animated.timing(previewAnimation, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }

  function openHistoryImagePreview(index: number) {
    setPreviewImages(generationHistory.map(resolveGenerationImageUri));
    setPreviewInitialIndex(index);
    setIsImagePreviewOpen(true);
    previewAnimation.setValue(0);
    Animated.timing(previewAnimation, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }

  function closeImagePreview() {
    Animated.timing(previewAnimation, {
      toValue: 0,
      duration: 140,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setIsImagePreviewOpen(false);
    });
  }

  function openBottomSheet() {
    setBottomSheetRoute("home");
    requestAnimationFrame(() => bottomSheetRef.current?.snapToIndex(0));
  }

  function returnBottomSheetHome() {
    setBottomSheetRoute("home");
  }

  function toggleSlider(key: "steps" | "cfgScale" | "cfgRescale" | "seed") {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedSlider((prev) => (prev === key ? null : key));
  }

  function handleBottomSheetChange(index: number) {
    isBottomSheetOpenRef.current = index >= 0;
    if (index < 0) {
      setBottomSheetRoute("home");
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

  function getBottomSheetTitle() {
    if (bottomSheetRoute === "model") return "Model";
    if (bottomSheetRoute === "sampler") return "Sampler";
    if (bottomSheetRoute === "noiseSchedule") return "Noise Schedule";
    if (bottomSheetRoute === "resolution") return "Resolution";
    return "Options";
  }

  function keepSheetHeaderPress(event: GestureResponderEvent) {
    event.stopPropagation();
  }

  function handleGenerate() {
    if (!prompt.trim()) {
      navigation.navigate("Option");
      return;
    }
    generateImage();
  }

  async function handleSaveImage() {
    if (!currentImageUri || isSavingImage) return;

    try {
      setIsSavingImage(true);
      const permission = await MediaLibrary.requestPermissionsAsync(true, [
        "photo",
      ]);

      if (!permission.granted) {
        Alert.alert("저장 실패", "사진 저장 권한이 필요합니다.");
        return;
      }

      await MediaLibrary.saveToLibraryAsync(currentImageUri);
      Alert.alert("저장됨", "이미지를 휴대폰 저장소에 저장했습니다.");
    } catch {
      Alert.alert("저장 실패", "이미지를 휴대폰 저장소에 저장하지 못했습니다.");
    } finally {
      setIsSavingImage(false);
    }
  }

  async function handleCopyImage() {
    if (!currentImageUri || isCopyingImage) return;

    try {
      setIsCopyingImage(true);
      const base64Image = await new File(currentImageUri).base64();
      await Clipboard.setImageAsync(base64Image);
      Alert.alert("복사됨", "이미지를 클립보드에 복사했습니다.");
    } catch {
      Alert.alert("복사 실패", "이미지를 클립보드에 복사하지 못했습니다.");
    } finally {
      setIsCopyingImage(false);
    }
  }

  function selectMainPage(index: MainPageIndex) {
    setMainPageIndex(index);
    mainPagerRef.current?.setPage(index);
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <MainScreenHeader
        activeIndex={mainPageIndex}
        onSelect={selectMainPage}
        onOpenSettings={() => navigation.navigate("Settings")}
      />

      <PagerView
        ref={mainPagerRef}
        style={styles.pager}
        initialPage={0}
        onPageSelected={(event) =>
          setMainPageIndex(event.nativeEvent.position as MainPageIndex)
        }
      >
        <View key="create" style={styles.page}>
          <CreatePage
            currentGeneration={currentGeneration}
            currentImageUri={currentImageUri}
            message={message}
            isLoading={isLoading}
            isSavingImage={isSavingImage}
            isCopyingImage={isCopyingImage}
            onOpenImagePreview={openImagePreview}
            onSaveImage={handleSaveImage}
            onCopyImage={handleCopyImage}
            onOpenOptions={() => navigation.navigate("Option")}
            onOpenBottomSheet={openBottomSheet}
            onGenerate={handleGenerate}
          />
        </View>

        <View key="history" style={styles.page}>
          <HistoryPage
            images={generationHistory}
            resolveImageUri={resolveGenerationImageUri}
            resolveThumbnailUri={resolveGenerationThumbnailUri}
            onImagePress={openHistoryImagePreview}
          />
        </View>
      </PagerView>

      <ImagePreviewModal
        visible={isImagePreviewOpen}
        images={previewImages}
        initialIndex={previewInitialIndex}
        animation={previewAnimation}
        onClose={closeImagePreview}
      />

      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={MAIN_SHEET_SNAP_POINTS}
        enablePanDownToClose
        backdropComponent={renderBottomSheetBackdrop}
        detached
        bottomInset={0}
        style={styles.sheetContainer}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.sheetHandle}
        enableDynamicSizing={false}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        onChange={handleBottomSheetChange}
      >
        <View
          style={styles.sheetHeader}
          onStartShouldSetResponder={() => true}
          onResponderRelease={keepSheetHeaderPress}
        >
          {bottomSheetRoute === "home" ? (
            <View style={styles.sheetHeaderSide} />
          ) : (
            <BottomSheetTouchableOpacity
              style={styles.sheetCloseButton}
              activeOpacity={0.78}
              onPress={returnBottomSheetHome}
            >
              <Ionicons
                name="chevron-back"
                size={22}
                color={colors.colorTextPrimary}
              />
            </BottomSheetTouchableOpacity>
          )}

          <Text style={[styles.sheetTitle, styles.sheetHeaderTitle]}>
            {getBottomSheetTitle()}
          </Text>

          <BottomSheetTouchableOpacity
            style={styles.sheetCloseButton}
            activeOpacity={0.78}
            onPress={() => bottomSheetRef.current?.close()}
          >
            <Ionicons name="close" size={22} color={colors.colorTextPrimary} />
          </BottomSheetTouchableOpacity>
        </View>

        <BottomSheetScrollView
          style={styles.sheetScroll}
          contentContainerStyle={styles.sheetButtonGroup}
          showsVerticalScrollIndicator={false}
        >
          {bottomSheetRoute === "home" ? (
            <>
              <BottomSheetTouchableOpacity
                style={styles.sheetOptionRow}
                activeOpacity={0.78}
                onPress={() => setBottomSheetRoute("model")}
              >
                <View style={styles.sheetOptionIconWrap}>
                  <Ionicons name="layers-outline" size={20} color={colors.colorTextPrimary} />
                </View>
                <View style={styles.sheetOptionTextGroup}>
                  <Text style={styles.sheetOptionTitle}>Model</Text>
                  <Text style={styles.sheetOptionSubtitle} numberOfLines={1}>
                    {MODELS.find((m) => m.value === model)?.label ?? model}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.colorTextTertiary} />
              </BottomSheetTouchableOpacity>

              <BottomSheetTouchableOpacity
                style={styles.sheetOptionRow}
                activeOpacity={0.78}
                onPress={() => setBottomSheetRoute("resolution")}
              >
                <View style={styles.sheetOptionIconWrap}>
                  <Ionicons name="scan-outline" size={20} color={colors.colorTextPrimary} />
                </View>
                <View style={styles.sheetOptionTextGroup}>
                  <Text style={styles.sheetOptionTitle}>Resolution</Text>
                  <Text style={styles.sheetOptionSubtitle} numberOfLines={1}>
                    {resolution.width}×{resolution.height}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.colorTextTertiary} />
              </BottomSheetTouchableOpacity>

              <View style={styles.sheetDivider} />

              <BottomSheetTouchableOpacity
                style={styles.sheetOptionRow}
                activeOpacity={0.78}
                onPress={() => toggleSlider("seed")}
              >
                <View style={styles.sheetOptionIconWrap}>
                  <Ionicons name="dice-outline" size={20} color={colors.colorTextPrimary} />
                </View>
                <View style={styles.sheetOptionTextGroup}>
                  <Text style={styles.sheetOptionTitle}>Seed</Text>
                  <Text style={styles.sheetOptionSubtitle}>
                    {seedText.trim() === "" ? "Random" : seedText}
                  </Text>
                </View>
                <Ionicons
                  name={expandedSlider === "seed" ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={colors.colorTextTertiary}
                />
              </BottomSheetTouchableOpacity>
              {expandedSlider === "seed" && (
                <View style={styles.sheetSliderExpanded}>
                  <BottomSheetTextInput
                    value={seedText}
                    onChangeText={(text) => setSeedText(text.replace(/\D/g, ""))}
                    keyboardType="number-pad"
                    placeholder="Random"
                    placeholderTextColor={colors.colorTextTertiary}
                    style={styles.sheetSeedInput}
                  />
                </View>
              )}

              <BottomSheetTouchableOpacity
                style={styles.sheetOptionRow}
                activeOpacity={0.78}
                onPress={() => toggleSlider("steps")}
              >
                <View style={styles.sheetOptionIconWrap}>
                  <Ionicons name="footsteps-outline" size={20} color={colors.colorTextPrimary} />
                </View>
                <View style={styles.sheetOptionTextGroup}>
                  <Text style={styles.sheetOptionTitle}>Steps</Text>
                  <Text style={styles.sheetOptionSubtitle}>{steps}</Text>
                </View>
                <Ionicons
                  name={expandedSlider === "steps" ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={colors.colorTextTertiary}
                />
              </BottomSheetTouchableOpacity>
              <View style={expandedSlider === "steps" ? styles.sheetSliderExpanded : styles.sheetSliderHidden}>
                <Slider
                  value={steps}
                  minimumValue={1}
                  maximumValue={50}
                  step={1}
                  onValueChange={setSteps}
                  minimumTrackTintColor={colors.colorTextInfo}
                  maximumTrackTintColor={colors.colorBorderTertiary}
                  thumbTintColor={colors.colorTextPrimary}
                />
              </View>

              <BottomSheetTouchableOpacity
                style={styles.sheetOptionRow}
                activeOpacity={0.78}
                onPress={() => toggleSlider("cfgScale")}
              >
                <View style={styles.sheetOptionIconWrap}>
                  <Ionicons name="options-outline" size={20} color={colors.colorTextPrimary} />
                </View>
                <View style={styles.sheetOptionTextGroup}>
                  <Text style={styles.sheetOptionTitle}>CFG Scale</Text>
                  <Text style={styles.sheetOptionSubtitle}>
                    {promptGuidance % 1 === 0
                      ? String(promptGuidance)
                      : promptGuidance.toFixed(1).replace(/\.?0+$/, "")}
                  </Text>
                </View>
                <Ionicons
                  name={expandedSlider === "cfgScale" ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={colors.colorTextTertiary}
                />
              </BottomSheetTouchableOpacity>
              <View style={expandedSlider === "cfgScale" ? styles.sheetSliderExpanded : styles.sheetSliderHidden}>
                <Slider
                  value={promptGuidance}
                  minimumValue={0}
                  maximumValue={10}
                  step={0.1}
                  onValueChange={(v) => setPromptGuidance(Number(v.toFixed(1)))}
                  minimumTrackTintColor={colors.colorTextInfo}
                  maximumTrackTintColor={colors.colorBorderTertiary}
                  thumbTintColor={colors.colorTextPrimary}
                />
              </View>

              <BottomSheetTouchableOpacity
                style={styles.sheetOptionRow}
                activeOpacity={0.78}
                onPress={() => toggleSlider("cfgRescale")}
              >
                <View style={styles.sheetOptionIconWrap}>
                  <Ionicons name="git-branch-outline" size={20} color={colors.colorTextPrimary} />
                </View>
                <View style={styles.sheetOptionTextGroup}>
                  <Text style={styles.sheetOptionTitle}>CFG Rescale</Text>
                  <Text style={styles.sheetOptionSubtitle}>
                    {promptGuidanceRescale === 0
                      ? "0"
                      : promptGuidanceRescale.toFixed(2).replace(/\.?0+$/, "")}
                  </Text>
                </View>
                <Ionicons
                  name={expandedSlider === "cfgRescale" ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={colors.colorTextTertiary}
                />
              </BottomSheetTouchableOpacity>
              <View style={expandedSlider === "cfgRescale" ? styles.sheetSliderExpanded : styles.sheetSliderHidden}>
                <Slider
                  value={promptGuidanceRescale}
                  minimumValue={0}
                  maximumValue={1}
                  step={0.02}
                  onValueChange={(v) => setPromptGuidanceRescale(Number(v.toFixed(2)))}
                  minimumTrackTintColor={colors.colorTextInfo}
                  maximumTrackTintColor={colors.colorBorderTertiary}
                  thumbTintColor={colors.colorTextPrimary}
                />
              </View>

              <View style={styles.sheetDivider} />

              <BottomSheetTouchableOpacity
                style={styles.sheetOptionRow}
                activeOpacity={0.78}
                onPress={() => setBottomSheetRoute("sampler")}
              >
                <View style={styles.sheetOptionIconWrap}>
                  <Ionicons name="shuffle-outline" size={20} color={colors.colorTextPrimary} />
                </View>
                <View style={styles.sheetOptionTextGroup}>
                  <Text style={styles.sheetOptionTitle}>Sampler</Text>
                  <Text style={styles.sheetOptionSubtitle} numberOfLines={1}>
                    {SAMPLERS.find((s) => s.value === sampler)?.label ?? sampler}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.colorTextTertiary} />
              </BottomSheetTouchableOpacity>

              <BottomSheetTouchableOpacity
                style={styles.sheetOptionRow}
                activeOpacity={0.78}
                onPress={() => setBottomSheetRoute("noiseSchedule")}
              >
                <View style={styles.sheetOptionIconWrap}>
                  <Ionicons name="pulse-outline" size={20} color={colors.colorTextPrimary} />
                </View>
                <View style={styles.sheetOptionTextGroup}>
                  <Text style={styles.sheetOptionTitle}>Noise Schedule</Text>
                  <Text style={styles.sheetOptionSubtitle} numberOfLines={1}>
                    {NOISE_SCHEDULES.find((n) => n.value === noiseSchedule)?.label ?? noiseSchedule}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.colorTextTertiary} />
              </BottomSheetTouchableOpacity>

              <View style={styles.sheetDivider} />

              <View style={[styles.sheetOptionRow, { justifyContent: "space-between" }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                  <View style={styles.sheetOptionIconWrap}>
                    <Ionicons name="sparkles-outline" size={20} color={colors.colorTextPrimary} />
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
            </>
          ) : bottomSheetRoute === "resolution" ? (
            <View>
              <View style={styles.sheetResolutionInputRow}>
                <View style={styles.sheetResolutionInputBox}>
                  <Text style={styles.sheetResolutionInputLabel}>W</Text>
                  <View style={styles.sheetResolutionInputDivider} />
                  <BottomSheetTextInput
                    value={resolutionWidthText}
                    onChangeText={(text) =>
                      setResolutionWidthText(text.replace(/\D/g, ""))
                    }
                    onBlur={() => commitResolutionInput()}
                    onSubmitEditing={() => commitResolutionInput()}
                    keyboardType="number-pad"
                    placeholder="832"
                    placeholderTextColor={colors.colorTextTertiary}
                    style={styles.sheetResolutionInput}
                  />
                </View>
                <BottomSheetTouchableOpacity
                  style={styles.sheetResolutionSwapButton}
                  activeOpacity={0.78}
                  onPress={swapResolutionInput}
                >
                  <Ionicons
                    name="swap-horizontal-outline"
                    size={18}
                    color={colors.colorTextPrimary}
                  />
                </BottomSheetTouchableOpacity>
                <View style={styles.sheetResolutionInputBox}>
                  <Text style={styles.sheetResolutionInputLabel}>H</Text>
                  <View style={styles.sheetResolutionInputDivider} />
                  <BottomSheetTextInput
                    value={resolutionHeightText}
                    onChangeText={(text) =>
                      setResolutionHeightText(text.replace(/\D/g, ""))
                    }
                    onBlur={() => commitResolutionInput()}
                    onSubmitEditing={() => commitResolutionInput()}
                    keyboardType="number-pad"
                    placeholder="1216"
                    placeholderTextColor={colors.colorTextTertiary}
                    style={styles.sheetResolutionInput}
                  />
                </View>
              </View>

              <View style={styles.sheetDivider} />

              {[
                NAI_RESOLUTIONS[1],
                NAI_RESOLUTIONS[0],
                NAI_RESOLUTIONS[2],
                NAI_RESOLUTIONS[3],
              ].map((group, groupIndex) => (
                <View
                  key={group.group}
                  style={groupIndex > 0 ? { marginTop: 20 } : undefined}
                >
                  <Text style={styles.sheetResolutionGroupTitle}>
                    {group.group}
                  </Text>
                  {group.options.map((item) => {
                    const isActive =
                      resolution.width === item.width &&
                      resolution.height === item.height;
                    return (
                      <BottomSheetTouchableOpacity
                        key={`${item.width}x${item.height}`}
                        style={styles.sheetResolutionItem}
                        activeOpacity={0.78}
                        onPress={() => setResolution(item as NaiResolution)}
                      >
                        <View style={styles.sheetResolutionItemTextGroup}>
                          <Text
                            style={[
                              styles.sheetResolutionItemTitle,
                              isActive && styles.sheetResolutionItemTitleActive,
                            ]}
                          >
                            {group.group} {item.label.split(" ")[0]}
                          </Text>
                          <Text
                            style={[
                              styles.sheetResolutionItemSubtitle,
                              isActive &&
                                styles.sheetResolutionItemSubtitleActive,
                            ]}
                          >
                            {item.width}×{item.height}
                          </Text>
                        </View>
                        {isActive && (
                          <Ionicons
                            name="checkmark"
                            size={20}
                            color={colors.colorTextInfo}
                          />
                        )}
                      </BottomSheetTouchableOpacity>
                    );
                  })}
                </View>
              ))}

              {(() => {
                const isCustom =
                  findResolutionPreset(resolution.width, resolution.height) ===
                  null;
                return (
                  <View>
                    <View style={styles.sheetDivider} />
                    <Text style={styles.sheetResolutionGroupTitle}>Custom</Text>
                    <BottomSheetTouchableOpacity
                      style={styles.sheetResolutionItem}
                      activeOpacity={0.78}
                    >
                      <View style={styles.sheetResolutionItemTextGroup}>
                        <Text
                          style={[
                            styles.sheetResolutionItemTitle,
                            isCustom && styles.sheetResolutionItemTitleActive,
                          ]}
                        >
                          Custom Resolution
                        </Text>
                        <Text
                          style={[
                            styles.sheetResolutionItemSubtitle,
                            isCustom &&
                              styles.sheetResolutionItemSubtitleActive,
                          ]}
                        >
                          {resolution.width}×{resolution.height}
                        </Text>
                      </View>
                      {isCustom && (
                        <Ionicons
                          name="checkmark"
                          size={20}
                          color={colors.colorTextInfo}
                        />
                      )}
                    </BottomSheetTouchableOpacity>
                  </View>
                );
              })()}
            </View>
          ) : bottomSheetRoute === "model" ? (
            <>{MODELS.flatMap((item, index) => {
              const isActive = model === item.value;
              const el = (
                <BottomSheetTouchableOpacity
                  key={item.value}
                  style={styles.sheetModelItem}
                  activeOpacity={0.78}
                  onPress={() => {
                    setModel(item.value);
                    setBottomSheetRoute("home");
                  }}
                >
                  <View style={styles.sheetModelItemLabelRow}>
                    <Text
                      style={[
                        styles.sheetModelItemLabel,
                        isActive && styles.sheetModelItemLabelActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                    {item.value === "nai-diffusion-4-5-full" && (
                      <View style={styles.sheetModelItemBadge}>
                        <Text style={styles.sheetModelItemBadgeText}>
                          권장
                        </Text>
                      </View>
                    )}
                  </View>
                  {isActive && (
                    <Ionicons
                      name="checkmark"
                      size={20}
                      color={colors.colorTextInfo}
                    />
                  )}
                </BottomSheetTouchableOpacity>
              );
              return index === 1
                ? [el, <View key="model-divider" style={styles.sheetDivider} />]
                : [el];
            })}</>
          ) : bottomSheetRoute === "sampler" ? (
            <>{SAMPLERS.flatMap((item, index) => {
            const isActive = sampler === item.value;
            const el = (
              <BottomSheetTouchableOpacity
                key={item.value}
                style={styles.sheetModelItem}
                activeOpacity={0.78}
                onPress={() => {
                  setSampler(item.value);
                  setBottomSheetRoute("home");
                }}
              >
                <View style={styles.sheetModelItemLabelRow}>
                  <Text style={[styles.sheetModelItemLabel, isActive && styles.sheetModelItemLabelActive]}>
                    {item.label}
                  </Text>
                  {item.value === "k_euler_ancestral" && (
                    <View style={styles.sheetModelItemBadge}>
                      <Text style={styles.sheetModelItemBadgeText}>권장</Text>
                    </View>
                  )}
                </View>
                {isActive && <Ionicons name="checkmark" size={20} color={colors.colorTextInfo} />}
              </BottomSheetTouchableOpacity>
            );
            return index === 5
              ? [el, <View key="sampler-divider" style={styles.sheetDivider} />]
              : [el];
            })}</>
          ) : (
            <>{NOISE_SCHEDULES.flatMap((item, index) => {
            const isActive = noiseSchedule === item.value;
            const el = (
              <BottomSheetTouchableOpacity
                key={item.value}
                style={styles.sheetModelItem}
                activeOpacity={0.78}
                onPress={() => {
                  setNoiseSchedule(item.value as NoiseSchedule);
                  setBottomSheetRoute("home");
                }}
              >
                <View style={styles.sheetModelItemLabelRow}>
                  <Text style={[styles.sheetModelItemLabel, isActive && styles.sheetModelItemLabelActive]}>
                    {item.label}
                  </Text>
                  {item.value === "karras" && (
                    <View style={styles.sheetModelItemBadge}>
                      <Text style={styles.sheetModelItemBadgeText}>권장</Text>
                    </View>
                  )}
                </View>
                {isActive && <Ionicons name="checkmark" size={20} color={colors.colorTextInfo} />}
              </BottomSheetTouchableOpacity>
            );
            return index === 2
              ? [el, <View key="noise-divider" style={styles.sheetDivider} />]
              : [el];
            })}</>
          )}
        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  );
}
