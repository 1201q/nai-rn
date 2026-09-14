import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  BackHandler,
  Keyboard,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
  type BottomSheetScrollViewMethods,
} from "@gorhom/bottom-sheet";
import Reanimated, { FadeIn } from "react-native-reanimated";

import { CharacterPositionSheet } from "../components/sheets/CharacterPositionSheet";
import { BatchCountSheet } from "../components/sheets/BatchCountSheet";
import { usePredictiveBackHandler } from "../native/predictiveBack";
import { tokens } from "../styles/tokens";

type AppSheetRoute = "batchCount" | "characterPosition";
const IDLE_ROUTE = "__idle__";
type SheetRoute = AppSheetRoute | typeof IDLE_ROUTE;

type SheetEntry = {
  route: SheetRoute;
  characterId?: string;
};
type OpenSheetEntry = SheetEntry & { route: AppSheetRoute };

type AppSheetContextValue = {
  open: (route: "batchCount") => void;
  openCharacterPosition: (characterId: string) => void;
  close: () => void;
};

const AppSheetContext = createContext<AppSheetContextValue | null>(null);

export function useAppSheet() {
  const ctx = useContext(AppSheetContext);
  if (!ctx) {
    throw new Error("useAppSheet must be used within AppSheetProvider");
  }
  return ctx;
}

const SNAP_POINTS: Record<SheetRoute, string[]> = {
  [IDLE_ROUTE]: ["1%"],
  batchCount: ["44%"],
  characterPosition: ["68%"],
};
const ROUTE_FADE_IN = FadeIn.duration(100);
const SHEET_HANDLE_HEIGHT = 25;

function titleFor(route: SheetRoute) {
  if (route === "batchCount") return "Batch Count";
  if (route === "characterPosition") return "Character Position";
}

