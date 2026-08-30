import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import BottomSheet, {
  BottomSheetView,
  useBottomSheetTimingConfigs,
} from "@gorhom/bottom-sheet";
import { Portal } from "@gorhom/portal";
import { Ionicons } from "@expo/vector-icons";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Reanimated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import {
  usePredictiveBackHandler,
  type PredictiveBackEvent,
} from "../../native/predictiveBack";
import { tokens } from "../../styles/tokens";

export type UtilitySheet = "settings" | "history";
export type PromptSheetStage = "collapsed" | "half" | "full";

type PromptTab = "prompt" | "reference" | "chunks";

const PROMPT_COLLAPSED_HEIGHT = 128;
const PROMPT_HALF_TOP = 400;
const PROMPT_FULL_TOP = 70;
const PROMPT_PAGE_SWIPE_THRESHOLD = 0.18;
const PROMPT_PAGE_VELOCITY_THRESHOLD = 650;
const PROMPT_PAGE_ANIMATION_DURATION = 260;
const PREDICTIVE_BACK_SCALE_STOP = 0.6;
const PREDICTIVE_BACK_MIN_SCALE = 0.94;
const PREDICTIVE_BACK_CANCEL_SPRING = {
  damping: 30,
  stiffness: 320,
  mass: 0.75,
};
const PROMPT_BACKDROP_Z_INDEX = 70;
const PROMPT_SHEET_Z_INDEX = 80;
const UTILITY_BACKDROP_Z_INDEX = 82;
const UTILITY_SHEET_Z_INDEX = 85;

const PROMPT_TABS: Array<{ key: PromptTab; label: string }> = [
  { key: "prompt", label: "Prompt" },
  { key: "reference", label: "Reference Images" },
  { key: "chunks", label: "Chunks" },
];

const MODEL_OPTIONS = [
  "V4.5 Full",
  "V4.5 Curated",
  "V4 Curated",
  "Anime V3",
  "Furry V3",
];

