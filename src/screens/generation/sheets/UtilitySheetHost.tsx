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
import { useGenerationChromeMetrics } from "../../../hooks/useGenerationChromeMetrics";
import { usePredictiveBackHandler } from "../../../native/predictiveBack";
import { tokens } from "../../../styles/tokens";
import {
  FixedSheetBackdrop,
  PredictiveBackSheetLayer,
  PressableSurface,
} from "./SheetLayers";
import { SettingsSheetContent } from "./settings/SettingsSheetContent";

export type UtilitySheet = "settings" | "history";

const UTILITY_BACKDROP_Z_INDEX = 82;
const UTILITY_SHEET_Z_INDEX = 85;

const UtilitySheetContent = memo(function UtilitySheetContent({
  sheet,
  onClose,
  historyController,
}: {
  sheet: UtilitySheet;
  onClose: () => void;
  historyController: HistorySheetController;
}) {
  if (sheet === "history") {
    return <HistorySheetContent controller={historyController} />;
  }

  const title = "Settings";

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
      <SettingsSheetContent />
    </BottomSheetView>
  );
});

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
  const historyController = useHistorySheetController({ onClose });
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
    setRenderedSheet(null);
    onClose();
  }, [onClose]);
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
    if (sheet === null) {
      if (renderedSheet !== null) sheetRef.current?.close();
      return;
    }

    if (sheet !== renderedSheet) {
      setRenderedSheet(sheet);
    }
  }, [renderedSheet, sheet]);

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
          enableBlurKeyboardOnGesture
          keyboardBehavior="extend"
          keyboardBlurBehavior="restore"
          android_keyboardInputMode="adjustResize"
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
        >
          <UtilitySheetContent
            sheet={renderedSheet}
            onClose={onClose}
            historyController={historyController}
          />
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
    height: 52,
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