export function AppSheetProvider({ children }: { children: ReactNode }) {
  const { height: windowHeight } = useWindowDimensions();
  const sheetRef = useRef<BottomSheet>(null);
  const scrollRef = useRef<BottomSheetScrollViewMethods>(null);
  const [current, setCurrent] = useState<SheetEntry>({ route: IDLE_ROUTE });
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const openRef = useRef(false);
  const closingRef = useRef(false);
  const keyboardHideSubscriptionRef = useRef<ReturnType<
    typeof Keyboard.addListener
  > | null>(null);
  const keyboardCloseTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const closeCompletionTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  const clearPendingKeyboardClose = useCallback(() => {
    keyboardHideSubscriptionRef.current?.remove();
    keyboardHideSubscriptionRef.current = null;
    if (keyboardCloseTimeoutRef.current) {
      clearTimeout(keyboardCloseTimeoutRef.current);
      keyboardCloseTimeoutRef.current = null;
    }
    if (closeCompletionTimeoutRef.current) {
      clearTimeout(closeCompletionTimeoutRef.current);
      closeCompletionTimeoutRef.current = null;
    }
  }, []);

  const finalizeClose = useCallback(() => {
    clearPendingKeyboardClose();
    openRef.current = false;
    closingRef.current = false;
    setIsOpen(false);
    setIsClosing(false);
    setCurrent({ route: IDLE_ROUTE });
  }, [clearPendingKeyboardClose]);

  const closeSheetNow = useCallback(() => {
    clearPendingKeyboardClose();
    sheetRef.current?.close();
    closeCompletionTimeoutRef.current = setTimeout(finalizeClose, 500);
  }, [clearPendingKeyboardClose, finalizeClose]);

  const close = useCallback(() => {
    if (closingRef.current) return;

    closingRef.current = true;
    setIsClosing(true);

    if (!Keyboard.isVisible()) {
      closeSheetNow();
      return;
    }

    keyboardHideSubscriptionRef.current = Keyboard.addListener(
      "keyboardDidHide",
      closeSheetNow,
    );
    keyboardCloseTimeoutRef.current = setTimeout(closeSheetNow, 300);
    Keyboard.dismiss();
  }, [closeSheetNow]);

  useEffect(() => clearPendingKeyboardClose, [clearPendingKeyboardClose]);

  usePredictiveBackHandler(isOpen, { onCommit: close });

  const openEntry = useCallback(
    (entry: OpenSheetEntry) => {
      clearPendingKeyboardClose();
      closingRef.current = false;
      setIsClosing(false);
      openRef.current = true;
      setIsOpen(true);
      setCurrent(entry);
      // Reset the scroll position when reopening the same sheet.
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ y: 0, animated: false });
      });
    },
    [clearPendingKeyboardClose],
  );

  const open = useCallback(
    (route: "batchCount") => {
      openEntry({ route });
    },
    [openEntry],
  );

  const openCharacterPosition = useCallback(
    (characterId: string) => {
      openEntry({ route: "characterPosition", characterId });
    },
    [openEntry],
  );

  const handleChange = useCallback(
    (index: number) => {
      const wasOpen = openRef.current;
      const nextOpen = index >= 0;
      if (nextOpen !== openRef.current) {
        openRef.current = nextOpen;
        setIsOpen(nextOpen);
      }
      if (!nextOpen && (wasOpen || closingRef.current)) {
        finalizeClose();
      }
    },
    [finalizeClose],
  );

  const handleAnimate = useCallback(
    (_fromIndex: number, toIndex: number) => {
      if (toIndex !== -1 || !openRef.current) return;
      if (!closingRef.current) {
        closingRef.current = true;
        setIsClosing(true);
      }
      if (closeCompletionTimeoutRef.current) {
        clearTimeout(closeCompletionTimeoutRef.current);
      }
      closeCompletionTimeoutRef.current = setTimeout(finalizeClose, 500);
    },
    [finalizeClose],
  );

  const handleCloseComplete = useCallback(() => {
    if (!openRef.current && !closingRef.current) return;
    finalizeClose();
  }, [finalizeClose]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!openRef.current) return false;
      close();
      return true;
    });
    return () => sub.remove();
  }, [close]);

  const backdropCloseDisabled = current.route === "batchCount";
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        enableTouchThrough={isClosing}
        pressBehavior="none"
        onPress={backdropCloseDisabled ? undefined : close}
      />
    ),
    [backdropCloseDisabled, close, isClosing],
  );

  const value = useMemo<AppSheetContextValue>(
    () => ({ open, openCharacterPosition, close }),
    [open, openCharacterPosition, close],
  );

  const route = current.route;
  const snapPoints = SNAP_POINTS[route];
  const sheetHeight =
    windowHeight * (Number.parseFloat(snapPoints[0] ?? "0") / 100);
  const sheetLayoutStyle = useMemo(
    () => [
      sheetStyles.layout,
      { height: Math.max(0, sheetHeight - SHEET_HANDLE_HEIGHT) },
    ],
    [sheetHeight],
  );

  return (
    <AppSheetContext.Provider value={value}>
      {children}
      {route !== IDLE_ROUTE ? (
        <BottomSheet
          ref={sheetRef}
          index={0}
          snapPoints={snapPoints}
          enableContentPanningGesture={route !== "batchCount"}
          enableHandlePanningGesture
          enablePanDownToClose
          enableBlurKeyboardOnGesture
          backdropComponent={renderBackdrop}
          style={sheetStyles.sheetContainer}
          containerStyle={sheetStyles.sheetContainer}
          backgroundStyle={sheetStyles.sheetBackground}
          handleStyle={sheetStyles.sheetHandleContainer}
          handleIndicatorStyle={sheetStyles.sheetHandle}
          enableDynamicSizing={false}
          keyboardBehavior="interactive"
          keyboardBlurBehavior="restore"
          android_keyboardInputMode="adjustResize"
          onAnimate={handleAnimate}
          onChange={handleChange}
          onClose={handleCloseComplete}
        >
          <View style={sheetLayoutStyle}>
            <Reanimated.View
              key={`header-${route}`}
              style={sheetStyles.routeContent}
            >
              <Reanimated.View
                entering={ROUTE_FADE_IN}
                style={[sheetStyles.headerBase, sheetStyles.header]}
              >
                <Text
                  style={[sheetStyles.titleBase, sheetStyles.title]}
                  numberOfLines={1}
                >
                  {titleFor(route)}
                </Text>
              </Reanimated.View>
            </Reanimated.View>

            {/* Keep the scrollable mounted across sheet routes. Remounting it can
                leave @gorhom/bottom-sheet with a stale Android gesture ref. */}
            <BottomSheetScrollView
              ref={scrollRef}
              style={sheetStyles.scrollView}
              contentContainerStyle={[
                sheetStyles.scrollContentBase,
                sheetStyles.scrollContent,
              ]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Reanimated.View key={route} style={sheetStyles.routeContent}>
                <Reanimated.View
                  entering={ROUTE_FADE_IN}
                  style={sheetStyles.routeContent}
                >
                  {route === "batchCount" ? (
                    <BatchCountSheet />
                  ) : route === "characterPosition" ? (
                    current.characterId ? (
                      <CharacterPositionSheet characterId={current.characterId} />
                    ) : null
                  ) : null}
                </Reanimated.View>
              </Reanimated.View>
            </BottomSheetScrollView>
          </View>
        </BottomSheet>
      ) : null}
    </AppSheetContext.Provider>
  );
}

const sheetStyles = StyleSheet.create({
  sheetContainer: {
    zIndex: 100,
    elevation: 100,
  },
  layout: {
    width: "100%",
  },
  sheetBackground: {
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    backgroundColor: tokens.color.card,
  },
  sheetHandle: {
    width: 36,
    height: 5,
    backgroundColor: tokens.color.borderSubtleStrong,
  },
  sheetHandleContainer: {
    height: SHEET_HANDLE_HEIGHT,
    padding: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  routeContent: {
    width: "100%",
    alignSelf: "stretch",
  },
  headerBase: {
    flexDirection: "row",
    alignItems: "center",
  },
  header: {
    minHeight: 48,
    marginBottom: tokens.space[6],
    paddingTop: 6,
    paddingHorizontal: tokens.space[12],
  },
  titleBase: {
    flex: 1,
    includeFontPadding: false,
  },
  title: {
    paddingLeft: 0,
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontWeight: "400",
    fontSize: 24,
    lineHeight: 30,
  },
  scrollContentBase: {
    width: "100%",
    alignItems: "stretch",
  },
  scrollContent: {
    paddingHorizontal: tokens.space[6],
    paddingBottom: tokens.space[12],
    gap: 0,
  },
  scrollView: {
    flex: 1,
  },
});