function PredictiveBackSheetLayer({
  progress,
  zIndex,
  children,
}: {
  progress: SharedValue<number>;
  zIndex: number;
  children: React.ReactNode;
}) {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(
          progress.value,
          [0, PREDICTIVE_BACK_SCALE_STOP],
          [1, PREDICTIVE_BACK_MIN_SCALE],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  return (
    <Reanimated.View
      pointerEvents="box-none"
      style={[
        styles.predictiveBackSheetLayer,
        { zIndex, elevation: zIndex },
        animatedStyle,
      ]}
    >
      {children}
    </Reanimated.View>
  );
}

function FixedSheetBackdrop({
  animatedIndex,
  appearsOnIndex,
  disappearsOnIndex,
  visible,
  zIndex,
  accessibilityLabel,
  onPress,
}: {
  animatedIndex: SharedValue<number>;
  appearsOnIndex: number;
  disappearsOnIndex: number;
  visible: boolean;
  zIndex: number;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      animatedIndex.value,
      [disappearsOnIndex, appearsOnIndex],
      [0, 0.62],
      Extrapolation.CLAMP,
    ),
  }));

  return (
    <Reanimated.View
      pointerEvents={visible ? "auto" : "none"}
      style={[
        styles.fixedSheetBackdrop,
        { zIndex, elevation: zIndex },
        animatedStyle,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={styles.fixedSheetBackdropPressable}
      />
    </Reanimated.View>
  );
}

function PressableSurface({
  accessibilityLabel,
  onPress,
  style,
  children,
}: {
  accessibilityLabel: string;
  onPress: () => void;
  style: object;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [style, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

function SheetSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const triggerRef = useRef<View>(null);
  const { height: windowHeight } = useWindowDimensions();
  const predictiveBackProgress = useSharedValue(0);

  const closeSelect = useCallback(() => {
    setOpen(false);
  }, []);

  const toggleSelect = useCallback(() => {
    if (open) {
      closeSelect();
      return;
    }

    triggerRef.current?.measureInWindow((x, y, width, height) => {
      cancelAnimation(predictiveBackProgress);
      predictiveBackProgress.value = 0;
      setAnchor({ x, y, width, height });
      setOpen(true);
    });
  }, [closeSelect, open, predictiveBackProgress]);

  const selectOption = useCallback(
    (option: string) => {
      onChange(option);
      closeSelect();
    },
    [closeSelect, onChange],
  );
  const trackPredictiveBack = useCallback(
    (event: PredictiveBackEvent) => {
      cancelAnimation(predictiveBackProgress);
      predictiveBackProgress.value = event.progress;
    },
    [predictiveBackProgress],
  );
  const cancelPredictiveBack = useCallback(() => {
    predictiveBackProgress.value = withSpring(
      0,
      PREDICTIVE_BACK_CANCEL_SPRING,
    );
  }, [predictiveBackProgress]);
  const predictiveOptionsStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(
          predictiveBackProgress.value,
          [0, PREDICTIVE_BACK_SCALE_STOP],
          [1, PREDICTIVE_BACK_MIN_SCALE],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  usePredictiveBackHandler(open, {
    onStart: trackPredictiveBack,
    onProgress: trackPredictiveBack,
    onCancel: cancelPredictiveBack,
    onCommit: closeSelect,
  });

  const optionsHeight = options.length * 44 + 2;
  const optionsTop = anchor
    ? Math.max(
        12,
        Math.min(anchor.y + anchor.height + 8, windowHeight - optionsHeight - 12),
      )
    : 0;

  return (
    <View style={styles.selectField}>
      <Text style={styles.selectLabel}>{label}</Text>
      <Pressable
        ref={triggerRef}
        accessibilityRole="button"
        accessibilityLabel={`${label} 선택`}
        accessibilityState={{ expanded: open }}
        onPress={toggleSelect}
        style={({ pressed }) => [
          styles.selectTrigger,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.selectValue}>{value}</Text>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={18}
          color={tokens.color.textSecondary}
        />
      </Pressable>

      {open && anchor ? (
        <Portal>
          <View style={styles.selectPortal}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${label} 선택 닫기`}
              onPress={closeSelect}
              style={StyleSheet.absoluteFill}
            />
            <Reanimated.View
              style={[
                styles.selectFloatingOptions,
                {
                  top: optionsTop,
                  left: anchor.x,
                  width: anchor.width,
                },
                predictiveOptionsStyle,
              ]}
            >
              {options.map((option) => {
                const selected = option === value;

                return (
                  <Pressable
                    key={option}
                    accessibilityRole="button"
                    accessibilityLabel={option}
                    accessibilityState={{ selected }}
                    onPress={() => selectOption(option)}
                    style={({ pressed }) => [
                      styles.selectOption,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.selectOptionText,
                        selected && styles.selectOptionTextSelected,
                      ]}
                    >
                      {option}
                    </Text>
                    {selected ? (
                      <Ionicons
                        name="checkmark"
                        size={18}
                        color={tokens.color.accent}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </Reanimated.View>
          </View>
        </Portal>
      ) : null}
    </View>
  );
}

function UtilitySheetContent({
  sheet,
  onClose,
}: {
  sheet: UtilitySheet;
  onClose: () => void;
}) {
  const title = sheet === "settings" ? "Settings" : "History";
  const [model, setModel] = useState(MODEL_OPTIONS[0]);

  return (
    <BottomSheetView style={styles.sheetBody}>
      <View style={styles.utilityHeader}>
        <Text style={styles.utilityTitle}>{title}</Text>
        <PressableSurface
          accessibilityLabel={`${title} 닫기`}
          onPress={onClose}
          style={styles.closeButton}
        >
          <Ionicons name="close" size={21} color={tokens.color.textPrimary} />
        </PressableSurface>
      </View>
      <View style={styles.divider} />
      <View style={styles.utilityBody}>
        {sheet === "settings" ? (
          <SheetSelect
            label="Model"
            value={model}
            options={MODEL_OPTIONS}
            onChange={setModel}
          />
        ) : null}
      </View>
    </BottomSheetView>
  );
}

function PromptHeader({
  preview,
  stage,
  animatedIndex,
  tab,
  onTabChange,
  onExpand,
  onCollapse,
}: {
  preview: string;
  stage: PromptSheetStage;
  animatedIndex: SharedValue<number>;
  tab: PromptTab;
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

  return (
    <View style={styles.promptHeader}>
      <Reanimated.View
        pointerEvents={collapsed ? "auto" : "none"}
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
                <Text
                  numberOfLines={1}
                  style={[
                    styles.promptTabLabel,
                    active && styles.promptTabLabelActive,
                  ]}
                >
                  {item.label}
                </Text>
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
            size={19}
            color={tokens.color.textPrimary}
          />
        </PressableSurface>
      </Reanimated.View>
    </View>
  );
}

export function PromptSheetHost({
  promptPreview,
  promptStage,
  predictiveBackProgress,
  onPromptStageChange,
}: {
  promptPreview: string;
  promptStage: PromptSheetStage;
  predictiveBackProgress: SharedValue<number>;
  onPromptStageChange: (stage: PromptSheetStage) => void;
}) {
  const sheetRef = useRef<BottomSheet>(null);
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const [promptTab, setPromptTab] = useState<PromptTab>("prompt");
  const animatedIndex = useSharedValue(0);
  const promptPageIndex = useSharedValue(0);
  const promptPageTranslateX = useSharedValue(0);
  const promptPageDragStartX = useSharedValue(0);
  const animationConfigs = useBottomSheetTimingConfigs({
    duration: 300,
    easing: Easing.bezier(0.32, 0.72, 0, 1),
  });
  const snapPoints = useMemo(
    () => [
      PROMPT_COLLAPSED_HEIGHT,
      Math.max(PROMPT_COLLAPSED_HEIGHT, windowHeight - PROMPT_HALF_TOP),
      Math.max(PROMPT_COLLAPSED_HEIGHT, windowHeight - PROMPT_FULL_TOP),
    ],
    [windowHeight],
  );
  const stageIndex =
    promptStage === "collapsed" ? 0 : promptStage === "half" ? 1 : 2;

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
  const expandPrompt = useCallback(() => {
    sheetRef.current?.snapToIndex(1);
  }, []);
  const collapsePrompt = useCallback(() => {
    sheetRef.current?.snapToIndex(0);
  }, []);
  const selectPromptPage = useCallback((index: number) => {
    const nextTab = PROMPT_TABS[index]?.key;
    if (nextTab) setPromptTab(nextTab);
  }, []);
  const changePromptTab = useCallback(
    (tab: PromptTab) => {
      const nextIndex = PROMPT_TABS.findIndex((item) => item.key === tab);
      if (nextIndex < 0) return;

      setPromptTab(tab);
      promptPageIndex.value = nextIndex;
      promptPageTranslateX.value = withTiming(-nextIndex * windowWidth, {
        duration: PROMPT_PAGE_ANIMATION_DURATION,
        easing: Easing.bezier(0.32, 0.72, 0, 1),
      });
    },
    [promptPageIndex, promptPageTranslateX, windowWidth],
  );
  const promptPageGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(promptStage !== "collapsed")
        .activeOffsetX([-18, 18])
        .failOffsetY([-10, 10])
        .shouldCancelWhenOutside(false)
        .onStart(() => {
          cancelAnimation(promptPageTranslateX);
          promptPageDragStartX.value = promptPageTranslateX.value;
        })
        .onUpdate((event) => {
          const minimumTranslateX = -windowWidth * (PROMPT_TABS.length - 1);
          const nextTranslateX = promptPageDragStartX.value + event.translationX;

          if (nextTranslateX > 0) {
            promptPageTranslateX.value = nextTranslateX * 0.2;
          } else if (nextTranslateX < minimumTranslateX) {
            promptPageTranslateX.value =
              minimumTranslateX + (nextTranslateX - minimumTranslateX) * 0.2;
          } else {
            promptPageTranslateX.value = nextTranslateX;
          }
        })
        .onEnd((event) => {
          const currentIndex = promptPageIndex.value;
          const movedToNext =
            event.translationX < -windowWidth * PROMPT_PAGE_SWIPE_THRESHOLD ||
            event.velocityX < -PROMPT_PAGE_VELOCITY_THRESHOLD;
          const movedToPrevious =
            event.translationX > windowWidth * PROMPT_PAGE_SWIPE_THRESHOLD ||
            event.velocityX > PROMPT_PAGE_VELOCITY_THRESHOLD;
          const nextIndex = Math.min(
            PROMPT_TABS.length - 1,
            Math.max(
              0,
              currentIndex + (movedToNext ? 1 : movedToPrevious ? -1 : 0),
            ),
          );

          promptPageIndex.value = nextIndex;
          promptPageTranslateX.value = withTiming(-nextIndex * windowWidth, {
            duration: PROMPT_PAGE_ANIMATION_DURATION,
            easing: Easing.bezier(0.32, 0.72, 0, 1),
          });
          runOnJS(selectPromptPage)(nextIndex);
        })
        .onFinalize((_event, success) => {
          if (success) return;
          promptPageTranslateX.value = withTiming(
            -promptPageIndex.value * windowWidth,
            {
              duration: PROMPT_PAGE_ANIMATION_DURATION,
              easing: Easing.bezier(0.32, 0.72, 0, 1),
            },
          );
        }),
    [
      promptPageDragStartX,
      promptPageIndex,
      promptPageTranslateX,
      promptStage,
      selectPromptPage,
      windowWidth,
    ],
  );
  const promptPageTrackStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: promptPageTranslateX.value }],
  }));

  useEffect(() => {
    promptPageTranslateX.value = -promptPageIndex.value * windowWidth;
  }, [promptPageIndex, promptPageTranslateX, windowWidth]);

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
          enableContentPanningGesture
          enableHandlePanningGesture
          enableOverDrag={false}
          enablePanDownToClose={false}
          activeOffsetY={[-10, 10]}
          failOffsetX={[-18, 18]}
          waitFor={promptPageGesture}
          handleStyle={styles.handleArea}
          handleIndicatorStyle={styles.handleIndicator}
          containerStyle={styles.promptSheetContainer}
          backgroundStyle={styles.sheetBackground}
          onChange={handleSheetChange}
        >
          <BottomSheetView style={styles.sheetBody}>
            <PromptHeader
              preview={promptPreview}
              stage={promptStage}
              animatedIndex={animatedIndex}
              tab={promptTab}
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
                  {PROMPT_TABS.map((item) => (
                    <View
                      key={item.key}
                      style={[styles.promptPage, { width: windowWidth }]}
                    />
                  ))}
                </Reanimated.View>
              </View>
            </GestureDetector>
          </BottomSheetView>
        </BottomSheet>
      </PredictiveBackSheetLayer>
    </>
  );
}

export function UtilitySheetHost({
  sheet,
  predictiveBackProgress,
  onClose,
}: {
  sheet: UtilitySheet | null;
  predictiveBackProgress: SharedValue<number>;
  onClose: () => void;
}) {
  const sheetRef = useRef<BottomSheet>(null);
  const animatedIndex = useSharedValue(-1);
  const [renderedSheet, setRenderedSheet] =
    useState<UtilitySheet | null>(sheet);
  const { height: windowHeight } = useWindowDimensions();
  const snapPoints = useMemo(
    () => [Math.max(1, windowHeight - 56)],
    [windowHeight],
  );
  const animationConfigs = useBottomSheetTimingConfigs({
    duration: 300,
    easing: Easing.bezier(0.32, 0.72, 0, 1),
  });
  const handleSheetClosed = useCallback(() => {
    setRenderedSheet(null);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (sheet === null) {
      if (renderedSheet !== null) sheetRef.current?.close();
      return;
    }

    if (sheet !== renderedSheet) setRenderedSheet(sheet);
  }, [renderedSheet, sheet]);

  if (renderedSheet === null) return null;

  return (
    <>
      <FixedSheetBackdrop
        animatedIndex={animatedIndex}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        visible
        zIndex={UTILITY_BACKDROP_Z_INDEX}
        accessibilityLabel={`${renderedSheet === "settings" ? "Settings" : "History"} 닫기`}
        onPress={onClose}
      />
      <PredictiveBackSheetLayer
        progress={predictiveBackProgress}
        zIndex={UTILITY_SHEET_Z_INDEX}
      >
        <BottomSheet
          key={renderedSheet}
          ref={sheetRef}
          index={0}
          snapPoints={snapPoints}
          animatedIndex={animatedIndex}
          animationConfigs={animationConfigs}
          animateOnMount
          enableDynamicSizing={false}
          enableContentPanningGesture
          enableHandlePanningGesture
          enableOverDrag={false}
          enablePanDownToClose
          handleStyle={styles.handleArea}
          handleIndicatorStyle={styles.handleIndicator}
          containerStyle={styles.utilitySheetContainer}
          backgroundStyle={styles.sheetBackground}
          onClose={handleSheetClosed}
        >
          <UtilitySheetContent sheet={renderedSheet} onClose={onClose} />
        </BottomSheet>
      </PredictiveBackSheetLayer>
    </>
  );
}

const styles = StyleSheet.create({
  fixedSheetBackdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "#0A0A0C",
  },
  fixedSheetBackdropPressable: {
    flex: 1,
  },
  predictiveBackSheetLayer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    transformOrigin: "center bottom",
  },
  promptSheetContainer: {
    zIndex: 80,
    elevation: 80,
  },
  utilitySheetContainer: {
    zIndex: 85,
    elevation: 85,
  },
  sheetBackground: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: tokens.color.cardAlt,
    shadowColor: "#000000",
    shadowOpacity: 0.55,
    shadowRadius: 44,
    shadowOffset: { width: 0, height: -18 },
  },
  handleArea: {
    height: 17,
    paddingTop: 9,
    paddingBottom: 3,
  },
  handleIndicator: {
    width: 38,
    height: 5,
    borderRadius: 3,
    backgroundColor: tokens.color.borderSubtleStrong,
  },
  sheetBody: {
    flex: 1,
    bottom: 0,
  },
  utilityBody: {
    flex: 1,
    paddingTop: 18,
    paddingHorizontal: 16,
    paddingBottom: 116,
  },
  selectField: {
    gap: 10,
  },
  selectLabel: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: 15,
  },
  selectTrigger: {
    height: 46,
    paddingHorizontal: 14,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: tokens.color.raised,
  },
  selectValue: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: 15,
  },
  selectPortal: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 100,
    elevation: 100,
  },
  selectFloatingOptions: {
    position: "absolute",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: tokens.color.borderSubtleStrong,
    borderRadius: 14,
    backgroundColor: tokens.color.sunken,
    transformOrigin: "center center",
    ...tokens.shadow.floatMd,
  },
  selectOption: {
    height: 44,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectOptionText: {
    color: tokens.color.textSecondary,
    fontFamily: tokens.font.medium,
    fontSize: 15,
  },
  selectOptionTextSelected: {
    color: tokens.color.accent,
    fontFamily: tokens.font.semibold,
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
  utilityHeader: {
    height: 52,
    paddingLeft: 20,
    paddingRight: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  utilityTitle: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.bold,
    fontSize: 23,
    letterSpacing: -0.3,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.raised,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: tokens.color.borderSubtle,
  },
  promptHeader: {
    height: 39,
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
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "stretch",
  },
  promptPreviewButton: {
    height: 39,
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
    paddingHorizontal: 9,
    justifyContent: "center",
  },
  promptTabLabel: {
    color: tokens.color.textMuted,
    fontFamily: tokens.font.semibold,
    fontSize: 13,
  },
  promptTabLabelActive: {
    color: tokens.color.textPrimary,
  },
  promptTabIndicator: {
    position: "absolute",
    right: 9,
    bottom: 0,
    left: 9,
    height: 2,
    backgroundColor: "transparent",
  },
  promptTabIndicatorActive: {
    backgroundColor: tokens.color.accent,
  },
  promptCloseButton: {
    width: 34,
    height: 34,
    marginTop: 2,
    marginLeft: 4,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.raised,
  },
  pressed: {
    opacity: 0.65,
  },
});
