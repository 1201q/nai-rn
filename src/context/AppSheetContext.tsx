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
  StyleSheet,
  Text,
  View,
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
import Reanimated, {
  FadeIn,
  SlideInLeft,
  SlideInRight,
} from "react-native-reanimated";

import type { GenerationRecord } from "../lib/generationHistory";
import {
  parseNaiMetadataJson,
  type ParsedNaiMetadata,
} from "../lib/naiMetadata";
import { hasImportableMetadata } from "../lib/metadataImport";
import {
  RendraGenerationOptionSheet,
  type RendraGenerationOptionRoute,
} from "../components/rendra/RendraGenerationOptionSheet";
import { RendraMetadataDetails } from "../components/rendra/RendraMetadataDetails";
import { RendraUcPresetSheet } from "../components/rendra/RendraUcPresetSheet";
import { RendraSeedSheet } from "../components/rendra/RendraSeedSheet";
import { RendraResolutionSheet } from "../components/rendra/RendraResolutionSheet";
import { RendraCustomResolutionSheet } from "../components/rendra/RendraCustomResolutionSheet";
import { RendraCharacterPositionSheet } from "../components/rendra/RendraCharacterPositionSheet";
import { RendraCharacterOrderSheet } from "../components/rendra/RendraCharacterOrderSheet";
import { RendraPreciseModeSheet } from "../components/rendra/RendraPreciseModeSheet";
import { RendraBatchCountSheet } from "../components/rendra/RendraBatchCountSheet";
import { RendraMetadataImportSheet } from "../components/rendra/RendraMetadataImportSheet";
import type { RendraSheetDraftController } from "../components/rendra/RendraSheetDraft";
import { RendraPrimaryButton } from "../components/rendra/RendraButtons";
import { tokens } from "../styles/tokens";

// Rendra 상세/선택 화면이 공유하는 전역 단일 바텀시트 라우트.
type RendraSheetRoute =
  | "metadataView"
  | "metadataImport"
  | "rendraBatchCount"
  | "ucPreset"
  | "seed"
  | "resolution"
  | "resolutionCustom"
  | "characterOrder"
  | "characterPosition"
  | "preciseMode"
  | RendraGenerationOptionRoute;
type SheetRoute = RendraSheetRoute;

type StackEntry = {
  route: SheetRoute;
  params?: GenerationRecord;
  metadata?: ParsedNaiMetadata;
  characterId?: string;
  preciseReferenceId?: string;
};
type TransitionDirection = "forward" | "back" | "none";
type OpenRequest = { id: number; route: SheetRoute };

type AppSheetContextValue = {
  open: (route: SheetRoute, params?: GenerationRecord) => void;
  openMetadataImport: (metadata: ParsedNaiMetadata) => void;
  openCharacterPosition: (characterId: string) => void;
  openPreciseMode: (referenceId: string) => void;
  push: (route: SheetRoute, params?: GenerationRecord) => void;
  back: () => void;
  close: () => void;
  isOpen: boolean;
};

const AppSheetContext = createContext<AppSheetContextValue | null>(null);

export function useAppSheet() {
  const ctx = useContext(AppSheetContext);
  if (!ctx) {
    throw new Error("useAppSheet must be used within AppSheetProvider");
  }
  return ctx;
}

const RENDRA_SNAP_POINTS: Record<RendraSheetRoute, string[]> = {
  metadataView: ["92%"],
  metadataImport: ["92%"],
  rendraBatchCount: ["44%"],
  ucPreset: ["44%"],
  seed: ["44%"],
  resolution: ["68%"],
  resolutionCustom: ["68%"],
  characterOrder: ["68%"],
  characterPosition: ["68%"],
  preciseMode: ["40%"],
  model: ["50%"],
  sampler: ["64%"],
  schedule: ["44%"],
};
const ROUTE_ENTER_FORWARD = SlideInRight.duration(140);
const ROUTE_ENTER_BACK = SlideInLeft.duration(140);
const ROUTE_FADE_IN = FadeIn.duration(100);
const RENDRA_FOOTER_HEIGHT = 52;

function titleFor(route: SheetRoute) {
  if (route === "metadataView") return "Metadata";
  if (route === "metadataImport") return "Import Metadata";
  if (route === "rendraBatchCount") return "Batch Count";
  if (route === "ucPreset") return "UC Preset";
  if (route === "seed") return "Seed";
  if (route === "resolution") return "Resolution";
  if (route === "resolutionCustom") return "Custom Resolution";
  if (route === "characterOrder") return "Character Order";
  if (route === "characterPosition") return "Character Position";
  if (route === "preciseMode") return "Mode";
  if (route === "model") return "Model";
  if (route === "sampler") return "Sampler";
  if (route === "schedule") return "Schedule";
}

