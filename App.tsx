import "react-native-gesture-handler";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { TabBar, TabView } from "react-native-tab-view";

import { generateNovelAiImage } from "./src/lib/novelai";
import { getNovelAiToken, saveNovelAiToken } from "./src/lib/secureToken";
import { colors } from "./src/styles/colors";

type Screen = "generation" | "settings";
type AspectRatio = "1:1" | "3:4" | "16:9";
type SelectionSheetKey = "model" | "sampler" | null;

const ASPECT_DIMENSIONS: Record<
  AspectRatio,
  { width: number; height: number }
> = {
  "1:1": { width: 1024, height: 1024 },
  "3:4": { width: 832, height: 1216 },
  "16:9": { width: 1216, height: 704 },
};

const SAMPLERS = [
  { label: "Euler Ancestral", value: "k_euler_ancestral" },
  { label: "Euler", value: "k_euler" },

  { label: "DPM++ 2S Ancestral", value: "k_dpmpp_2s_ancestral" },
  { label: "DPM++ 2M SDE", value: "k_dpmpp_2m_sde" },
  { label: "DPM++ 2M", value: "k_dpmpp_2m" },
  { label: "DPM++ SDE", value: "k_dpmpp_sde" },

  { label: "DDIM", value: "ddim_v3" },
];

const MODELS = [
  { label: "V4.5 Full", value: "nai-diffusion-4-5-full" },
  { label: "V4.5 Curated", value: "nai-diffusion-4-5-curated" },
  { label: "V4 Curated", value: "nai-diffusion-4-curated-preview" },
  { label: "Anime V3", value: "nai-diffusion-3" },
  { label: "Furry V3", value: "nai-diffusion-furry-3" },
];

