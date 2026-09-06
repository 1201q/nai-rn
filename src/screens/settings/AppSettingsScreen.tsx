import { useEffect, useRef, useState } from "react";
import {
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
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Clipboard from "expo-clipboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PrimaryButton } from "../../components/common/Buttons";
import {
  DETAIL_FIXED_HEADER_CONTENT_OFFSET,
  DetailHeaderOverlay,
} from "../../components/common/DetailScrollHeader";
import { useGenerationStore } from "../../store/generationStore";
import { tokens } from "../../styles/tokens";
import {
  getGenerationPerformanceReport,
  isGenerationPerformanceRecording,
  startGenerationPerformance,
  stopGenerationPerformance,
} from "../../lib/generationPerformance";

type Feedback = {
  tone: "success" | "error";
  message: string;
};

export function AppSettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scrollY = useRef(new Animated.Value(0)).current;
  const storedToken = useGenerationStore((state) => state.storedToken);
  const saveToken = useGenerationStore((state) => state.saveToken);
  const refreshAnlas = useGenerationStore((state) => state.refreshAnlas);
  const [tokenInput, setTokenInput] = useState("");
  const [isTokenVisible, setIsTokenVisible] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [isRecording, setIsRecording] = useState(isGenerationPerformanceRecording);
  const [performanceReport, setPerformanceReport] = useState(getGenerationPerformanceReport);
  const [performanceMessage, setPerformanceMessage] = useState<string | null>(null);

  function togglePerformanceRecording() {
    setPerformanceMessage(null);
    if (isGenerationPerformanceRecording()) {
      setPerformanceReport(stopGenerationPerformance());
      setIsRecording(false);
    } else {
      startGenerationPerformance();
      setPerformanceReport(null);
      setIsRecording(true);
    }
  }

  async function copyPerformanceReport() {
    if (!performanceReport || isGenerationPerformanceRecording()) return;
    try {
      const copied = await Clipboard.setStringAsync(JSON.stringify(performanceReport, null, 2));
      setPerformanceMessage(copied ? "측정 결과 JSON을 복사했습니다." : "측정 결과를 복사하지 못했습니다.");
    } catch {
      setPerformanceMessage("측정 결과를 복사하지 못했습니다.");
    }
  }

  useEffect(() => {
    if (storedToken) setTokenInput(storedToken);
  }, [storedToken]);

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
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          keyboardShouldPersistTaps="handled"
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true },
          )}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          <View>
            <Text style={styles.sectionLabel}>NOVELAI</Text>

            <View style={styles.tokenCard}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIcon}>
                  <Ionicons
                    name="key-outline"
                    size={19}
                    color={tokens.color.accent}
                  />
                </View>
                <View style={styles.cardCopy}>
                  <Text style={styles.cardTitle}>API Token</Text>
                  <Text style={styles.cardDescription}>
                    이미지 생성과 ANLAS 잔액 조회에 사용됩니다
                  </Text>
                </View>
              </View>

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

            <View style={styles.saveButtonRow}>
              <PrimaryButton
                label={isSaving ? "Saving..." : "Save Token"}
                icon={
                  <Ionicons
                    name="checkmark"
                    size={19}
                    color={tokens.color.onAccent}
                  />
                }
                loading={isSaving}
                disabled={isSaving}
                onPress={() => void handleSaveToken()}
              />
            </View>

            {feedback ? (
              <View
                accessibilityLiveRegion="polite"
                style={styles.feedbackRow}
              >
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

            <View style={styles.legacySection}>
              <Text style={styles.sectionLabel}>PERFORMANCE BASELINE</Text>
              <View style={styles.tokenCard}>
                <Text style={styles.cardTitle}>
                  {isRecording ? "성능 측정 중" : "이미지 생성 성능 측정"}
                </Text>
                <Text style={styles.cardDescription}>
                  시작 후 생성 화면에서 조작하고, 이곳으로 돌아와 종료하세요.
                  결과는 앱 종료 전 복사해 주세요.
                </Text>
                {__DEV__ ? (
                  <Text style={styles.cardDescription}>
                    개발 빌드입니다. 전후 성능 비교는 릴리스 빌드에서 진행하세요.
                  </Text>
                ) : null}
                <View style={styles.saveButtonRow}>
                  <PrimaryButton
                    label={isRecording ? "성능 측정 종료" : "성능 측정 시작"}
                    onPress={togglePerformanceRecording}
                  />
                </View>
                <View style={styles.saveButtonRow}>
                  <PrimaryButton
                    label="측정 결과 JSON 복사"
                    disabled={isRecording || !performanceReport}
                    onPress={() => void copyPerformanceReport()}
                  />
                </View>
                {performanceReport ? (
                  <Text style={styles.cardDescription}>
                    JS 지연 p95 {performanceReport.jsLagForeground.p95Ms.toFixed(1)}ms
                    {" / "}최대 {performanceReport.jsLagForeground.maxMs.toFixed(1)}ms
                    {" / "}50ms 이상 {performanceReport.jsLagForeground.atLeast50Ms}회
                  </Text>
                ) : null}
                {performanceMessage ? (
                  <Text accessibilityLiveRegion="polite" style={styles.cardDescription}>
                    {performanceMessage}
                  </Text>
                ) : null}
              </View>
            </View>

            <View style={styles.legacySection}>
              <Text style={styles.sectionLabel}>LEGACY PAGES</Text>

              <View style={styles.legacyCard}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="기존 Settings와 Prompt 페이지 열기"
                  onPress={() => router.navigate("/image-settings")}
                  style={({ pressed }) => [
                    styles.legacyRow,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.legacyIcon}>
                    <Ionicons
                      name="options-outline"
                      size={20}
                      color={tokens.color.accent}
                    />
                  </View>
                  <View style={styles.legacyCopy}>
                    <Text style={styles.legacyTitle}>Settings / Prompt</Text>
                    <Text style={styles.legacyDescription}>
                      기존 탭 기반 이미지 생성 설정 화면
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={tokens.color.textMuted}
                  />
                </Pressable>

                <View style={styles.legacyDivider} />

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="기존 History 페이지 열기"
                  onPress={() => router.navigate("/history")}
                  style={({ pressed }) => [
                    styles.legacyRow,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.legacyIcon}>
                    <Ionicons
                      name="images-outline"
                      size={20}
                      color={tokens.color.accent}
                    />
                  </View>
                  <View style={styles.legacyCopy}>
                    <Text style={styles.legacyTitle}>History</Text>
                    <Text style={styles.legacyDescription}>
                      기존 전체 화면 이미지 생성 기록
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={tokens.color.textMuted}
                  />
                </Pressable>
              </View>
            </View>
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
    paddingHorizontal: tokens.space[6],
  },
  sectionLabel: {
    marginBottom: 12,
    paddingHorizontal: 4,
    color: tokens.color.textMuted,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type["3xs"],
    letterSpacing: tokens.tracking.wide,
  },
  tokenCard: {
    padding: 16,
    borderRadius: tokens.radius.xl,
    backgroundColor: tokens.color.card,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  cardIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.sunken,
  },
  cardCopy: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type.md,
  },
  cardDescription: {
    marginTop: 3,
    color: tokens.color.textMuted,
    fontFamily: tokens.font.regular,
    fontSize: tokens.type["2xs"],
    lineHeight: 17,
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
    width: 48,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  securityRow: {
    marginTop: 10,
    paddingHorizontal: 2,
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
  saveButtonRow: {
    height: 52,
    marginTop: 14,
    flexDirection: "row",
  },
  feedbackRow: {
    minHeight: 20,
    marginTop: 12,
    paddingHorizontal: 4,
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
  legacySection: {
    marginTop: 36,
  },
  legacyCard: {
    overflow: "hidden",
    borderRadius: tokens.radius.xl,
    backgroundColor: tokens.color.card,
  },
  legacyRow: {
    minHeight: 72,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  legacyIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.sunken,
  },
  legacyCopy: {
    flex: 1,
    minWidth: 0,
  },
  legacyTitle: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type.sm,
  },
  legacyDescription: {
    marginTop: 3,
    color: tokens.color.textMuted,
    fontFamily: tokens.font.regular,
    fontSize: tokens.type["2xs"],
    lineHeight: 17,
  },
  legacyDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 68,
    backgroundColor: tokens.color.borderSubtle,
  },
  pressed: {
    opacity: 0.68,
  },
});
