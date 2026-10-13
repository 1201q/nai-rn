import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import BottomSheet, {
  type BottomSheetFooterProps,
  type BottomSheetHandleProps,
  BottomSheetView,
  useBottomSheetTimingConfigs,
} from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import {
  cancelAnimation,
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
import type { MetadataSheetSource } from "./metadata/MetadataSheetContent";
import {
  GENERATION_SHEET_HEADER_HEIGHT,
  useGenerationChromeMetrics,
} from "../../../hooks/useGenerationChromeMetrics";
import { useBackHandler } from "../../../native/useBackHandler";
import { tokens } from "../../../styles/tokens";
import {
  FixedSheetBackdrop,
  PredictiveBackSheetLayer,
  PressableSurface,
} from "./SheetLayers";
import { MetadataSheet } from "./metadata/MetadataSheet";
import { SettingsSheetContent } from "./settings/SettingsSheetContent";
import { SHEET_EASING, sheetChromeStyles } from "./sheetChrome";

export type UtilitySheet = "settings" | "history" | "metadata";

const UTILITY_BACKDROP_Z_INDEX = 82;
const UTILITY_SHEET_Z_INDEX = 85;

const UtilitySheetContent = memo(function UtilitySheetContent({
  sheet,
  active,
  onClose,
  historyController,
  generation,
}: {
  sheet: UtilitySheet;
  active: boolean;
  onClose: () => void;
  historyController: HistorySheetController;
  generation: MetadataSheetSource | null;
}) {
  if (sheet === "history") {
    return <HistorySheetContent controller={historyController} />;
  }

  if (sheet === "metadata") {
    return generation ? (
      <BottomSheetView style={sheetChromeStyles.sheetBody}>
        <MetadataSheet generation={generation} onClose={onClose} />
      </BottomSheetView>
    ) : null;
  }

  const title = "Settings";

  return (
    <BottomSheetView
      style={sheetChromeStyles.sheetBody}
      pointerEvents={active ? "auto" : "none"}
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? "auto" : "no-hide-descendants"}
    >
      <View style={styles.utilityHeader}>
        <View style={styles.headerSide}>
          <PressableSurface
            accessibilityLabel={`${title} 닫기`}
            onPress={onClose}
            style={styles.closeButton}
          >
            <Ionicons
              name="close-outline"
              size={22}
              color={tokens.color.textPrimary}
            />
          </PressableSurface>
        </View>
        <Text style={styles.utilityTitle}>{title}</Text>
        <View style={styles.headerSide} />
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
  onSelectGeneration,
  generation = null,
}: {
  sheet: UtilitySheet | null;
  predictiveBackProgress: SharedValue<number>;
  onClose: () => void;
  onVisibilityChange?: (visible: boolean) => void;
  // History 타일을 눌렀을 때의 동작을 바꾼다(업스케일 화면).
  onSelectGeneration?: (item: GenerationRecord) => void;
  generation?: MetadataSheetSource | null;
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
      retainSettings:
        sheet === null ? transition.retainSettings : sheet === "settings",
    });
  }
  const latestTransition = useRef(transition);
  latestTransition.current = transition;
  const renderedSheet = sheet ?? transition.content;
  const visible = renderedSheet !== null;
  // Cached Settings must not keep the backdrop or back handler active.
  const contentSheet =
    renderedSheet ?? (transition.retainSettings ? "settings" : null);
  const historyController = useHistorySheetController({
    onClose,
    onSelect: onSelectGeneration,
  });
  const { height: windowHeight } = useWindowDimensions();
  const { utilitySheetTop } = useGenerationChromeMetrics();
  const snapPoints = useMemo(
    () => [Math.max(1, windowHeight - utilitySheetTop)],
    [utilitySheetTop, windowHeight],
  );
  const animationConfigs = useBottomSheetTimingConfigs({
    duration: 300,
    easing: SHEET_EASING,
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
  const handleSheetChanged = useCallback(
    (index: number) => {
      // Reconcile a reversal that arrived before the native animation moved.
      const latest = latestTransition.current;
      if (index === 0 && latest.sheet === null) sheetRef.current?.close();
      if (index === -1 && latest.sheet !== null && latest !== transition) {
        sheetRef.current?.snapToIndex(0);
      }
    },
    [transition],
  );
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

  useBackHandler(historySelectionBackActive, {
    onBack: () => {
      predictiveBackProgress.value = 0;
      historyController.exitSelectionMode();
    },
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
          handleComponent={
            renderedSheet === "history" ? renderHistoryHandle : undefined
          }
          footerComponent={
            renderedSheet === "history" ? renderHistoryFooter : undefined
          }
          handleStyle={sheetChromeStyles.handleArea}
          handleIndicatorStyle={sheetChromeStyles.handleIndicator}
          style={styles.utilitySheetMask}
          containerStyle={styles.utilitySheetContainer}
          backgroundStyle={sheetChromeStyles.sheetBackground}
          onClose={handleSheetClosed}
          onChange={handleSheetChanged}
        >
          {contentSheet === null ? (
            <BottomSheetView style={sheetChromeStyles.sheetBody}>
              {null}
            </BottomSheetView>
          ) : (
            <UtilitySheetContent
              key={contentSheet}
              sheet={contentSheet}
              active={visible}
              onClose={onClose}
              historyController={historyController}
              generation={generation}
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
  utilityHeader: {
    height: GENERATION_SHEET_HEADER_HEIGHT,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  // 좌우 칸을 같은 너비로 두어 제목이 항상 가운데에 온다.
  headerSide: {
    flex: 1,
    alignItems: "flex-start",
  },
  utilityTitle: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: 16,
    letterSpacing: -0.3,
    // 글자 높이 중심을 닫기 아이콘 중심에 맞춘다.
    top: -1,
  },
  closeButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: tokens.color.borderSubtle,
  },
});
