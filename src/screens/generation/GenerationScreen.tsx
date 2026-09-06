import { useCallback, useEffect, useRef, useState } from "react";
import {
  BackHandler,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PortalHost } from "@gorhom/portal";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import Reanimated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { KeyboardStickyView } from "react-native-keyboard-controller";

import { IconButton } from "../../components/common/Buttons";
import { SHEET_SELECT_PORTAL_HOST } from "../../components/forms/SheetSelect";
import { SuggestionBar } from "../../components/generation/SuggestionBar";
import { SuggestionBarProvider } from "../../context/SuggestionBarContext";
import {
  GenerationInputCommitProvider,
  useGenerationInputCommit,
} from "../../context/GenerationInputCommitContext";
import { useGenerationChromeMetrics } from "../../hooks/useGenerationChromeMetrics";
import {
  usePredictiveBackHandler,
  type PredictiveBackEvent,
} from "../../native/predictiveBack";
import {
  selectOverallPercent,
  useGenerationStore,
} from "../../store/generationStore";
import { tokens } from "../../styles/tokens";
import { GenerationCanvas } from "./GenerationCanvas";
import {
  PromptSheetHost,
  UtilitySheetHost,
  type PromptSheetStage,
  type UtilitySheet,
} from "./GenerationSheetScaffold";

const SHEET_BACK_CANCEL_SPRING = {
  damping: 30,
  stiffness: 320,
  mass: 0.75,
};

function GenerateAction({
  onBeforeGenerate,
  onGenerationStarted,
}: {
  onBeforeGenerate: () => void;
  onGenerationStarted: () => void;
}) {
  const isLoading = useGenerationStore((s) => s.isLoading);
  const batchCount = useGenerationStore((s) => s.batchCount);
  const queueTotal = useGenerationStore((s) => s.queueTotal);
  const queueIndex = useGenerationStore((s) => s.queueIndex);
  const percent = useGenerationStore(selectOverallPercent);
  const generateImage = useGenerationStore((s) => s.generateImage);
  const requestQueueCancel = useGenerationStore((s) => s.requestQueueCancel);
  const progress = useSharedValue(0);
  const mountedRef = useRef(true);

  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );

  useEffect(() => {
    progress.value = isLoading
      ? withTiming(percent, { duration: 300, easing: Easing.linear })
      : 0;
  }, [isLoading, percent, progress]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const label = isLoading
    ? queueTotal > 1
      ? `취소 (${queueIndex}/${queueTotal}) · ${Math.round(percent * 100)}%`
      : `취소 · ${Math.round(percent * 100)}%`
    : batchCount > 1
      ? `${batchCount}장 생성`
      : "생성";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        if (isLoading) {
          requestQueueCancel();
          return;
        }
        onBeforeGenerate();
        void generateImage().then((result) => {
          if (mountedRef.current && result.status === "started") {
            onGenerationStarted();
          }
        });
      }}
      style={({ pressed }) => [
        styles.generateButton,
        pressed && styles.actionPressed,
      ]}
    >
      {isLoading ? (
        <Reanimated.View style={[styles.progressFill, progressStyle]} />
      ) : null}
      <View style={styles.generateButtonContent}>
        <Ionicons
          name={isLoading ? "stop" : "sparkles"}
          size={16}
          color={tokens.color.onAccent}
        />
        <Text style={styles.generateButtonLabel}>{label}</Text>
      </View>
    </Pressable>
  );
}

function ActionIconButton({
  icon,
  label,
  active,
  onPress,
}: {
  icon: "settings-sharp" | "time-outline";
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionIconButton,
        active && styles.actionIconButtonActive,
        pressed && styles.actionPressed,
      ]}
    >
      <Ionicons name={icon} size={20} color={tokens.color.textPrimary} />
    </Pressable>
  );
}

export function GenerationScreen() {
  return (
    <GenerationInputCommitProvider>
      <SuggestionBarProvider>
        <GenerationScreenContent />
      </SuggestionBarProvider>
    </GenerationInputCommitProvider>
  );
}

