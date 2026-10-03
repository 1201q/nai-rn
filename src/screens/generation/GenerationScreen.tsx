import { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, Pressable, StyleSheet, Text, View } from "react-native";
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
import { RollingNumber } from "../../components/common/RollingNumber";
import { SHEET_SELECT_PORTAL_HOST } from "../../components/forms/SheetSelect";
import { OpusUsageRing } from "../../components/generation/OpusUsageRing";
import { SuggestionBar } from "../../components/generation/SuggestionBar";
import { SuggestionBarProvider } from "../../context/SuggestionBarContext";
import {
  GenerationInputCommitProvider,
  useGenerationInputCommit,
} from "../../context/GenerationInputCommitContext";
import { getModelCapabilities } from "../../constants/models";
import { useGenerationChromeMetrics } from "../../hooks/useGenerationChromeMetrics";
import type { PredictiveBackEvent } from "../../native/predictiveBack";
import { PREDICTIVE_BACK_CANCEL_SPRING } from "../../native/predictiveBackStyle";
import { useBackHandler } from "../../native/useBackHandler";
import {
  selectAnlasCost,
  selectOverallPercent,
  useGenerationStore,
} from "../../store/generationStore";
import { tokens } from "../../styles/tokens";
import { CharacterPositionEditor } from "./CharacterPositionEditor";
import { GenerationCanvas } from "./GenerationCanvas";
import {
  PromptSheetHost,
  UtilitySheetHost,
  type PromptSheetStage,
  type UtilitySheet,
} from "./GenerationSheetScaffold";

