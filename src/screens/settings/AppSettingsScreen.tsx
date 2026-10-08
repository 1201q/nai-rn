import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PortalHost } from "@gorhom/portal";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { toast } from "sonner-native";

import {
  DETAIL_FIXED_HEADER_CONTENT_OFFSET,
  DetailHeaderOverlay,
} from "../../components/common/DetailScrollHeader";
import { Toggle } from "../../components/forms/FormControls";
import { SheetSelect } from "../../components/forms/SheetSelect";
import { SheetSliderControls } from "../../components/forms/SheetSliderControls";
import { seedDevHistory } from "../../lib/devHistorySeed";
import { useGenerationStore } from "../../store/generationStore";
import { monoFont, tokens } from "../../styles/tokens";
import {
  SettingsHelpButton,
  type SettingsHelpKey,
} from "../generation/sheets/settings/SettingsSlider";

type Feedback = {
  tone: "success" | "error";
  message: string;
};

const IMAGE_FORMATS = [
  { value: "png", label: "PNG" },
  { value: "webp", label: "WebP" },
] as const;
const IMAGE_FORMAT_LABELS = IMAGE_FORMATS.map((format) => format.label);

// NovelAI 구독 tier (0~3)
const TIER_NAMES = ["PAPER", "TABLET", "SCROLL", "OPUS"];
const SELECT_PORTAL_HOST = "app-settings-select-overlay";
const DEV_HISTORY_SEED_COUNT = 200;

function maskToken(token: string) {
  return `${token.slice(0, 4)}••••••••${token.slice(-4)}`;
}

function OptionLabel({
  title,
  helpKey,
  helpOpen,
  onHelpToggle,
}: {
  title: string;
  helpKey: SettingsHelpKey;
  helpOpen: boolean;
  onHelpToggle: () => void;
}) {
  return (
    <View style={styles.optionLabel}>
      <Text style={styles.optionTitle}>{title}</Text>
      <SettingsHelpButton
        helpKey={helpKey}
        open={helpOpen}
        onToggle={onHelpToggle}
        portalHostName={SELECT_PORTAL_HOST}
      />
    </View>
  );
}

