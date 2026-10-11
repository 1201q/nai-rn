import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type EffectCallback,
} from "react";
import {
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import BottomSheet, {
  BottomSheetView,
  useBottomSheetGestureHandlers,
  useBottomSheetTimingConfigs,
} from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { KeyboardEvents } from "react-native-keyboard-controller";
import Reanimated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { PromptChunksSheetContent } from "../../../components/generation/PromptChunksSheetContent";
import { PromptSheetContent } from "../../../components/generation/PromptSheetContent";
import { ReferenceImagesSheetContent } from "../../../components/generation/ReferenceImagesSheetContent";
import { useGenerationInputCommit } from "../../../context/GenerationInputCommitContext";
import {
  GENERATION_SHEET_HEADER_HEIGHT,
  useGenerationChromeMetrics,
} from "../../../hooks/useGenerationChromeMetrics";
import { useGenerationStore } from "../../../store/generationStore";
import { tokens } from "../../../styles/tokens";
import {
  FixedSheetBackdrop,
  PredictiveBackSheetLayer,
  PressableSurface,
} from "./SheetLayers";
import { SHEET_EASING, sheetChromeStyles } from "./sheetChrome";
import { useHorizontalPager } from "./useHorizontalPager";

export type PromptSheetStage = "collapsed" | "half" | "full";

type PromptTab = "prompt" | "reference" | "chunks";

const PROMPT_HALF_TOP = 400;
const PROMPT_BACKDROP_Z_INDEX = 70;
const PROMPT_SHEET_Z_INDEX = 80;

const PROMPT_TABS: ReadonlyArray<{ key: PromptTab; label: string }> = [
  { key: "prompt", label: "Prompt" },
  { key: "reference", label: "Reference Images" },
  { key: "chunks", label: "Chunks" },
];

function PromptHeader({
  preview,
  stage,
  animatedIndex,
  tab,
  counts,
  onTabChange,
  onExpand,
  onCollapse,
}: {
  preview: string;
  stage: PromptSheetStage;
  animatedIndex: SharedValue<number>;
  tab: PromptTab;
  counts: Record<PromptTab, number>;
  onTabChange: (tab: PromptTab) => void;
  onExpand: () => void;
  onCollapse: () => void;
}) {
  const previewStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      animatedIndex.value,
      [0, 0.55, 1],
      [1, 0.2, 0],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateY: interpolate(
          animatedIndex.value,
          [0, 1],
          [0, -5],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));
  const tabsStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      animatedIndex.value,
      [0, 0.45, 1],
      [0, 0.8, 1],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateY: interpolate(
          animatedIndex.value,
          [0, 1],
          [5, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));
  const collapsed = stage === "collapsed";
  const { handlePanGestureHandler } = useBottomSheetGestureHandlers();
  // 콘텐츠 드래그를 끈 대신 헤더를 핸들처럼 시트 드래그 영역으로 쓴다.
  const dragGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-10, 10])
        .failOffsetX([-18, 18])
        .shouldCancelWhenOutside(false)
        .onStart(handlePanGestureHandler.handleOnStart)
        .onChange(handlePanGestureHandler.handleOnChange)
        .onEnd(handlePanGestureHandler.handleOnEnd)
        .onFinalize(handlePanGestureHandler.handleOnFinalize),
    [handlePanGestureHandler],
  );

  return (
    <GestureDetector gesture={dragGesture}>
      <View style={styles.promptHeader}>
        <Reanimated.View
          pointerEvents={collapsed ? "auto" : "none"}
          accessibilityElementsHidden={!collapsed}
          importantForAccessibility={collapsed ? "auto" : "no-hide-descendants"}
          style={[styles.promptHeaderLayer, styles.previewLayer, previewStyle]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Prompt 펼치기"
            onPress={onExpand}
            style={({ pressed }) => [
              styles.promptPreviewButton,
              pressed && styles.pressed,
            ]}
          >
            <Text numberOfLines={1} style={styles.promptPreviewText}>
              {preview.trim() || "Prompt를 입력하세요"}
            </Text>
            <Ionicons
              name="chevron-up"
              size={17}
              color={tokens.color.textSecondary}
            />
          </Pressable>
        </Reanimated.View>

        <Reanimated.View
          pointerEvents={collapsed ? "none" : "auto"}
          accessibilityElementsHidden={collapsed}
          importantForAccessibility={collapsed ? "no-hide-descendants" : "auto"}
          style={[styles.promptHeaderLayer, styles.tabsLayer, tabsStyle]}
        >
          <View style={styles.promptTabs}>
            {PROMPT_TABS.map((item) => {
              const active = item.key === tab;
              return (
                <Pressable
                  key={item.key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  onPress={() => onTabChange(item.key)}
                  style={({ pressed }) => [
                    styles.promptTab,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.promptTabContent}>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.promptTabLabel,
                        active && styles.promptTabLabelActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                    {item.key !== "chunks" && counts[item.key] > 0 ? (
                      <View style={styles.promptTabBadge}>
                        <Text style={styles.promptTabBadgeText}>
                          {counts[item.key]}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <View
                    style={[
                      styles.promptTabIndicator,
                      active && styles.promptTabIndicatorActive,
                    ]}
                  />
                </Pressable>
              );
            })}
          </View>
          <PressableSurface
            accessibilityLabel="Prompt 접기"
            onPress={onCollapse}
            style={styles.promptCloseButton}
          >
            <Ionicons
              name="chevron-down"
              size={20}
              color={tokens.color.textPrimary}
            />
          </PressableSurface>
        </Reanimated.View>
      </View>
    </GestureDetector>
  );
}

export function PromptSheetHost({
  promptPreview,
  promptStage,
  predictiveBackProgress,
  onPromptStageChange,
  onMetadataExtract,
  onEditCharacterPositions,
}: {
  onEditCharacterPositions: (characterId: string | null) => void;
  promptPreview: string;
  promptStage: PromptSheetStage;
  predictiveBackProgress: SharedValue<number>;
  onPromptStageChange: (stage: PromptSheetStage) => void;
  onMetadataExtract?: (metadataJson: string) => void;
}) {
  const sheetRef = useRef<BottomSheet>(null);
  const { commitPendingInput } = useGenerationInputCommit();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const { promptCollapsedHeight, promptFullTop } = useGenerationChromeMetrics();
  const commitBeforePageChange = useCallback(() => {
    commitPendingInput();
    Keyboard.dismiss();
  }, [commitPendingInput]);
  const {
    tab: promptTab,
    changeTab: changePromptTab,
    pageGesture: promptPageGesture,
    pageTrackStyle: promptPageTrackStyle,
  } = useHorizontalPager(PROMPT_TABS, {
    enabled: promptStage !== "collapsed",
    onPageChange: commitBeforePageChange,
  });

  function useStaticPageFocus(effect: EffectCallback) {
    useEffect(() => {
      // Scrollable pages register themselves while the sheet is open.
      if (promptStage === "collapsed") return effect();
    }, [effect, promptStage]);
  }
  const referenceCount = useGenerationStore(
    (state) =>
      (state.i2iSourceImage && state.i2iEnabled ? 1 : 0) +
      state.vibeReferences.filter((reference) => reference.enabled).length +
      state.preciseReferences.filter((reference) => reference.enabled).length,
  );
  const animatedIndex = useSharedValue(0);
  const animationConfigs = useBottomSheetTimingConfigs({
    duration: 300,
    easing: SHEET_EASING,
  });
  const snapPoints = useMemo(
    () => [
      promptCollapsedHeight,
      Math.max(promptCollapsedHeight, windowHeight - PROMPT_HALF_TOP),
      Math.max(promptCollapsedHeight, windowHeight - promptFullTop),
    ],
    [promptCollapsedHeight, promptFullTop, windowHeight],
  );
  // gorhom 콘텐츠 영역은 항상 full 높이라 half에선 아래가 이만큼 화면 밖에 있다.
  const hiddenAtHalf = snapPoints[2] - snapPoints[1];
  const stageIndex =
    promptStage === "collapsed" ? 0 : promptStage === "half" ? 1 : 2;
  // half에 있는 동안 스크롤 콘텐츠가 받는 보정값. 가려진 높이만큼 아래 여백을 더하고,
  // 포커스 시 시트가 full로 올라갈 만큼 키보드 스크롤을 줄인다(키보드 스크롤은
  // 포커스 시점의 input 위치로 계산된다). ScrollView 크기를 줄이는 방식은 Android가
  // 크기 변경 때 포커스된 input을 화면에 맞추려 스크롤해서 쓰지 않는다.
  // 보정은 시트가 full에 닿고 키보드도 다 올라온 뒤에 푼다. 키보드가 움직이는
  // 중에 풀면 남은 프레임이 half 기준 위치로 다시 과하게 스크롤한다.
  // 키보드로 올라간 시트는 onChange가 오지 않아 실제 위치(animatedIndex)로 판단한다.
  const [sheetBelowFull, setSheetBelowFull] = useState(stageIndex !== 2);
  useAnimatedReaction(
    () => animatedIndex.value < 1.99,
    (belowFull, previous) => {
      if (belowFull !== previous) runOnJS(setSheetBelowFull)(belowFull);
    },
  );
  const [keyboardMoving, setKeyboardMoving] = useState(false);
  const [halfInsetPending, setHalfInsetPending] = useState(stageIndex !== 2);
  useEffect(() => {
    const subscriptions = [
      KeyboardEvents.addListener("keyboardWillShow", () =>
        setKeyboardMoving(true),
      ),
      KeyboardEvents.addListener("keyboardDidShow", () =>
        setKeyboardMoving(false),
      ),
    ];
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, []);
  useEffect(() => {
    if (sheetBelowFull) setHalfInsetPending(true);
    else if (!keyboardMoving) setHalfInsetPending(false);
  }, [sheetBelowFull, keyboardMoving]);
  const sheetHiddenHeight = halfInsetPending ? hiddenAtHalf : 0;

  useEffect(() => {
    sheetRef.current?.snapToIndex(stageIndex);
  }, [stageIndex]);

  const handleSheetChange = useCallback(
    (index: number) => {
      if (index === 0) onPromptStageChange("collapsed");
      if (index === 1) onPromptStageChange("half");
      if (index === 2) onPromptStageChange("full");
    },
    [onPromptStageChange],
  );
  const handleSheetAnimate = useCallback(
    (_fromIndex: number, toIndex: number) => {
      // Keep back handling in sync before the opening animation finishes.
      if (toIndex > 0) handleSheetChange(toIndex);
    },
    [handleSheetChange],
  );
  const handleSheetSettled = useCallback(
    (index: number) => {
      handleSheetChange(index);
      predictiveBackProgress.value = withTiming(0, {
        duration: 300,
        easing: SHEET_EASING,
      });
    },
    [handleSheetChange, predictiveBackProgress],
  );
  const expandPrompt = useCallback(() => {
    sheetRef.current?.snapToIndex(1);
  }, []);
  const collapsePrompt = useCallback(() => {
    commitPendingInput();
    Keyboard.dismiss();
    sheetRef.current?.snapToIndex(0);
  }, [commitPendingInput]);
  return (
    <>
      <FixedSheetBackdrop
        animatedIndex={animatedIndex}
        appearsOnIndex={1}
        disappearsOnIndex={0}
        visible={promptStage !== "collapsed"}
        zIndex={PROMPT_BACKDROP_Z_INDEX}
        accessibilityLabel="Prompt 접기"
        onPress={collapsePrompt}
      />
      <PredictiveBackSheetLayer
        scaleEnabled={false}
        progress={predictiveBackProgress}
        zIndex={PROMPT_SHEET_Z_INDEX}
      >
        <BottomSheet
          ref={sheetRef}
          index={stageIndex}
          snapPoints={snapPoints}
          animatedIndex={animatedIndex}
          animationConfigs={animationConfigs}
          animateOnMount={false}
          enableDynamicSizing={false}
          // gorhom은 콘텐츠 드래그가 켜져 있으면 최상단 스냅에서만 내부 스크롤을 풀어준다.
          enableContentPanningGesture={false}
          enableHandlePanningGesture
          enableOverDrag={false}
          enablePanDownToClose={false}
          enableBlurKeyboardOnGesture
          keyboardBehavior="extend"
          keyboardBlurBehavior="restore"
          android_keyboardInputMode="adjustResize"
          activeOffsetY={[-10, 10]}
          failOffsetX={[-18, 18]}
          waitFor={promptPageGesture}
          handleStyle={sheetChromeStyles.handleArea}
          handleIndicatorStyle={sheetChromeStyles.handleIndicator}
          containerStyle={styles.promptSheetContainer}
          backgroundStyle={sheetChromeStyles.sheetBackground}
          onAnimate={handleSheetAnimate}
          onChange={handleSheetSettled}
        >
          <BottomSheetView
            style={sheetChromeStyles.sheetBody}
            focusHook={useStaticPageFocus}
          >
            <PromptHeader
              preview={promptPreview}
              stage={promptStage}
              animatedIndex={animatedIndex}
              tab={promptTab}
              counts={{
                prompt: 0,
                reference: referenceCount,
                chunks: 0,
              }}
              onTabChange={changePromptTab}
              onExpand={expandPrompt}
              onCollapse={collapsePrompt}
            />
            <GestureDetector gesture={promptPageGesture}>
              <View style={styles.promptPagerViewport}>
                <Reanimated.View
                  style={[
                    styles.promptPagerTrack,
                    { width: windowWidth * PROMPT_TABS.length },
                    promptPageTrackStyle,
                  ]}
                >
                  {PROMPT_TABS.map((item) => {
                    const active =
                      promptTab === item.key && promptStage !== "collapsed";
                    return (
                      <View
                        key={item.key}
                        testID={`prompt-page-${item.key}`}
                        accessibilityElementsHidden={!active}
                        importantForAccessibility={
                          active ? "auto" : "no-hide-descendants"
                        }
                        style={[styles.promptPage, { width: windowWidth }]}
                      >
                        {item.key === "prompt" ? (
                          <PromptSheetContent
                            active={active}
                            sheetHiddenHeight={sheetHiddenHeight}
                            onEditCharacterPositions={onEditCharacterPositions}
                          />
                        ) : item.key === "reference" ? (
                          <ReferenceImagesSheetContent
                            active={active}
                            sheetHiddenHeight={sheetHiddenHeight}
                            onMetadataExtract={onMetadataExtract}
                          />
                        ) : (
                          <PromptChunksSheetContent
                            active={active}
                            sheetHiddenHeight={sheetHiddenHeight}
                          />
                        )}
                      </View>
                    );
                  })}
                </Reanimated.View>
              </View>
            </GestureDetector>
          </BottomSheetView>
        </BottomSheet>
      </PredictiveBackSheetLayer>
    </>
  );
}

const styles = StyleSheet.create({
  promptSheetContainer: {
    zIndex: 80,
    elevation: 80,
  },
  promptPagerViewport: {
    flex: 1,
    overflow: "hidden",
  },
  promptPagerTrack: {
    flex: 1,
    flexDirection: "row",
  },
  promptPage: {
    height: "100%",
  },
  promptHeader: {
    height: GENERATION_SHEET_HEADER_HEIGHT,
    position: "relative",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.color.borderSubtle,
  },
  promptHeaderLayer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  previewLayer: {
    zIndex: 2,
  },
  tabsLayer: {
    zIndex: 1,
    paddingLeft: 10,
    paddingRight: 12,
    flexDirection: "row",
    alignItems: "stretch",
  },
  promptPreviewButton: {
    flex: 1,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  promptPreviewText: {
    flex: 1,
    color: tokens.color.textSecondary,
    fontFamily: tokens.font.regular,
    fontSize: 15,
    lineHeight: 20,
  },
  promptTabs: {
    flex: 1,
    flexDirection: "row",
    overflow: "hidden",
  },
  promptTab: {
    minWidth: 0,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  promptTabContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  promptTabLabel: {
    color: tokens.color.textMuted,
    fontFamily: tokens.font.semibold,
    fontSize: 15,
  },
  promptTabLabelActive: {
    color: tokens.color.textPrimary,
  },
  promptTabIndicator: {
    position: "absolute",
    right: 10,
    bottom: 0,
    left: 10,
    height: 2,
    backgroundColor: "transparent",
  },
  promptTabIndicatorActive: {
    backgroundColor: tokens.color.accent,
  },
  promptTabBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.raised,
  },
  promptTabBadgeText: {
    color: tokens.color.textSecondary,
    fontFamily: tokens.font.bold,
    fontSize: 11,
  },
  promptCloseButton: {
    width: 34,
    height: 34,
    alignSelf: "center",
    marginLeft: 4,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.raised,
  },
  pressed: {
    opacity: tokens.opacity.pressed,
  },
});