function isGenerationOptionRoute(
  route: SheetRoute,
): route is RendraGenerationOptionRoute {
  return route === "model" || route === "sampler" || route === "schedule";
}

export function AppSheetProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheet>(null);
  const scrollRef = useRef<BottomSheetScrollViewMethods>(null);
  // 네비게이션 스택. 마지막 원소가 현재 라우트. 직접 진입(open)은 길이 1 →
  // 뒤로가기 시 닫힘, 메뉴 경유(push)는 쌓여 뒤로가기 시 pop(이전 복귀).
  const [stack, setStack] = useState<StackEntry[]>([
    { route: "rendraBatchCount" },
  ]);
  const stackRef = useRef<StackEntry[]>([{ route: "rendraBatchCount" }]);
  const [transitionDirection, setTransitionDirection] =
    useState<TransitionDirection>("forward");
  const [openRequest, setOpenRequest] = useState<OpenRequest | null>(null);
  const [draftController, setDraftController] =
    useState<RendraSheetDraftController | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const openRef = useRef(false);
  const draftControllerRef = useRef<RendraSheetDraftController | null>(null);
  const closeAlertOpenRef = useRef(false);
  const hasCloseGuard = Boolean(draftController?.dirty);

  const apply = useCallback(
    (next: StackEntry[], direction: TransitionDirection) => {
      draftControllerRef.current = null;
      setDraftController(null);
      stackRef.current = next;
      setTransitionDirection(direction);
      setStack(next);
    },
    [],
  );

  // 직접 진입: 스택 초기화. 시트는 단일 상세만 → 슬라이드 전환 없음("none").
  const resetTo = useCallback(
    (entry: StackEntry) => {
      apply([entry], "none");
    },
    [apply],
  );

  const forceClose = useCallback(() => sheetRef.current?.close(), []);

  const registerDraft = useCallback(
    (controller: RendraSheetDraftController | null) => {
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
        apply(currentStack.slice(0, -1), "back");
      } else {
        forceClose();
      }
    };
    requestDraftExit("back", goBack);
  }, [apply, forceClose, requestDraftExit]);

  const openEntry = useCallback(
    (entry: StackEntry) => {
      resetTo(entry);
      setOpenRequest((current) => ({
        id: (current?.id ?? 0) + 1,
        route: entry.route,
      }));
      // 같은 라우트 재진입은 remount 가 안 일어나 스크롤이 잔류 → top 리셋.
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ y: 0, animated: false });
      });
    },
    [resetTo],
  );

  const open = useCallback(
    (route: SheetRoute, params?: GenerationRecord) => {
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
    (route: SheetRoute, params?: GenerationRecord) => {
      const top = stackRef.current[stackRef.current.length - 1];
      if (top?.route === route) return;
      apply([...stackRef.current, { route, params }], "forward");
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
      apply(
        [...stackRef.current, { route: "metadataImport", metadata }],
        "forward",
      );
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ y: 0, animated: false });
      });
    },
    [apply],
  );

  const handleOpenCustomResolution = useCallback(() => {
    push("resolutionCustom");
  }, [push]);

  const handleChange = useCallback(
    (index: number) => {
      const nextOpen = index >= 0;
      if (nextOpen !== openRef.current) {
        openRef.current = nextOpen;
        setIsOpen(nextOpen);
      }
      if (!nextOpen) resetTo({ route: "rendraBatchCount" });
    },
    [resetTo],
  );

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!openRef.current) return false;
      back();
      return true;
    });
    return () => sub.remove();
  }, [back]);

  const backdropCloseDisabled =
    stack[stack.length - 1].route === "rendraBatchCount";
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior={
          hasCloseGuard ? 0 : backdropCloseDisabled ? "none" : "close"
        }
        onPress={hasCloseGuard ? close : undefined}
      />
    ),
    [backdropCloseDisabled, close, hasCloseGuard],
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
      isOpen,
    }),
    [
      open,
      openMetadataImport,
      openCharacterPosition,
      openPreciseMode,
      push,
      back,
      close,
      isOpen,
    ],
  );

  const current = stack[stack.length - 1];
  const route = current.route;
  const snapPoints = RENDRA_SNAP_POINTS[route];
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

  useEffect(() => {
    if (!openRequest || openRequest.route !== route) return;

    // Open only after the requested route and its snap points are committed.
    sheetRef.current?.snapToIndex(0);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [openRequest, route]);

  const routeEntering =
    transitionDirection === "forward"
      ? ROUTE_ENTER_FORWARD
      : transitionDirection === "back"
        ? ROUTE_ENTER_BACK
        : undefined;

  const footerBottomInset =
    Math.max(insets.bottom, tokens.space[4]) + tokens.space[4];
  const draftFooterStyle = useMemo(
    () => [rendraSheetStyles.footer, { paddingBottom: footerBottomInset }],
    [footerBottomInset],
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
        apply(currentStack.slice(0, -1), "back");
      } else {
        forceClose();
      }
      return;
    }
    forceClose();
  }, [apply, forceClose, route]);

  return (
    <AppSheetContext.Provider value={value}>
      {children}
      <BottomSheet
        ref={sheetRef}
        index={-1}
        snapPoints={snapPoints}
        enableContentPanningGesture={route !== "rendraBatchCount"}
        enableHandlePanningGesture
        enablePanDownToClose={!hasCloseGuard}
        backdropComponent={renderBackdrop}
        style={rendraSheetStyles.sheetContainer}
        containerStyle={rendraSheetStyles.sheetContainer}
        backgroundStyle={[
          rendraSheetStyles.sheetBackground,
          (route === "metadataView" || route === "metadataImport") &&
            rendraSheetStyles.metadataSheetBackground,
        ]}
        handleIndicatorStyle={rendraSheetStyles.sheetHandle}
        enableDynamicSizing={false}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        onChange={handleChange}
      >
        <View style={rendraSheetStyles.layout}>
          <Reanimated.View
            key={`header-${route}`}
            entering={routeEntering}
            style={rendraSheetStyles.routeContent}
          >
            <Reanimated.View
              entering={ROUTE_FADE_IN}
              style={[
                rendraSheetStyles.headerBase,
                rendraSheetStyles.header,
                route === "resolutionCustom" &&
                  rendraSheetStyles.customResolutionHeader,
              ]}
            >
              {canBack && (
                <BottomSheetTouchableOpacity
                  style={rendraSheetStyles.backButton}
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
                style={[
                  rendraSheetStyles.titleBase,
                  rendraSheetStyles.title,
                ]}
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
                  style={rendraSheetStyles.headerAction}
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
            style={rendraSheetStyles.scrollView}
            contentContainerStyle={
              route === "metadataView"
                ? rendraSheetStyles.metadataScrollContent
                : [
                    rendraSheetStyles.scrollContentBase,
                    rendraSheetStyles.scrollContent,
                  ]
            }
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Reanimated.View
              key={route}
              entering={routeEntering}
              style={rendraSheetStyles.routeContent}
            >
              <Reanimated.View
                entering={ROUTE_FADE_IN}
                style={rendraSheetStyles.routeContent}
              >
                {route === "rendraBatchCount" ? (
                  <RendraBatchCountSheet />
                ) : route === "ucPreset" ? (
                  <RendraUcPresetSheet onSelect={close} />
                ) : route === "seed" ? (
                  <RendraSeedSheet
                    onSaveAndClose={forceClose}
                    registerDraft={registerDraft}
                  />
                ) : route === "resolution" ? (
                  <RendraResolutionSheet
                    onSelect={forceClose}
                    onOpenCustom={handleOpenCustomResolution}
                  />
                ) : route === "resolutionCustom" ? (
                  <RendraCustomResolutionSheet registerDraft={registerDraft} />
                ) : route === "characterOrder" ? (
                  <RendraCharacterOrderSheet registerDraft={registerDraft} />
                ) : route === "characterPosition" ? (
                  current.characterId ? (
                    <RendraCharacterPositionSheet
                      characterId={current.characterId}
                    />
                  ) : null
                ) : route === "preciseMode" ? (
                  current.preciseReferenceId ? (
                    <RendraPreciseModeSheet
                      referenceId={current.preciseReferenceId}
                      onSelect={forceClose}
                    />
                  ) : null
                ) : isGenerationOptionRoute(route) ? (
                  <RendraGenerationOptionSheet route={route} onSelect={close} />
                ) : route === "metadataView" ? (
                  current.params ? (
                    <RendraMetadataDetails
                      parsed={currentRecordMetadata}
                      variant="sheet"
                    />
                  ) : null
                ) : route === "metadataImport" ? (
                  current.metadata ? (
                    <RendraMetadataImportSheet
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
              showDraftFooter
                ? draftFooterStyle
                : rendraSheetStyles.footerHidden
            }
          >
            <View style={rendraSheetStyles.footerButton}>
              <RendraPrimaryButton
                label={route === "metadataImport" ? "가져오기" : "저장"}
                disabled={!activeDraft?.canSave}
                onPress={handleDraftFooterSave}
              />
            </View>
          </View>
        </View>
      </BottomSheet>
    </AppSheetContext.Provider>
  );
}

const rendraSheetStyles = StyleSheet.create({
  sheetContainer: {
    zIndex: 100,
    elevation: 100,
  },
  layout: {
    flex: 1,
  },
  sheetBackground: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
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
  customResolutionHeader: {
    paddingLeft: tokens.space[9],
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
    height: RENDRA_FOOTER_HEIGHT,
  },
});