export default function App() {
  const previewAnimation = useRef(new Animated.Value(0)).current;
  const modelSelectionSheetRef = useRef<BottomSheet>(null);
  const samplerSelectionSheetRef = useRef<BottomSheet>(null);
  const activeSelectionSheetRef = useRef<SelectionSheetKey>(null);
  const [screen, setScreen] = useState<Screen>("generation");
  const [settingsIndex, setSettingsIndex] = useState(1);
  const [settingsRoutes] = useState([
    { key: "prompt", title: "Prompt" },
    { key: "options", title: "Options" },
  ]);
  const [tokenInput, setTokenInput] = useState("");
  const [storedToken, setStoredToken] = useState<string | null>(null);
  const [prompt, setPrompt] = useState(
    "silver-haired mage, under moonlight, arcane magic circle, purple runes, starry night",
  );
  const [negativePrompt, setNegativePrompt] = useState(
    "low quality, blurry, watermark, text",
  );
  const [model, setModel] = useState("nai-diffusion-4-5-full");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("3:4");
  const [steps, setSteps] = useState(28);
  const [scale, setScale] = useState(5);
  const [seedText, setSeedText] = useState("");
  const [sampler, setSampler] = useState("k_euler_ancestral");
  const [outputCount, setOutputCount] = useState(1);
  const [imageDataUri, setImageDataUri] = useState<string | null>(null);
  const [generatedDimensions, setGeneratedDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  useEffect(() => {
    getNovelAiToken()
      .then(setStoredToken)
      .catch((error: unknown) => {
        setMessage(error instanceof Error ? error.message : String(error));
      });
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (isImagePreviewOpen) {
          closeImagePreview();
          return true;
        }

        if (activeSelectionSheetRef.current) {
          closeSelectionSheet();
          return true;
        }

        if (screen === "settings") {
          setScreen("generation");
          return true;
        }

        return false;
      },
    );

    return () => {
      subscription.remove();
    };
  }, [isImagePreviewOpen, screen]);

  const renderSelectionBackdrop = useCallback(
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
    if (!imageDataUri) {
      return;
    }

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
      if (finished) {
        setIsImagePreviewOpen(false);
      }
    });
  }

  async function handleSaveToken() {
    const token = tokenInput.trim();

    if (!token) {
      setMessage("토큰을 입력해주세요.");
      return;
    }

    await saveNovelAiToken(token);
    setStoredToken(token);
    setTokenInput("");
    setMessage("토큰 저장 완료");
  }

  async function handleGenerateImage(navigateAfterSuccess = false) {
    if (!storedToken) {
      setMessage("저장된 NovelAI 토큰이 없습니다.");
      return;
    }

    if (!prompt.trim()) {
      setMessage("프롬프트를 입력해주세요.");
      setScreen("settings");
      setSettingsIndex(0);
      return;
    }

    const fixedSeed = Number.parseInt(seedText.trim(), 10);
    const dimensions = ASPECT_DIMENSIONS[aspectRatio];

    setIsLoading(true);
    setMessage(null);

    try {
      const result = await generateNovelAiImage({
        token: storedToken,
        prompt: prompt.trim(),
        negativePrompt: negativePrompt.trim(),
        model,
        width: dimensions.width,
        height: dimensions.height,
        steps,
        scale,
        sampler,
        seed: Number.isFinite(fixedSeed) ? fixedSeed : undefined,
        nSamples: outputCount,
      });

      setImageDataUri(result.imageDataUri);
      setGeneratedDimensions(dimensions);
      if (navigateAfterSuccess) {
        setScreen("generation");
      }
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }

  function openSettings() {
    setScreen("settings");
  }

  function randomizeSeed() {
    setSeedText(String(Math.floor(Math.random() * 4_294_967_296)));
  }

  function openSelectionSheet(
    nextSelectionSheet: Exclude<SelectionSheetKey, null>,
  ) {
    if (nextSelectionSheet === "model") {
      samplerSelectionSheetRef.current?.close();
      activeSelectionSheetRef.current = "model";
      requestAnimationFrame(() => {
        modelSelectionSheetRef.current?.snapToIndex(0);
      });
      return;
    }

    modelSelectionSheetRef.current?.close();
    activeSelectionSheetRef.current = "sampler";
    requestAnimationFrame(() => {
      samplerSelectionSheetRef.current?.snapToIndex(0);
    });
  }

  function closeSelectionSheet() {
    if (activeSelectionSheetRef.current === "model") {
      modelSelectionSheetRef.current?.close();
      return;
    }

    if (activeSelectionSheetRef.current === "sampler") {
      samplerSelectionSheetRef.current?.close();
    }
  }

  function handleSelectionSheetChange(
    sheet: Exclude<SelectionSheetKey, null>,
    index: number,
  ) {
    if (index >= 0) {
      activeSelectionSheetRef.current = sheet;
      return;
    }

    if (activeSelectionSheetRef.current === sheet) {
      activeSelectionSheetRef.current = null;
    }
  }

  function renderSettingsScene({
    route,
  }: {
    route: { key: string; title: string };
  }) {
    if (route.key === "prompt") {
      return (
        <ScrollView
          contentContainerStyle={styles.settingsContent}
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
        contentContainerStyle={styles.settingsContent}
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
          onMinus={() => setSteps((value) => Math.max(1, value - 1))}
          onPlus={() => setSteps((value) => Math.min(50, value + 1))}
        />
        <StepperRow
          label="Guidance Scale"
          value={scale}
          onMinus={() =>
            setScale((value) => Math.max(1, Number((value - 0.5).toFixed(1))))
          }
          onPlus={() =>
            setScale((value) => Math.min(15, Number((value + 0.5).toFixed(1))))
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
    <GestureHandlerRootView style={styles.root}>
      <View style={styles.screen}>
        <StatusBar style="light" />
        {screen === "generation" ? (
          <>
            <Header title="Generation" onBack={() => {}} />
            <View style={styles.imageStage}>
              {imageDataUri && generatedDimensions ? (
                <TouchableOpacity
                  activeOpacity={0.92}
                  onPress={openImagePreview}
                  style={[
                    styles.generatedImageWrap,
                    {
                      aspectRatio:
                        generatedDimensions.width / generatedDimensions.height,
                    },
                  ]}
                >
                  <Image
                    source={{ uri: imageDataUri }}
                    resizeMode="cover"
                    style={styles.generatedImage}
                  />
                </TouchableOpacity>
              ) : null}
            </View>

            {message ? <Text style={styles.message}>{message}</Text> : null}

            <View style={styles.temporaryTokenBox}>
              <Text style={styles.temporaryTokenLabel}>
                {storedToken ? "Token saved" : "Temporary token"}
              </Text>
              <View style={styles.temporaryTokenRow}>
                <TextInput
                  value={tokenInput}
                  onChangeText={setTokenInput}
                  placeholder="NovelAI API Token"
                  placeholderTextColor={colors.grey500}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                  style={styles.temporaryTokenInput}
                />
                <TouchableOpacity
                  style={styles.temporaryTokenButton}
                  activeOpacity={0.78}
                  onPress={handleSaveToken}
                >
                  <Text style={styles.temporaryTokenButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.bottomBar}>
              <TouchableOpacity
                style={styles.settingsButton}
                activeOpacity={0.78}
                onPress={openSettings}
              >
                <Text style={styles.settingsIcon}>⚙</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.generateButton,
                  isLoading && styles.disabledButton,
                ]}
                activeOpacity={0.82}
                onPress={() => handleGenerateImage(false)}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <Text style={styles.generateText}>Generate</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={styles.settingsScreen}>
            <Header title="Create" onBack={() => setScreen("generation")} />
            <TabView
              style={styles.settingsTabView}
              navigationState={{ index: settingsIndex, routes: settingsRoutes }}
              onIndexChange={setSettingsIndex}
              renderTabBar={(props) => (
                <TabBar
                  {...props}
                  style={styles.tabs}
                  indicatorStyle={styles.tabIndicator}
                  activeColor={colors.background}
                  inactiveColor={colors.grey500}
                />
              )}
              renderScene={renderSettingsScene}
            />

            <View style={styles.settingsFooter}>
              <TouchableOpacity
                style={[
                  styles.fullGenerateButton,
                  isLoading && styles.disabledButton,
                ]}
                activeOpacity={0.82}
                onPress={() => handleGenerateImage(true)}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <Text style={styles.generateText}>Generate</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        <Modal
          visible={isImagePreviewOpen}
          transparent
          animationType="fade"
          onRequestClose={closeImagePreview}
        >
          <Animated.View
            style={[styles.previewBackdrop, { opacity: previewAnimation }]}
          >
            <TouchableOpacity
              activeOpacity={1}
              style={styles.previewPressArea}
              onPress={closeImagePreview}
            >
              {imageDataUri ? (
                <Animated.Image
                  source={{ uri: imageDataUri }}
                  resizeMode="contain"
                  style={[
                    styles.previewImage,
                    {
                      transform: [
                        {
                          scale: previewAnimation.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.94, 1],
                          }),
                        },
                      ],
                    },
                  ]}
                />
              ) : null}
              <Animated.Text
                style={[styles.previewHint, { opacity: previewAnimation }]}
              >
                탭해서 닫기
              </Animated.Text>
            </TouchableOpacity>
          </Animated.View>
        </Modal>

        <BottomSheet
          ref={modelSelectionSheetRef}
          index={-1}
          snapPoints={[390]}
          enablePanDownToClose
          backdropComponent={renderSelectionBackdrop}
          detached
          bottomInset={14}
          style={styles.selectionSheetContainer}
          backgroundStyle={styles.selectionSheetBackground}
          handleIndicatorStyle={styles.selectionSheetHandle}
          enableDynamicSizing={false}
          onChange={(index) => handleSelectionSheetChange("model", index)}
        >
          <BottomSheetScrollView
            contentContainerStyle={styles.selectionSheetContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.selectionSheetTitle}>Select Model</Text>
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
          ref={samplerSelectionSheetRef}
          index={-1}
          snapPoints={[500]}
          enablePanDownToClose
          backdropComponent={renderSelectionBackdrop}
          detached
          bottomInset={14}
          style={styles.selectionSheetContainer}
          backgroundStyle={styles.selectionSheetBackground}
          handleIndicatorStyle={styles.selectionSheetHandle}
          enableDynamicSizing={false}
          onChange={(index) => handleSelectionSheetChange("sampler", index)}
        >
          <BottomSheetScrollView
            contentContainerStyle={styles.selectionSheetContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.selectionSheetTitle}>Select Sampler</Text>
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
    </GestureHandlerRootView>
  );
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.iconButton}
        activeOpacity={0.7}
        onPress={onBack}
      >
        <Text style={styles.iconText}>‹</Text>
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
      <TouchableOpacity style={styles.iconButton} activeOpacity={0.7}>
        <Text style={styles.moreText}>•••</Text>
      </TouchableOpacity>
    </View>
  );
}

