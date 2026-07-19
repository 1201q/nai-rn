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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PrimaryButton } from "../../components/common/Buttons";
import {
  DETAIL_HEADER_TOP_OFFSET,
  DetailHeaderOverlay,
  DetailScrollTitle,
} from "../../components/common/DetailScrollHeader";
import { useGenerationStore } from "../../store/generationStore";
import { tokens } from "../../styles/tokens";

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
      await refreshAnlas();
      setFeedback({ tone: "success", message: "API 토큰을 저장했습니다." });
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
              paddingTop: insets.top + DETAIL_HEADER_TOP_OFFSET,
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
          <DetailScrollTitle title="App Settings" scrollY={scrollY} />

          <View style={styles.section}>
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
          </View>
        </Animated.ScrollView>
      </KeyboardAvoidingView>

      <DetailHeaderOverlay
        scrollY={scrollY}
        topInset={insets.top}
        onBack={() => router.back()}
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
    paddingHorizontal: tokens.space[8],
  },
  section: {
    marginTop: 24,
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
  pressed: {
    opacity: 0.68,
  },
});
