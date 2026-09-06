import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import BottomSheet, {
  type BottomSheetFooterProps,
  type BottomSheetHandleProps,
  BottomSheetView,
  useBottomSheetTimingConfigs,
} from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import {
  cancelAnimation,
  Easing,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";

import {
  HistorySheetContent,
  HistorySheetFooter,
  HistorySheetHandle,
  type HistorySheetController,
  useHistorySheetController,
} from "../../../components/generation/HistorySheetContent";
import type { GenerationRecord } from "../../../lib/generationHistory";
import {
  GENERATION_SHEET_HEADER_HEIGHT,
  useGenerationChromeMetrics,
} from "../../../hooks/useGenerationChromeMetrics";
import { usePredictiveBackHandler } from "../../../native/predictiveBack";
import { tokens } from "../../../styles/tokens";
import {
  FixedSheetBackdrop,
  PredictiveBackSheetLayer,
  PressableSurface,
} from "./SheetLayers";
import {
  MetadataSheetPager,
  type MetadataSheetPagerController,
  useMetadataSheetPagerController,
} from "./metadata/MetadataSheetPager";
import { SettingsSheetContent } from "./settings/SettingsSheetContent";

export type UtilitySheet = "settings" | "history" | "metadata";

const UTILITY_BACKDROP_Z_INDEX = 82;
const UTILITY_SHEET_Z_INDEX = 85;

const UtilitySheetContent = memo(function UtilitySheetContent({
  sheet,
  active,
  onClose,
  historyController,
  generation,
  metadataPagerController,
}: {
  sheet: UtilitySheet;
  active: boolean;
  onClose: () => void;
  historyController: HistorySheetController;
  generation: GenerationRecord | null;
  metadataPagerController: MetadataSheetPagerController;
}) {
  if (sheet === "history") {
    return <HistorySheetContent controller={historyController} />;
  }

  if (sheet === "metadata") {
    return generation ? (
      <BottomSheetView style={styles.sheetBody}>
        <MetadataSheetPager
          generation={generation}
          onClose={onClose}
          controller={metadataPagerController}
        />
      </BottomSheetView>
    ) : null;
  }

  const title = "Settings";

  return (
    <BottomSheetView
      style={styles.sheetBody}
      pointerEvents={active ? "auto" : "none"}
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? "auto" : "no-hide-descendants"}
    >
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
      <SettingsSheetContent active={active} />
    </BottomSheetView>
  );
});