function GenerationScreenContent() {
  const { topInset, bottomInset, actionBarHeight, promptCollapsedHeight } =
    useGenerationChromeMetrics();
  const router = useRouter();
  const anlasBalance = useGenerationStore((s) => s.anlasBalance);
  const prompt = useGenerationStore((s) => s.prompt);
  const currentGeneration = useGenerationStore((s) => s.currentGeneration);
  const [utilitySheet, setUtilitySheet] = useState<UtilitySheet | null>(null);
  const [utilitySheetVisible, setUtilitySheetVisible] = useState(false);
  const [promptStage, setPromptStage] =
    useState<PromptSheetStage>("collapsed");
  const promptBackProgress = useSharedValue(0);
  const utilityBackProgress = useSharedValue(0);
  const { commitPendingInput } = useGenerationInputCommit();

  const finishInputEditing = useCallback(() => {
    commitPendingInput();
    Keyboard.dismiss();
  }, [commitPendingInput]);

  const closeUtilitySheet = useCallback(() => {
    finishInputEditing();
    setUtilitySheet(null);
  }, [finishInputEditing]);
  const handlePromptStageChange = useCallback(
    (stage: PromptSheetStage) => {
      if (stage === "collapsed") finishInputEditing();
      setPromptStage(stage);
    },
    [finishInputEditing],
  );
  const toggleUtilitySheet = useCallback(
    (nextSheet: UtilitySheet) => {
      finishInputEditing();
      setUtilitySheet((current) =>
        current === nextSheet ? null : nextSheet,
      );
    },
    [finishInputEditing],
  );
  const openMetadataSheet = useCallback(() => {
    toggleUtilitySheet("metadata");
  }, [toggleUtilitySheet]);
  const handleGenerationStarted = useCallback(() => {
    setUtilitySheet(null);
    setPromptStage("collapsed");
  }, []);
  const hasUtilitySheet = utilitySheet !== null || utilitySheetVisible;
  const hasOpenSheet = hasUtilitySheet || promptStage !== "collapsed";
  const handleBack = useCallback(() => {
    if (hasUtilitySheet) {
      finishInputEditing();
      setUtilitySheet(null);
      return;
    }
    if (promptStage === "full") {
      setPromptStage("half");
      return;
    }
    finishInputEditing();
    setPromptStage("collapsed");
  }, [finishInputEditing, hasUtilitySheet, promptStage]);

  const trackPredictiveBack = useCallback(
    (event: PredictiveBackEvent) => {
      if (hasUtilitySheet) {
        cancelAnimation(utilityBackProgress);
        utilityBackProgress.value = event.progress;
        promptBackProgress.value = 0;
        return;
      }

      cancelAnimation(promptBackProgress);
      promptBackProgress.value = event.progress;
      utilityBackProgress.value = 0;
    },
    [hasUtilitySheet, promptBackProgress, utilityBackProgress],
  );
  const cancelPredictiveBack = useCallback(() => {
    promptBackProgress.value = withSpring(0, SHEET_BACK_CANCEL_SPRING);
    utilityBackProgress.value = withSpring(0, SHEET_BACK_CANCEL_SPRING);
  }, [promptBackProgress, utilityBackProgress]);
  const commitPredictiveBack = useCallback(() => {
    // Keep the released scale until the sheet finishes moving.
    handleBack();
  }, [handleBack]);

  usePredictiveBackHandler(hasOpenSheet, {
    onStart: trackPredictiveBack,
    onProgress: trackPredictiveBack,
    onCancel: cancelPredictiveBack,
    onCommit: commitPredictiveBack,
  });

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (!hasOpenSheet) return false;
        handleBack();
        return true;
      },
    );
    return () => subscription.remove();
  }, [handleBack, hasOpenSheet]);

  return (
    <View
      testID="generation-screen"
      style={[
        styles.screen,
        { paddingTop: topInset + 12, paddingBottom: promptCollapsedHeight },
      ]}
    >
      <StatusBar style="light" />

      <View
        pointerEvents="box-none"
        style={[styles.topActions, { top: topInset + 8 }]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="ANLAS 토큰 설정"
          onPress={() => router.navigate("/settings")}
          style={({ pressed }) => [
            styles.balancePill,
            pressed && styles.balancePillPressed,
          ]}
        >
          <Ionicons
            name="diamond-outline"
            size={15}
            color={tokens.color.accent}
          />
          <Text style={styles.balanceText}>
            {anlasBalance ? anlasBalance.total.toLocaleString() : "—"}
          </Text>
        </Pressable>

        <IconButton
          icon="ellipsis-horizontal"
          label="더 보기"
          size={40}
          onPress={() => router.navigate("/settings")}
          style={styles.moreButton}
        />
      </View>

      <View style={styles.topActionsSpacer} />
      <GenerationCanvas onOpenMetadata={openMetadataSheet} />

      <PromptSheetHost
        promptPreview={prompt}
        promptStage={promptStage}
        predictiveBackProgress={promptBackProgress}
        onPromptStageChange={handlePromptStageChange}
      />

      <UtilitySheetHost
        sheet={utilitySheet}
        predictiveBackProgress={utilityBackProgress}
        onClose={closeUtilitySheet}
        onVisibilityChange={setUtilitySheetVisible}
        generation={currentGeneration}
      />

      <View
        testID="generation-action-bar"
        style={[
          styles.actionBar,
          { height: actionBarHeight, paddingBottom: bottomInset },
        ]}
      >
        <ActionIconButton
          icon="settings-sharp"
          label={
            utilitySheet === "settings" ? "Settings 닫기" : "Settings 열기"
          }
          active={utilitySheet === "settings"}
          onPress={() => toggleUtilitySheet("settings")}
        />
        <GenerateAction
          onBeforeGenerate={finishInputEditing}
          onGenerationStarted={handleGenerationStarted}
        />
        <ActionIconButton
          icon="time-outline"
          label={
            utilitySheet === "history" ? "History 닫기" : "History 열기"
          }
          active={utilitySheet === "history"}
          onPress={() => toggleUtilitySheet("history")}
        />
      </View>

      <KeyboardStickyView
        style={styles.suggestionSticky}
        offset={{ closed: 0, opened: 0 }}
      >
        <SuggestionBar />
      </KeyboardStickyView>

      <View pointerEvents="box-none" style={styles.selectPortalLayer}>
        <PortalHost name={SHEET_SELECT_PORTAL_HOST} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: tokens.space[8],
    backgroundColor: tokens.color.app,
    gap: tokens.space[5],
  },
  topActions: {
    position: "absolute",
    left: tokens.space[8],
    right: tokens.space[8],
    zIndex: 3,
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  topActionsSpacer: {
    height: 40,
  },
  balancePill: {
    height: 40,
    paddingHorizontal: tokens.space[7],
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space[4],
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.card,
    ...tokens.shadow.floatMd,
  },
  balanceText: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type.sm,
  },
  balancePillPressed: {
    opacity: 0.68,
  },
  moreButton: {
    borderWidth: 0,
    backgroundColor: tokens.color.card,
  },
  actionBar: {
    position: "absolute",
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 90,
    elevation: 90,
    paddingTop: 12,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.color.borderSubtle,
    backgroundColor: tokens.color.cardAlt,
  },
  actionIconButton: {
    width: 48,
    height: 48,
    borderWidth: 2,
    borderColor: "transparent",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.raised,
  },
  actionIconButtonActive: {
    borderColor: tokens.color.accent,
  },
  generateButton: {
    flex: 1,
    height: 48,
    overflow: "hidden",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.accent,
  },
  generateButtonContent: {
    zIndex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  generateButtonLabel: {
    color: tokens.color.onAccent,
    fontFamily: tokens.font.bold,
    fontSize: 16,
    letterSpacing: -0.2,
  },
  actionPressed: {
    opacity: 0.65,
  },
  progressFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: tokens.color.accentActive,
  },
  suggestionSticky: {
    position: "absolute",
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 110,
    elevation: 110,
  },
});
