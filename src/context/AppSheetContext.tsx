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
  Alert,
  BackHandler,
  Dimensions,
  Keyboard,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type AlertButton,
} from "react-native";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  TouchableOpacity as BottomSheetTouchableOpacity,
  type BottomSheetBackdropProps,
  type BottomSheetScrollViewMethods,
} from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Reanimated, { FadeIn } from "react-native-reanimated";

import type { GenerationRecord } from "../lib/generationHistory";
import {
  parseNaiMetadataJson,
  type ParsedNaiMetadata,
} from "../lib/naiMetadata";
import { hasImportableMetadata } from "../lib/metadataImport";
import { MetadataDetails } from "../components/metadata/MetadataDetails";
import { SeedSheet } from "../components/sheets/SeedSheet";
import { CustomResolutionSheet } from "../components/sheets/CustomResolutionSheet";
import { CharacterPositionSheet } from "../components/sheets/CharacterPositionSheet";
import { CharacterOrderSheet } from "../components/sheets/CharacterOrderSheet";
import { PreciseModeSheet } from "../components/sheets/PreciseModeSheet";
import { BatchCountSheet } from "../components/sheets/BatchCountSheet";
import { MetadataImportSheet } from "../components/sheets/MetadataImportSheet";
import type { SheetDraftController } from "../components/sheets/SheetDraft";
import { PrimaryButton } from "../components/common/Buttons";
import { usePredictiveBackHandler } from "../native/predictiveBack";
import { tokens } from "../styles/tokens";

//  상세/선택 화면이 공유하는 전역 단일 바텀시트 라우트.
type AppSheetRoute =
  | "metadataView"
  | "metadataImport"
  | "batchCount"
  | "seed"
  | "resolutionCustom"
  | "characterOrder"
  | "characterPosition"
  | "preciseMode";
const IDLE_ROUTE = "__idle__";
type SheetRoute = AppSheetRoute | typeof IDLE_ROUTE;

type StackEntry = {
  route: SheetRoute;
  params?: GenerationRecord;
  metadata?: ParsedNaiMetadata;
  characterId?: string;
  preciseReferenceId?: string;
};
type OpenStackEntry = StackEntry & { route: AppSheetRoute };

type AppSheetContextValue = {
  open: (route: AppSheetRoute, params?: GenerationRecord) => void;
  openMetadataImport: (metadata: ParsedNaiMetadata) => void;
  openCharacterPosition: (characterId: string) => void;
  openPreciseMode: (referenceId: string) => void;
  push: (route: AppSheetRoute, params?: GenerationRecord) => void;
  back: () => void;
  close: () => void;
};

const AppSheetContext = createContext<AppSheetContextValue | null>(null);
const AppSheetOpenContext = createContext<boolean | null>(null);

export function useAppSheet() {
  const ctx = useContext(AppSheetContext);
  if (!ctx) {
    throw new Error("useAppSheet must be used within AppSheetProvider");
  }
  return ctx;
}

export function useAppSheetOpen() {
  const isOpen = useContext(AppSheetOpenContext);
  if (isOpen === null) {
    throw new Error("useAppSheetOpen must be used within AppSheetProvider");
  }
  return isOpen;
}

const SNAP_POINTS: Record<SheetRoute, string[]> = {
  [IDLE_ROUTE]: ["1%"],
  metadataView: ["92%"],
  metadataImport: ["92%"],
  batchCount: ["44%"],
  seed: ["44%"],
  resolutionCustom: ["48%"],
  characterOrder: ["68%"],
  characterPosition: ["68%"],
  preciseMode: ["40%"],
};
const ROUTE_FADE_IN = FadeIn.duration(100);
const FOOTER_HEIGHT = 52;
const SHEET_HANDLE_HEIGHT = 25;
const KEYBOARD_SHEET_TOP_RATIO = 0.32;

function titleFor(route: SheetRoute) {
  if (route === "metadataView") return "Metadata";
  if (route === "metadataImport") return "Import Metadata";
  if (route === "batchCount") return "Batch Count";
  if (route === "seed") return "Seed";
  if (route === "resolutionCustom") return "해상도 추가";
  if (route === "characterOrder") return "Character Order";
  if (route === "characterPosition") return "Character Position";
  if (route === "preciseMode") return "Mode";
}