export function AppSettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const batchCount = useGenerationStore((state) => state.batchCount);
  const setBatchCount = useGenerationStore((state) => state.setBatchCount);
  const imageFormat = useGenerationStore((state) => state.imageFormat);
  const setImageFormat = useGenerationStore((state) => state.setImageFormat);
  const mainImageLocked = useGenerationStore((state) => state.mainImageLocked);
  const setMainImageLocked = useGenerationStore(
    (state) => state.setMainImageLocked,
  );
  const closeSheetsOnGenerate = useGenerationStore(
    (state) => state.closeSheetsOnGenerate,
  );
  const setCloseSheetsOnGenerate = useGenerationStore(
    (state) => state.setCloseSheetsOnGenerate,
  );
  const predictiveBackPreview = useGenerationStore(
    (state) => state.predictiveBackPreview,
  );
  const setPredictiveBackPreview = useGenerationStore(
    (state) => state.setPredictiveBackPreview,
  );
  const sliderHandleOnly = useGenerationStore(
    (state) => state.sliderHandleOnly,
  );
  const setSliderHandleOnly = useGenerationStore(
    (state) => state.setSliderHandleOnly,
  );
  const scrollY = useRef(new Animated.Value(0)).current;
  const storedToken = useGenerationStore((state) => state.storedToken);
  const anlasBalance = useGenerationStore((state) => state.anlasBalance);
  const saveToken = useGenerationStore((state) => state.saveToken);
  const refreshAnlas = useGenerationStore((state) => state.refreshAnlas);
  const [tokenInput, setTokenInput] = useState("");
  const [isTokenVisible, setIsTokenVisible] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [helpKey, setHelpKey] = useState<SettingsHelpKey | null>(null);
  const [isSeedingHistory, setIsSeedingHistory] = useState(false);

  const showEditor = !storedToken || isEditing;

  function toggleHelp(next: SettingsHelpKey) {
    setHelpKey((current) => (current === next ? null : next));
  }

  async function handleSeedHistory() {
    setIsSeedingHistory(true);
    try {
      const records = await seedDevHistory(DEV_HISTORY_SEED_COUNT);
      useGenerationStore.setState((state) => ({
        generationHistory: [...records.reverse(), ...state.generationHistory],
        generationHistoryIds: null,
        generationHistoryRevision: state.generationHistoryRevision + 1,
        currentGeneration: state.currentGeneration ?? records[0],
      }));
      toast.success(`더미 이미지 ${records.length}장을 추가했습니다.`);
    } catch {
      toast.error("더미 이미지를 추가하지 못했습니다.");
    } finally {
      setIsSeedingHistory(false);
    }
  }

  async function handleSaveToken() {
    const token = tokenInput.trim();
    if (!token) {
      setFeedback({ tone: "error", message: "토큰을 입력해 주세요." });
      return;
    }

    setIsSaving(true);
    setFeedback(null);
    try {
      await saveToken(token);
      const result = await refreshAnlas();

      if (result.status === "success") {
        setIsEditing(false);
        setTokenInput("");
        setFeedback({
          tone: "success",
          message: "API 토큰을 저장하고 확인했습니다.",
        });
      } else if (result.status === "invalid-token") {
        setFeedback({
          tone: "error",
          message: "토큰은 저장했지만 유효하지 않습니다.",
        });
      } else {
        setFeedback({
          tone: "error",
          message: "토큰은 저장했지만 현재 유효성을 확인하지 못했습니다.",
        });
      }
    } catch (error: unknown) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Animated.ScrollView
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: insets.top + DETAIL_FIXED_HEADER_CONTENT_OFFSET,
              paddingBottom: insets.bottom + 32,
            },
          ]}
          keyboardDismissMode={
            Platform.OS === "ios" ? "interactive" : "on-drag"
          }
          keyboardShouldPersistTaps="handled"
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true },
          )}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.account}>
            {anlasBalance ? (
              <>
                <View style={styles.tierBadge}>
                  <Text style={styles.tierText}>
                    {TIER_NAMES[anlasBalance.tier] ?? TIER_NAMES[0]}
                  </Text>
                </View>
                <View style={styles.anlasRow}>
                  <Text style={styles.anlasValue}>
                    {anlasBalance.total.toLocaleString("en-US")}
                  </Text>
                  <Text style={styles.anlasUnit}>Anlas</Text>
                </View>
              </>
            ) : null}

            {storedToken ? (
              <View style={styles.tokenRow}>
                <Ionicons
                  name="key-outline"
                  size={16}
                  color={tokens.color.textMuted}
                />
                <Text numberOfLines={1} style={styles.tokenMasked}>
                  {maskToken(storedToken)}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    isEditing ? "토큰 변경 취소" : "토큰 변경"
                  }
                  hitSlop={8}
                  onPress={() => {
                    setIsEditing((current) => !current);
                    setTokenInput("");
                    setFeedback(null);
                  }}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <Text style={styles.tokenAction}>
                    {isEditing ? "취소" : "변경"}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View>
                <Text style={styles.optionTitle}>API Token</Text>
                <Text style={styles.tokenDescription}>
                  이미지 생성과 ANLAS 잔액 조회에 사용됩니다
                </Text>
              </View>
            )}

            {showEditor ? (
              <View style={styles.editor}>
                <View
                  style={[
                    styles.inputShell,
                    isInputFocused && styles.inputShellFocused,
                  ]}
                >
                  <TextInput
                    value={tokenInput}
                    accessibilityLabel="NovelAI API 토큰"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isSaving}
                    onBlur={() => setIsInputFocused(false)}
                    onChangeText={(value) => {
                      setTokenInput(value);
                      setFeedback(null);
                    }}
                    onFocus={() => setIsInputFocused(true)}
                    onSubmitEditing={() => void handleSaveToken()}
                    placeholder="NovelAI API token"
                    placeholderTextColor={tokens.color.textMuted}
                    returnKeyType="done"
                    secureTextEntry={!isTokenVisible}
                    selectionColor={tokens.color.accent}
                    style={styles.tokenInput}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      isTokenVisible ? "토큰 숨기기" : "토큰 표시"
                    }
                    hitSlop={4}
                    onPress={() => setIsTokenVisible((current) => !current)}
                    style={({ pressed }) => [
                      styles.visibilityButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Ionicons
                      name={isTokenVisible ? "eye-outline" : "eye-off-outline"}
                      size={20}
                      color={tokens.color.textTertiary}
                    />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="토큰 저장"
                    accessibilityState={{ disabled: isSaving }}
                    disabled={isSaving}
                    onPress={() => void handleSaveToken()}
                    style={({ pressed }) => [
                      styles.saveButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    {isSaving ? (
                      <ActivityIndicator
                        size="small"
                        color={tokens.color.onAccent}
                      />
                    ) : (
                      <Text style={styles.saveButtonText}>저장</Text>
                    )}
                  </Pressable>
                </View>

                <View style={styles.securityRow}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={13}
                    color={tokens.color.textMuted}
                  />
                  <Text style={styles.securityText}>
                    토큰은 이 기기의 보안 저장소에만 저장됩니다
                  </Text>
                </View>
              </View>
            ) : null}

            {feedback ? (
              <View accessibilityLiveRegion="polite" style={styles.feedbackRow}>
                <Ionicons
                  name={
                    feedback.tone === "success"
                      ? "checkmark-circle-outline"
                      : "alert-circle-outline"
                  }
                  size={15}
                  color={
                    feedback.tone === "success"
                      ? tokens.color.accent
                      : tokens.color.negative
                  }
                />
                <Text
                  style={[
                    styles.feedbackText,
                    feedback.tone === "error" && styles.feedbackTextError,
                  ]}
                >
                  {feedback.message}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.option}>
            <SheetSliderControls
              inSheet={false}
              label="Batch Count"
              value={batchCount}
              min={1}
              max={100}
              step={1}
              precision={0}
              onChange={setBatchCount}
              header={
                <OptionLabel
                  title="Batch Count"
                  helpKey="batchCount"
                  helpOpen={helpKey === "batchCount"}
                  onHelpToggle={() => toggleHelp("batchCount")}
                />
              }
            />
          </View>

          <View style={[styles.option, styles.optionRow]}>
            <OptionLabel
              title="Image Format"
              helpKey="imageFormat"
              helpOpen={helpKey === "imageFormat"}
              onHelpToggle={() => toggleHelp("imageFormat")}
            />
            <SheetSelect
              accessibilityLabel="Image Format"
              value={
                IMAGE_FORMATS.find((format) => format.value === imageFormat)!
                  .label
              }
              options={IMAGE_FORMAT_LABELS}
              onChange={(label) =>
                setImageFormat(
                  IMAGE_FORMATS.find((format) => format.label === label)!.value,
                )
              }
              portalHostName={SELECT_PORTAL_HOST}
              style={styles.formatSelect}
            />
          </View>

          <View style={[styles.option, styles.optionRow]}>
            <View style={styles.optionText}>
              <Text style={styles.optionTitle}>
                메인 화면 이미지 확대/이동 잠금
              </Text>
              <Text style={styles.optionDescription}>
                메인 화면의 생성 이미지를 기본 크기와 위치로 고정합니다. 켜 두면
                드래그, 확대/축소가 잠깁니다.
              </Text>
            </View>
            <Toggle
              label="이미지 확대/이동 잠금"
              value={mainImageLocked}
              onChange={setMainImageLocked}
            />
          </View>

          <View style={[styles.option, styles.optionRow]}>
            <View style={styles.optionText}>
              <Text style={styles.optionTitle}>
                이미지 생성 시 열린 시트 닫기
              </Text>
              <Text style={styles.optionDescription}>
                이미지 생성 버튼을 누르면 열려 있던 Prompt, Settings, History
                시트를 닫습니다.
              </Text>
            </View>
            <Toggle
              label="생성 시 시트 닫기"
              value={closeSheetsOnGenerate}
              onChange={setCloseSheetsOnGenerate}
            />
          </View>

          <View style={[styles.option, styles.optionRow]}>
            <View style={styles.optionText}>
              <Text style={styles.optionTitle}>슬라이더 핸들로만 조절하기</Text>
              <Text style={styles.optionDescription}>
                슬라이더의 동그란 핸들을 잡고 끌 때만 값이 바뀝니다. 스크롤하다
                의도치 않게 값이 바뀌는 실수를 막습니다.
              </Text>
            </View>
            <Toggle
              label="슬라이더 핸들로만 조절"
              value={sliderHandleOnly}
              onChange={setSliderHandleOnly}
            />
          </View>

          {Platform.OS === "android" ? (
            <View style={[styles.option, styles.optionRow]}>
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>뒤로가기 미리보기 (고급)</Text>
                <Text style={styles.optionDescription}>
                  뒤로가기 제스처를 하는 동안 시트와 화면이 손가락을 따라
                  줄어들면서 미리 보입니다. predictive back에 문제가 있다면
                  끄시는 것을 추천드립니다.
                </Text>
              </View>
              <Toggle
                label="뒤로가기 미리보기"
                value={predictiveBackPreview}
                onChange={setPredictiveBackPreview}
              />
            </View>
          ) : null}

          <View style={[styles.option, styles.optionRow]}>
            <View style={styles.optionText}>
              <Text style={styles.optionTitle}>
                History 더미 이미지 (테스트용)
              </Text>
              <Text style={styles.optionDescription}>
                History 그리드 테스트용 단색 이미지 {DEV_HISTORY_SEED_COUNT}
                장을 추가합니다.
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="History 더미 이미지 추가"
              accessibilityState={{ disabled: isSeedingHistory }}
              disabled={isSeedingHistory}
              onPress={() => void handleSeedHistory()}
            >
              {isSeedingHistory ? (
                <ActivityIndicator color={tokens.color.accent} size="small" />
              ) : (
                <Text style={styles.tokenAction}>추가</Text>
              )}
            </Pressable>
          </View>
        </Animated.ScrollView>
      </KeyboardAvoidingView>

      <DetailHeaderOverlay
        title="App Settings"
        scrollY={scrollY}
        topInset={insets.top}
        onBack={() => router.back()}
        showMore={false}
        hideCompactTitleOnScroll
      />

      <View pointerEvents="box-none" style={styles.selectPortalLayer}>
        <PortalHost name={SELECT_PORTAL_HOST} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: tokens.color.app,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: tokens.space[10],
  },
  account: {
    paddingTop: 4,
    paddingBottom: 24,
  },
  tierBadge: {
    height: 24,
    paddingHorizontal: 10,
    alignSelf: "flex-start",
    justifyContent: "center",
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: "rgba(255,201,60,0.45)",
  },
  tierText: {
    color: tokens.color.accent,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type["2xs"],
    letterSpacing: 0.3,
  },
  anlasRow: {
    marginTop: 14,
    marginBottom: 18,
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  anlasValue: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.bold,
    fontSize: 34,
    letterSpacing: -0.8,
    fontVariant: ["tabular-nums"],
  },
  anlasUnit: {
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.medium,
    fontSize: tokens.type.sm,
  },
  tokenRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  tokenMasked: {
    flex: 1,
    minWidth: 0,
    color: tokens.color.textSecondary,
    fontFamily: monoFont,
    fontSize: tokens.type.sm,
  },
  tokenAction: {
    color: tokens.color.accent,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type.sm,
  },
  editor: {
    marginTop: 12,
  },
  inputShell: {
    height: 52,
    paddingLeft: 14,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    backgroundColor: tokens.color.sunken,
  },
  inputShellFocused: {
    borderColor: tokens.color.accent,
  },
  tokenInput: {
    flex: 1,
    height: "100%",
    padding: 0,
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.medium,
    fontSize: tokens.type.sm,
  },
  visibilityButton: {
    width: 44,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButton: {
    minWidth: 54,
    height: 36,
    marginRight: 8,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.accent,
  },
  saveButtonText: {
    color: tokens.color.onAccent,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type.sm,
  },
  securityRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  securityText: {
    flex: 1,
    color: tokens.color.textMuted,
    fontFamily: tokens.font.regular,
    fontSize: tokens.type["2xs"],
    lineHeight: 17,
  },
  feedbackRow: {
    minHeight: 20,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  feedbackText: {
    flex: 1,
    color: tokens.color.accent,
    fontFamily: tokens.font.medium,
    fontSize: tokens.type["2xs"],
    lineHeight: 17,
  },
  feedbackTextError: {
    color: tokens.color.negative,
  },
  option: {
    paddingVertical: 18,
    borderTopWidth: 1,
    borderTopColor: tokens.color.borderSubtle,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
  },
  optionLabel: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  optionTitle: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: 17,
  },
  optionText: {
    flex: 1,
    minWidth: 0,
  },
  optionDescription: {
    marginTop: 4,
    color: tokens.color.textMuted,
    fontFamily: tokens.font.regular,
    fontSize: tokens.type.xs,
    lineHeight: 19,
  },
  tokenDescription: {
    marginTop: 6,
    color: tokens.color.textMuted,
    fontFamily: tokens.font.regular,
    fontSize: tokens.type.xs,
    lineHeight: 19,
  },
  formatSelect: {
    width: 112,
  },
  selectPortalLayer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 120,
    elevation: 120,
  },
  pressed: {
    opacity: tokens.opacity.pressed,
  },
});