function getOptionLabel(
  options: Array<{ label: string; value: string }>,
  value: string,
) {
  return options.find((option) => option.value === value)?.label ?? value;
}

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
      style={[
        styles.selectionSheetItem,
        active && styles.activeSelectionSheetItem,
      ]}
      activeOpacity={0.78}
      onPress={onPress}
    >
      <Text
        style={[
          styles.selectionSheetItemText,
          active && styles.activeSelectionSheetItemText,
        ]}
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
  onChangeText: (value: string) => void;
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

function OptionRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.optionRow}>
      <Text style={styles.optionLabel}>{label}</Text>
      <Text style={styles.optionValue}>{value}</Text>
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  screen: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? 28 : 0,
    backgroundColor: colors.grey900,
  },
  settingsScreen: {
    flex: 1,
    backgroundColor: colors.grey900,
  },
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  headerTitle: {
    color: colors.background,
    fontSize: 18,
    fontWeight: "700",
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    color: colors.background,
    fontSize: 34,
    lineHeight: 36,
  },
  moreText: {
    color: colors.background,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0,
  },
  imageStage: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  generatedImageWrap: {
    width: "100%",
    overflow: "hidden",
    borderRadius: 14,
    backgroundColor: colors.grey800,
  },
  generatedImage: {
    width: "100%",
    height: "100%",
  },
  message: {
    marginHorizontal: 16,
    marginBottom: 10,
    color: colors.red300,
    fontSize: 13,
    lineHeight: 18,
  },
  temporaryTokenBox: {
    marginHorizontal: 16,
    marginBottom: 10,
  },
  temporaryTokenLabel: {
    marginBottom: 6,
    color: colors.grey400,
    fontSize: 12,
    fontWeight: "700",
  },
  temporaryTokenRow: {
    flexDirection: "row",
    gap: 8,
  },
  temporaryTokenInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: colors.greyOpacity500,
    borderRadius: 14,
    paddingHorizontal: 12,
    backgroundColor: colors.grey800,
    color: colors.background,
  },
  temporaryTokenButton: {
    width: 74,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: colors.blue600,
  },
  temporaryTokenButtonText: {
    color: colors.background,
    fontWeight: "800",
  },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 18,
  },
  settingsButton: {
    width: 68,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: colors.grey800,
  },
  settingsIcon: {
    color: colors.purple300,
    fontSize: 26,
  },
  generateButton: {
    flex: 1,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: colors.blue500,
  },
  fullGenerateButton: {
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
  tabs: {
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
  settingsTabView: {
    flex: 1,
  },
  settingsContent: {
    padding: 16,
    paddingBottom: 24,
  },
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
  optionRow: {
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
  activeSegmentButton: {
    borderColor: colors.purple400,
    backgroundColor: colors.greyOpacity300,
  },
  segmentText: {
    color: colors.grey400,
    fontWeight: "700",
  },
  activeSegmentText: {
    color: colors.background,
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
  samplerList: {
    gap: 8,
  },
  samplerButton: {
    minHeight: 38,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.greyOpacity500,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.greyOpacity200,
  },
  activeSamplerButton: {
    borderColor: colors.purple400,
    backgroundColor: colors.greyOpacity300,
  },
  samplerButtonText: {
    color: colors.grey400,
    fontWeight: "700",
  },
  activeSamplerButtonText: {
    color: colors.background,
  },
  settingsFooter: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 18,
    backgroundColor: colors.grey900,
  },
  selectionSheetBackground: {
    borderRadius: 28,
    backgroundColor: colors.grey800,
  },
  selectionSheetContainer: {
    marginHorizontal: 14,
    zIndex: 20,
    elevation: 20,
  },
  selectionSheetHandle: {
    width: 56,
    height: 5,
    backgroundColor: colors.grey600,
  },
  selectionSheetContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  selectionSheetTitle: {
    marginBottom: 16,
    paddingLeft: 6,
    paddingTop: 6,
    color: colors.background,
    fontSize: 20,
    fontWeight: "800",
  },
  selectionSheetItem: {
    minHeight: 48,
    justifyContent: "center",
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 6,
  },
  activeSelectionSheetItem: {
    backgroundColor: colors.greyOpacity300,
  },
  selectionSheetItemText: {
    color: colors.grey300,
    fontSize: 16,
    fontWeight: "700",
  },
  activeSelectionSheetItemText: {
    color: colors.background,
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.94)",
  },
  previewPressArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  previewImage: {
    width: "100%",
    height: "88%",
  },
  previewHint: {
    marginTop: 14,
    color: colors.background,
    fontSize: 14,
    opacity: 0.75,
  },
});

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
      style={[styles.segmentButton, active && styles.activeSegmentButton]}
      activeOpacity={0.78}
      onPress={onPress}
    >
      <Text style={[styles.segmentText, active && styles.activeSegmentText]}>
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
    <View style={styles.optionRow}>
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