export function AppSheetProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const sheetRef = useRef<BottomSheet>(null);
  const scrollRef = useRef<BottomSheetScrollViewMethods>(null);
  // 네비게이션 스택. 마지막 원소가 현재 라우트. 직접 진입(open)은 길이 1 →
  // 뒤로가기 시 닫힘, 메뉴 경유(push)는 쌓여 뒤로가기 시 pop(이전 복귀).
  const [stack, setStack] = useState<StackEntry[]>([{ route: IDLE_ROUTE }]);
  const stackRef = useRef<StackEntry[]>([{ route: IDLE_ROUTE }]);
  const [draftController, setDraftController] =
    useState<SheetDraftController | null>(null);
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
  const draftControllerRef = useRef<SheetDraftController | null>(null);
  const closeAlertOpenRef = useRef(false);
  const hasCloseGuard = Boolean(draftController?.dirty);

  const apply = useCallback((next: StackEntry[]) => {
    draftControllerRef.current = null;
    setDraftController(null);
    stackRef.current = next;
    setStack(next);
  }, []);

  // 직접 진입: 스택 초기화. 시트는 단일 상세만 표시.
  const resetTo = useCallback(
    (entry: StackEntry) => {
      apply([entry]);
    },
    [apply],
  );

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
    resetTo({ route: IDLE_ROUTE });
  }, [clearPendingKeyboardClose, resetTo]);

  const closeSheetNow = useCallback(() => {
    clearPendingKeyboardClose();
    sheetRef.current?.close();
    closeCompletionTimeoutRef.current = setTimeout(finalizeClose, 500);
  }, [clearPendingKeyboardClose, finalizeClose]);

  const forceClose = useCallback(() => {
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

  const registerDraft = useCallback(
    (controller: SheetDraftController | null) => {
      draftControllerRef.current = controller;
      setDraftController(controller);
    },
    [],
  );

  const requestDraftExit = useCallback(
    (target: "back" | "close", afterExit: () => void) => {
      const controller = draftControllerRef.current;
      if (!controller?.dirty) {
        afterExit();
        return;
      }
      if (closeAlertOpenRef.current) return;

      closeAlertOpenRef.current = true;
      const finishAlert = () => {
        closeAlertOpenRef.current = false;
      };
      const buttons: AlertButton[] = [
        {
          text: "계속 편집",
          style: "cancel",
          onPress: finishAlert,
        },
        {
          text:
            target === "back" ? "저장하지 않고 뒤로가기" : "저장하지 않고 닫기",
          style: "destructive",
          onPress: () => {
            finishAlert();
            afterExit();
          },
        },
      ];
      if (controller.canSave) {
        buttons.push({
          text: target === "back" ? "저장하고 뒤로가기" : "저장하고 닫기",
          onPress: () => {
            finishAlert();
            if (controller.save()) afterExit();
          },
        });
      }

      Alert.alert(controller.promptTitle, controller.promptMessage, buttons, {
        cancelable: true,
        onDismiss: finishAlert,
      });
    },
    [],
  );

  const close = useCallback(() => {
    requestDraftExit("close", forceClose);
  }, [forceClose, requestDraftExit]);

  const back = useCallback(() => {
    const goBack = () => {
      const currentStack = stackRef.current;
      if (currentStack.length > 1) {
        apply(currentStack.slice(0, -1));
      } else {
        forceClose();
      }
    };
    requestDraftExit("back", goBack);
  }, [apply, forceClose, requestDraftExit]);

  usePredictiveBackHandler(isOpen, { onCommit: back });

  const openEntry = useCallback(
    (entry: OpenStackEntry) => {
      clearPendingKeyboardClose();
      closingRef.current = false;
      setIsClosing(false);
      openRef.current = true;
      setIsOpen(true);
      resetTo(entry);
      // 같은 라우트 재진입은 remount 가 안 일어나 스크롤이 잔류 → top 리셋.
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ y: 0, animated: false });
      });
    },
    [clearPendingKeyboardClose, resetTo],
  );

  const open = useCallback(
    (route: AppSheetRoute, params?: GenerationRecord) => {
      openEntry({ route, params });
    },
    [openEntry],
  );

  const openMetadataImport = useCallback(
    (metadata: ParsedNaiMetadata) => {
      openEntry({ route: "metadataImport", metadata });
    },
    [openEntry],
  );

  const openCharacterPosition = useCallback(
    (characterId: string) => {
      openEntry({ route: "characterPosition", characterId });
    },
    [openEntry],
  );

  const openPreciseMode = useCallback(
    (referenceId: string) => {
      openEntry({ route: "preciseMode", preciseReferenceId: referenceId });
    },
    [openEntry],
  );

  // 메뉴/상세에서 다음 상세로 진입 — 스택에 쌓아 뒤로가기 가능 상태로.
  const push = useCallback(
    (route: AppSheetRoute, params?: GenerationRecord) => {
      const top = stackRef.current[stackRef.current.length - 1];
      if (top?.route === route) return;
      apply([...stackRef.current, { route, params }]);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ y: 0, animated: false });
      });
    },
    [apply],
  );

  const pushMetadataImport = useCallback(
    (metadata: ParsedNaiMetadata) => {
      const top = stackRef.current[stackRef.current.length - 1];
      if (top?.route === "metadataImport") return;
      apply([...stackRef.current, { route: "metadataImport", metadata }]);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ y: 0, animated: false });
      });
    },
    [apply],
  );

  const handleChange = useCallback(
    (index: number) => {
      if (__DEV__) {
        console.log("[app-sheet] change", {
          index,
          route: stackRef.current[stackRef.current.length - 1]?.route,
        });
      }
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
    if (__DEV__) {
      console.log("[app-sheet] close", {
        route: stackRef.current[stackRef.current.length - 1]?.route,
        trackedOpen: openRef.current,
      });
    }
    if (!openRef.current && !closingRef.current) return;
    finalizeClose();
  }, [finalizeClose]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (closeAlertOpenRef.current) return false;
      if (!openRef.current) return false;
      back();
      return true;
    });
    return () => sub.remove();
  }, [back]);

  const backdropCloseDisabled = stack[stack.length - 1].route === "batchCount";
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
    () => ({
      open,
      openMetadataImport,
      openCharacterPosition,
      openPreciseMode,
      push,
      back,
      close,
    }),
    [
      open,
      openMetadataImport,
      openCharacterPosition,
      openPreciseMode,
      push,
      back,
      close,
    ],
  );

  const current = stack[stack.length - 1];
  const route = current.route;
  const baseSnapPoints = SNAP_POINTS[route];
  const isKeyboardInputRoute =
    route === "seed" || route === "resolutionCustom";
  const sheetHeight =
    windowHeight * (Number.parseFloat(baseSnapPoints[0] ?? "0") / 100);
  const snapPoints = useMemo(
    () => (isKeyboardInputRoute ? [sheetHeight] : baseSnapPoints),
    [baseSnapPoints, isKeyboardInputRoute, sheetHeight],
  );
  const keyboardSheetTopInset = isKeyboardInputRoute
    ? Math.max(
        insets.top,
        Math.round(Dimensions.get("screen").height * KEYBOARD_SHEET_TOP_RATIO),
      )
    : 0;
  const canBack = stack.length > 1;
  const currentRecordMetadata = useMemo(
    () =>
      route === "metadataView" && current.params
        ? parseNaiMetadataJson(current.params.metadataJson)
        : null,
    [current.params, route],
  );
  const canImportCurrentMetadata = Boolean(
    currentRecordMetadata && hasImportableMetadata(currentRecordMetadata),
  );
  const handleOpenCurrentMetadataImport = useCallback(() => {
    if (!currentRecordMetadata) return;
    pushMetadataImport(currentRecordMetadata);
  }, [currentRecordMetadata, pushMetadataImport]);

  const footerBottomInset =
    Math.max(insets.bottom, tokens.space[4]) + tokens.space[4];
  const draftFooterStyle = useMemo(
    () => [sheetStyles.footer, { paddingBottom: footerBottomInset }],
    [footerBottomInset],
  );
  const sheetLayoutStyle = useMemo(
    () => [
      sheetStyles.layout,
      { height: Math.max(0, sheetHeight - SHEET_HANDLE_HEIGHT) },
    ],
    [sheetHeight],
  );
  const showDraftFooter =
    route === "seed" ||
    route === "resolutionCustom" ||
    route === "characterOrder" ||
    route === "metadataImport";
  const activeDraft = draftController?.id === route ? draftController : null;
  const handleDraftFooterSave = useCallback(() => {
    const controller = draftControllerRef.current;
    if (!controller || controller.id !== route || !controller.save()) return;

    if (route === "resolutionCustom") {
      const currentStack = stackRef.current;
      if (currentStack.length > 1) {
        apply(currentStack.slice(0, -1));
      } else {
        forceClose();
      }
      return;
    }
    forceClose();
  }, [apply, forceClose, route]);

  return (
    <AppSheetContext.Provider value={value}>
      <AppSheetOpenContext.Provider value={isOpen}>
        {children}
      </AppSheetOpenContext.Provider>
      {route !== IDLE_ROUTE ? (
        <BottomSheet
        ref={sheetRef}
        index={0}
        snapPoints={snapPoints}
        enableContentPanningGesture={route !== "batchCount"}
        enableHandlePanningGesture
        enablePanDownToClose={!hasCloseGuard}
        enableBlurKeyboardOnGesture
        backdropComponent={renderBackdrop}
        style={sheetStyles.sheetContainer}
        containerStyle={sheetStyles.sheetContainer}
        backgroundStyle={[
          sheetStyles.sheetBackground,
          (route === "metadataView" || route === "metadataImport") &&
            sheetStyles.metadataSheetBackground,
        ]}
        handleStyle={sheetStyles.sheetHandleContainer}
        handleIndicatorStyle={sheetStyles.sheetHandle}
        enableDynamicSizing={false}
        topInset={keyboardSheetTopInset}
        keyboardBehavior={
          isKeyboardInputRoute ? "fillParent" : "interactive"
        }
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
              {canBack && (
                <BottomSheetTouchableOpacity
                  style={sheetStyles.backButton}
                  onPress={back}
                >
                  <Ionicons
                    name="chevron-back"
                    size={22}
                    color={tokens.color.textPrimary}
                  />
                </BottomSheetTouchableOpacity>
              )}
              <Text
                style={[sheetStyles.titleBase, sheetStyles.title]}
                numberOfLines={1}
              >
                {titleFor(route)}
              </Text>
              {route === "metadataView" && canImportCurrentMetadata ? (
                <BottomSheetTouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="메타데이터 가져오기"
                  hitSlop={6}
                  onPress={handleOpenCurrentMetadataImport}
                  style={sheetStyles.headerAction}
                >
                  <Ionicons
                    name="download-outline"
                    size={21}
                    color={tokens.color.accent}
                  />
                </BottomSheetTouchableOpacity>
              ) : null}
            </Reanimated.View>
          </Reanimated.View>

          {/* Keep the scrollable mounted across sheet routes. Remounting it can
              leave @gorhom/bottom-sheet with a stale Android gesture ref. */}
          <BottomSheetScrollView
            ref={scrollRef}
            style={sheetStyles.scrollView}
            contentContainerStyle={
              route === "metadataView"
                ? sheetStyles.metadataScrollContent
                : [sheetStyles.scrollContentBase, sheetStyles.scrollContent]
            }
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
                ) : route === "seed" ? (
                  <SeedSheet
                    onSaveAndClose={forceClose}
                    registerDraft={registerDraft}
                  />
                ) : route === "resolutionCustom" ? (
                  <CustomResolutionSheet registerDraft={registerDraft} />
                ) : route === "characterOrder" ? (
                  <CharacterOrderSheet registerDraft={registerDraft} />
                ) : route === "characterPosition" ? (
                  current.characterId ? (
                    <CharacterPositionSheet characterId={current.characterId} />
                  ) : null
                ) : route === "preciseMode" ? (
                  current.preciseReferenceId ? (
                    <PreciseModeSheet
                      referenceId={current.preciseReferenceId}
                      onSelect={forceClose}
                    />
                  ) : null
                ) : route === "metadataView" ? (
                  current.params ? (
                    <MetadataDetails
                      parsed={currentRecordMetadata}
                      variant="sheet"
                    />
                  ) : null
                ) : route === "metadataImport" ? (
                  current.metadata ? (
                    <MetadataImportSheet
                      parsed={current.metadata}
                      registerDraft={registerDraft}
                    />
                  ) : null
                ) : null}
              </Reanimated.View>
            </Reanimated.View>
          </BottomSheetScrollView>

          <View
            style={
              showDraftFooter ? draftFooterStyle : sheetStyles.footerHidden
            }
          >
            <View style={sheetStyles.footerButton}>
              <PrimaryButton
                label={
                  route === "metadataImport"
                    ? "가져오기"
                    : route === "resolutionCustom"
                      ? "추가"
                      : "저장"
                }
                disabled={!activeDraft?.canSave}
                onPress={handleDraftFooterSave}
              />
            </View>
          </View>
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
  metadataSheetBackground: {
    backgroundColor: tokens.color.app,
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
  backButton: {
    width: 36,
    height: 36,
    marginLeft: -8,
    alignItems: "center",
    justifyContent: "center",
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
  headerAction: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
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
  metadataScrollContent: {
    width: "100%",
    alignItems: "stretch",
    paddingHorizontal: 0,
    paddingBottom: tokens.space[16],
    gap: 0,
  },
  scrollView: {
    flex: 1,
  },
  footer: {
    paddingHorizontal: tokens.space[9],
    paddingTop: tokens.space[6],
  },
  footerHidden: {
    display: "none",
  },
  footerButton: {
    height: FOOTER_HEIGHT,
  },
});