export function UtilitySheetHost({
  sheet,
  predictiveBackProgress,
  onClose,
  onVisibilityChange,
  generation = null,
}: {
  sheet: UtilitySheet | null;
  predictiveBackProgress: SharedValue<number>;
  onClose: () => void;
  onVisibilityChange?: (visible: boolean) => void;
  generation?: GenerationRecord | null;
}) {
  const sheetRef = useRef<BottomSheet>(null);
  const animatedIndex = useSharedValue(-1);
  const [transition, setTransition] = useState(() => ({
    sheet,
    content: sheet,
    retainSettings: sheet === "settings",
  }));
  if (transition.sheet !== sheet) {
    // Retain closing content without waiting for a second React commit to open.
    setTransition({
      sheet,
      content: sheet ?? transition.content,
      retainSettings: sheet === null ? transition.retainSettings : sheet === "settings",
    });
  }
  const latestTransition = useRef(transition);
  latestTransition.current = transition;
  const renderedSheet = sheet ?? transition.content;
  const visible = renderedSheet !== null;
  // Cached Settings must not keep the backdrop or back handler active.
  const contentSheet = renderedSheet ?? (transition.retainSettings ? "settings" : null);
  const historyController = useHistorySheetController({ onClose });
  const metadataPagerController = useMetadataSheetPagerController();
  const { height: windowHeight } = useWindowDimensions();
  const { utilitySheetTop } = useGenerationChromeMetrics();
  const snapPoints = useMemo(
    () => [Math.max(1, windowHeight - utilitySheetTop)],
    [utilitySheetTop, windowHeight],
  );
  const animationConfigs = useBottomSheetTimingConfigs({
    duration: 300,
    easing: Easing.bezier(0.32, 0.72, 0, 1),
  });
  const handleSheetClosed = useCallback(() => {
    // Native completion callbacks can arrive after a new open/close request.
    if (latestTransition.current !== transition) return;
    cancelAnimation(predictiveBackProgress);
    predictiveBackProgress.value = 0;
    setTransition((current) =>
      current.content === null ? current : { ...current, content: null },
    );
    if (transition.sheet !== null) onClose();
  }, [onClose, predictiveBackProgress, transition]);
  const handleSheetChanged = useCallback((index: number) => {
    // Reconcile a reversal that arrived before the native animation moved.
    const latest = latestTransition.current;
    if (index === 0 && latest.sheet === null) sheetRef.current?.close();
    if (index === -1 && latest.sheet !== null && latest !== transition) {
      sheetRef.current?.snapToIndex(0);
    }
  }, [transition]);
  const renderHistoryFooter = useCallback(
    (props: BottomSheetFooterProps) => (
      <HistorySheetFooter {...props} controller={historyController} />
    ),
    [historyController],
  );
  const renderHistoryHandle = useCallback(
    (_props: BottomSheetHandleProps) => (
      <HistorySheetHandle controller={historyController} />
    ),
    [historyController],
  );
  const historySelectionBackActive =
    renderedSheet === "history" && historyController.selectionMode;

  usePredictiveBackHandler(historySelectionBackActive, {
    onStart: () => {
      cancelAnimation(predictiveBackProgress);
      predictiveBackProgress.value = 0;
    },
    onProgress: () => {
      predictiveBackProgress.value = 0;
    },
    onCancel: () => {
      predictiveBackProgress.value = 0;
    },
    onCommit: () => {
      predictiveBackProgress.value = 0;
      historyController.exitSelectionMode();
    },
  });

  useEffect(() => {
    if (sheet === null) sheetRef.current?.close();
    else {
      cancelAnimation(predictiveBackProgress);
      predictiveBackProgress.value = 0;
      sheetRef.current?.snapToIndex(0);
    }
  }, [predictiveBackProgress, sheet]);

  useEffect(() => {
    onVisibilityChange?.(visible);
  }, [onVisibilityChange, visible]);

  useEffect(() => () => onVisibilityChange?.(false), [onVisibilityChange]);

  useEffect(() => {
    if (sheet !== "history") historyController.exitSelectionMode();
  }, [historyController.exitSelectionMode, sheet]);

  useEffect(() => {
    if (!historySelectionBackActive) return;

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        historyController.exitSelectionMode();
        return true;
      },
    );
    return () => subscription.remove();
  }, [historyController.exitSelectionMode, historySelectionBackActive]);

  return (
    <>
      <FixedSheetBackdrop
        animatedIndex={animatedIndex}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        visible={visible}
        zIndex={UTILITY_BACKDROP_Z_INDEX}
        accessibilityLabel={`${
          renderedSheet === "settings"
            ? "Settings"
            : renderedSheet === "history"
              ? "History"
              : "Metadata"
        } 닫기`}
        onPress={onClose}
      />
      <PredictiveBackSheetLayer
        active={visible}
        progress={predictiveBackProgress}
        zIndex={UTILITY_SHEET_Z_INDEX}
      >
        <BottomSheet
          ref={sheetRef}
          index={sheet === null ? -1 : 0}
          snapPoints={snapPoints}
          animatedIndex={animatedIndex}
          animationConfigs={animationConfigs}
          animateOnMount={false}
          enableDynamicSizing={false}
          enableContentPanningGesture
          enableHandlePanningGesture
          enableOverDrag={false}
          enablePanDownToClose
          enableBlurKeyboardOnGesture
          keyboardBehavior="extend"
          keyboardBlurBehavior="restore"
          android_keyboardInputMode="adjustResize"
          activeOffsetY={
            renderedSheet === "metadata" ? [-10, 10] : undefined
          }
          failOffsetX={
            renderedSheet === "metadata" ? [-18, 18] : undefined
          }
          waitFor={
            renderedSheet === "metadata"
              ? metadataPagerController.pageGesture
              : undefined
          }
          handleComponent={
            renderedSheet === "history" ? renderHistoryHandle : undefined
          }
          footerComponent={
            renderedSheet === "history" ? renderHistoryFooter : undefined
          }
          handleStyle={styles.handleArea}
          handleIndicatorStyle={styles.handleIndicator}
          style={styles.utilitySheetMask}
          containerStyle={styles.utilitySheetContainer}
          backgroundStyle={styles.sheetBackground}
          onClose={handleSheetClosed}
          onChange={handleSheetChanged}
        >
          {contentSheet === null ? (
            <BottomSheetView style={styles.sheetBody}>{null}</BottomSheetView>
          ) : (
            <UtilitySheetContent
              key={contentSheet}
              sheet={contentSheet}
              active={visible}
              onClose={onClose}
              historyController={historyController}
              generation={generation}
              metadataPagerController={metadataPagerController}
            />
          )}
        </BottomSheet>
      </PredictiveBackSheetLayer>
    </>
  );
}

const styles = StyleSheet.create({
  utilitySheetContainer: {
    zIndex: 85,
    elevation: 85,
  },
  utilitySheetMask: {
    overflow: "hidden",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
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
  utilityHeader: {
    height: GENERATION_SHEET_HEADER_HEIGHT,
    paddingLeft: 20,
    paddingRight: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  utilityTitle: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.semibold,
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
});