// 사용량 배지(40) + Anlas 표시와의 간격
const USAGE_BADGE_SLIDE_DISTANCE = 40 + tokens.space[4];

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
  const anlasCost = useGenerationStore(selectAnlasCost);
  const anlasBalanceTotal = useGenerationStore(
    (s) => s.anlasBalance?.total ?? null,
  );
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
  // 무료이거나 구독 정보를 모르면 표시하지 않는다.
  const showCost = !isLoading && anlasCost !== null && anlasCost > 0;
  const insufficient =
    showCost && anlasBalanceTotal !== null && anlasBalanceTotal < anlasCost;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={showCost ? `예상 ${anlasCost} Anlas 소모` : undefined}
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
      {showCost ? (
        <View
          testID="generation-anlas-cost"
          style={[
            styles.costBadge,
            insufficient && styles.costBadgeInsufficient,
          ]}
        >
          <Ionicons
            name="diamond-outline"
            size={11}
            color={insufficient ? tokens.color.negative : tokens.color.onAccent}
          />
          <Text
            style={[
              styles.costBadgeText,
              insufficient && styles.costBadgeTextInsufficient,
            ]}
          >
            {anlasCost.toLocaleString()}
          </Text>
        </View>
      ) : null}
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
  // Opus 사용량 한도는 V5 생성에만 적용된다.
  const isV5 = useGenerationStore(
    (s) => getModelCapabilities(s.model).v5Request,
  );
  const prompt = useGenerationStore((s) => s.prompt);
  const currentGeneration = useGenerationStore((s) => s.currentGeneration);
  const [utilitySheet, setUtilitySheet] = useState<UtilitySheet | null>(null);
  const [extractedMetadata, setExtractedMetadata] = useState<{
    metadataJson: string;
  } | null>(null);
  const [utilitySheetVisible, setUtilitySheetVisible] = useState(false);
  const [promptStage, setPromptStage] = useState<PromptSheetStage>("collapsed");
  const [positionEditing, setPositionEditing] = useState<{
    characterId: string | null;
  } | null>(null);
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
      else setPositionEditing(null);
      setPromptStage(stage);
    },
    [finishInputEditing],
  );
  const closePositionEditor = useCallback(() => setPositionEditing(null), []);
  const openPositionEditor = useCallback(
    (characterId: string | null) => {
      finishInputEditing();
      setUtilitySheet(null);
      setPromptStage("collapsed");
      setPositionEditing({ characterId });
    },
    [finishInputEditing],
  );
  const toggleUtilitySheet = useCallback(
    (nextSheet: UtilitySheet) => {
      finishInputEditing();
      setPositionEditing(null);
      setUtilitySheet((current) => (current === nextSheet ? null : nextSheet));
    },
    [finishInputEditing],
  );
  const openMetadataSheet = useCallback(() => {
    setExtractedMetadata(null);
    toggleUtilitySheet("metadata");
  }, [toggleUtilitySheet]);
  const handleMetadataExtract = useCallback(
    (metadataJson: string) => {
      finishInputEditing();
      setPositionEditing(null);
      setExtractedMetadata({ metadataJson });
      setUtilitySheet("metadata");
    },
    [finishInputEditing],
  );
  const handleGenerationStarted = useCallback(() => {
    // 위치 편집기는 캔버스를 가리므로 설정과 무관하게 닫는다.
    setPositionEditing(null);
    if (!useGenerationStore.getState().closeSheetsOnGenerate) return;
    setUtilitySheet(null);
    setPromptStage("collapsed");
  }, []);
  const hasUtilitySheet = utilitySheet !== null || utilitySheetVisible;
  const hasOpenSheet = hasUtilitySheet || promptStage !== "collapsed";
  const isPositionEditing = positionEditing !== null;
  const handleBack = useCallback(() => {
    if (isPositionEditing) {
      setPositionEditing(null);
      return;
    }
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
  }, [finishInputEditing, hasUtilitySheet, isPositionEditing, promptStage]);

  const trackPredictiveBack = useCallback(
    (event: PredictiveBackEvent) => {
      // The position editor has no sheet to scale.
      if (isPositionEditing) return;
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
    [
      hasUtilitySheet,
      isPositionEditing,
      promptBackProgress,
      utilityBackProgress,
    ],
  );
  const cancelPredictiveBack = useCallback(() => {
    promptBackProgress.value = withSpring(0, PREDICTIVE_BACK_CANCEL_SPRING);
    utilityBackProgress.value = withSpring(0, PREDICTIVE_BACK_CANCEL_SPRING);
  }, [promptBackProgress, utilityBackProgress]);
  const commitPredictiveBack = useCallback(() => {
    // Keep the released scale until the sheet finishes moving.
    handleBack();
  }, [handleBack]);

  useBackHandler(hasOpenSheet || isPositionEditing, {
    onBack: commitPredictiveBack,
    onStart: trackPredictiveBack,
    onProgress: trackPredictiveBack,
    onCancel: cancelPredictiveBack,
  });

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
        <View style={styles.balanceGroup}>
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
            {anlasBalance ? (
              <RollingNumber
                value={anlasBalance.total}
                style={styles.balanceText}
                lineHeight={20}
              />
            ) : (
              <Text style={styles.balanceText}>—</Text>
            )}
          </Pressable>
          {anlasBalance?.usagePercent !== undefined ? (
            <OpusUsageRing
              percent={anlasBalance.usagePercent}
              exhausted={anlasBalance.usageNegative === true}
              nextPercentAt={anlasBalance.usageNextPercentAt}
              visible={isV5}
              slideDistance={USAGE_BADGE_SLIDE_DISTANCE}
            />
          ) : null}
        </View>

        <IconButton
          icon="ellipsis-horizontal"
          label="더 보기"
          size={40}
          onPress={() => router.navigate("/settings")}
          style={styles.moreButton}
        />
      </View>

      <View style={styles.topActionsSpacer} />
      {/* Keep the canvas mounted so its preview and zoom state survive. */}
      <View style={positionEditing ? styles.hidden : styles.canvasSlot}>
        <GenerationCanvas onOpenMetadata={openMetadataSheet} />
      </View>
      {positionEditing ? (
        <CharacterPositionEditor
          initialCharacterId={positionEditing.characterId}
          onFinish={closePositionEditor}
        />
      ) : null}

      <PromptSheetHost
        onEditCharacterPositions={openPositionEditor}
        promptPreview={prompt}
        promptStage={promptStage}
        predictiveBackProgress={promptBackProgress}
        onPromptStageChange={handlePromptStageChange}
        onMetadataExtract={handleMetadataExtract}
      />

      <UtilitySheetHost
        sheet={utilitySheet}
        predictiveBackProgress={utilityBackProgress}
        onClose={closeUtilitySheet}
        onVisibilityChange={setUtilitySheetVisible}
        generation={extractedMetadata ?? currentGeneration}
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
          label={utilitySheet === "history" ? "History 닫기" : "History 열기"}
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
  canvasSlot: {
    flex: 1,
    minHeight: 0,
  },
  hidden: {
    display: "none",
  },
  balanceGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space[4],
  },
  balancePill: {
    // 사용량 배지가 숨을 때 이 표시 뒤로 들어간다.
    zIndex: 1,
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
    opacity: tokens.opacity.pressed,
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
  costBadge: {
    position: "absolute",
    right: 10,
    zIndex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: "rgba(23,19,10,0.14)",
  },
  costBadgeInsufficient: {
    backgroundColor: tokens.color.onAccent,
  },
  costBadgeText: {
    color: tokens.color.onAccent,
    fontFamily: tokens.font.bold,
    fontSize: 12,
  },
  costBadgeTextInsufficient: {
    color: tokens.color.negative,
  },
  actionPressed: {
    opacity: tokens.opacity.pressed,
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
