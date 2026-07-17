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
  BottomSheetTextInput,
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
import { useGenerationStore } from "../store/generationStore";
import { NumericSheetContent } from "../screens/home/NumericSheet";
import { BATCH_COUNT_CONFIG } from "../screens/home/constants";
import { MetadataViewContent } from "../screens/home/MetadataViewContent";
import {
  RendraGenerationOptionSheet,
  type RendraGenerationOptionRoute,
} from "../components/rendra/RendraGenerationOptionSheet";
import { RendraUcPresetSheet } from "../components/rendra/RendraUcPresetSheet";
import { RendraSeedSheet } from "../components/rendra/RendraSeedSheet";
import { RendraResolutionSheet } from "../components/rendra/RendraResolutionSheet";
import { RendraCustomResolutionSheet } from "../components/rendra/RendraCustomResolutionSheet";
import { RendraCharacterPositionSheet } from "../components/rendra/RendraCharacterPositionSheet";
import type { RendraSheetDraftController } from "../components/rendra/RendraSheetDraft";
import { RendraPrimaryButton } from "../components/rendra/RendraButtons";
import { tokens } from "../styles/tokens";
import { light, styles } from "../screens/home/styles";

// 전역 단일 바텀시트 라우트. 기존 연속 생성/메타데이터 시트와
// Rendra 설정의 짧은 선택 시트가 같은 제스처/백드롭 로직을 공유한다.
type RendraSheetRoute =
  | "ucPreset"
  | "seed"
  | "resolution"
  | "resolutionCustom"
  | "characterPosition"
  | RendraGenerationOptionRoute;
export type SheetRoute = "batchCount" | "metadataView" | RendraSheetRoute;

// batchCount 는 시트 유지 → 시트 키보드 회피 위해 BottomSheetTextInput 주입.
function BatchCountSheet() {
  const batchCount = useGenerationStore((s) => s.batchCount);
  const setBatchCount = useGenerationStore((s) => s.setBatchCount);
  return (
    <NumericSheetContent
      value={batchCount}
      onChange={setBatchCount}
      cfg={BATCH_COUNT_CONFIG}
      showTitle={false}
      InputComponent={BottomSheetTextInput}
    />
  );
}

type StackEntry = {
  route: SheetRoute;
  params?: GenerationRecord;
  characterId?: string;
};
type TransitionDirection = "forward" | "back" | "none";
type OpenRequest = { id: number; route: SheetRoute };

type AppSheetContextValue = {
  open: (route: SheetRoute, params?: GenerationRecord) => void;
  openCharacterPosition: (characterId: string) => void;
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

// 고정 2포인트 — 라우트 전환 시 리사이즈 금지(과거 높이-측정 버그 회피).
const SNAP_POINTS = ["60%", "92%"];
const RENDRA_SNAP_POINTS: Record<RendraSheetRoute, string[]> = {
  ucPreset: ["44%"],
  seed: ["44%"],
  resolution: ["68%"],
  resolutionCustom: ["68%"],
  characterPosition: ["68%"],
  model: ["50%"],
  sampler: ["64%"],
  schedule: ["44%"],
};
const ROUTE_ENTER_FORWARD = SlideInRight.duration(140);
const ROUTE_ENTER_BACK = SlideInLeft.duration(140);
const ROUTE_FADE_IN = FadeIn.duration(100);
const RENDRA_FOOTER_HEIGHT = 52;

function titleFor(route: SheetRoute) {
  if (route === "metadataView") return "메타데이터";
  if (route === "ucPreset") return "UC Preset";
  if (route === "seed") return "Seed";
  if (route === "resolution") return "Resolution";
  if (route === "resolutionCustom") return "Custom Resolution";
  if (route === "characterPosition") return "Character Position";
  if (route === "model") return "Model";
  if (route === "sampler") return "Sampler";
  if (route === "schedule") return "Schedule";
  return "연속 생성";
}

function isRendraSheetRoute(route: SheetRoute): route is RendraSheetRoute {
  return (
    route === "ucPreset" ||
    route === "seed" ||
    route === "resolution" ||
    route === "resolutionCustom" ||
    route === "characterPosition" ||
    route === "model" ||
    route === "sampler" ||
    route === "schedule"
  );
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
  const [stack, setStack] = useState<StackEntry[]>([{ route: "batchCount" }]);
  const stackRef = useRef<StackEntry[]>([{ route: "batchCount" }]);
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

  const openCharacterPosition = useCallback(
    (characterId: string) => {
      openEntry({ route: "characterPosition", characterId });
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
      // 닫힐 때 스택 초기화(기본 batchCount).
      if (!nextOpen) resetTo({ route: "batchCount" });
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

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior={hasCloseGuard ? 0 : "close"}
        onPress={hasCloseGuard ? close : undefined}
      />
    ),
    [close, hasCloseGuard],
  );

  const value = useMemo<AppSheetContextValue>(
    () => ({ open, openCharacterPosition, push, back, close, isOpen }),
    [open, openCharacterPosition, push, back, close, isOpen],
  );

  const current = stack[stack.length - 1];
  const route = current.route;
  const isRendraRoute = isRendraSheetRoute(route);
  const snapPoints = isRendraRoute ? RENDRA_SNAP_POINTS[route] : SNAP_POINTS;
  const canBack = stack.length > 1;

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
  const showDraftFooter = route === "seed" || route === "resolutionCustom";
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
        enablePanDownToClose={!hasCloseGuard}
        backdropComponent={renderBackdrop}
        style={styles.sheetContainer}
        containerStyle={styles.sheetContainer}
        backgroundStyle={
          isRendraRoute
            ? rendraSheetStyles.sheetBackground
            : styles.sheetBackground
        }
        handleIndicatorStyle={
          isRendraRoute ? rendraSheetStyles.sheetHandle : styles.sheetHandle
        }
        enableDynamicSizing={false}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        onChange={handleChange}
      >
        <View style={rendraSheetStyles.layout}>
          <Reanimated.View
            key={`header-${route}`}
            entering={routeEntering}
            style={styles.sheetRouteContent}
          >
            <Reanimated.View
              entering={ROUTE_FADE_IN}
              style={[
                styles.sheetBackHeader,
                isRendraRoute && rendraSheetStyles.header,
                route === "resolutionCustom" &&
                  rendraSheetStyles.customResolutionHeader,
              ]}
            >
              {canBack && (
                <BottomSheetTouchableOpacity
                  style={styles.sheetBackButton}
                  onPress={back}
                >
                  <Ionicons
                    name="chevron-back"
                    size={22}
                    color={light.textPrimary}
                  />
                </BottomSheetTouchableOpacity>
              )}
              <Text
                style={[
                  styles.sheetBackTitle,
                  isRendraRoute && rendraSheetStyles.title,
                ]}
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
            style={rendraSheetStyles.scrollView}
            contentContainerStyle={[
              styles.sheetScrollContent,
              isRendraRoute && rendraSheetStyles.scrollContent,
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Reanimated.View
              key={route}
              entering={routeEntering}
              style={styles.sheetRouteContent}
            >
              <Reanimated.View
                entering={ROUTE_FADE_IN}
                style={styles.sheetRouteContent}
              >
                {route === "ucPreset" ? (
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
                ) : route === "characterPosition" ? (
                  current.characterId ? (
                    <RendraCharacterPositionSheet
                      characterId={current.characterId}
                    />
                  ) : null
                ) : isGenerationOptionRoute(route) ? (
                  <RendraGenerationOptionSheet route={route} onSelect={close} />
                ) : route === "metadataView" ? (
                  current.params ? (
                    <MetadataViewContent record={current.params} />
                  ) : null
                ) : (
                  <BatchCountSheet />
                )}
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
                label="저장"
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
  layout: {
    flex: 1,
  },
  sheetBackground: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    backgroundColor: tokens.color.card,
  },
  sheetHandle: {
    width: 36,
    height: 5,
    backgroundColor: tokens.color.borderSubtleStrong,
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
  title: {
    paddingLeft: 0,
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontWeight: "400",
    fontSize: 24,
    lineHeight: 30,
  },
  scrollContent: {
    paddingHorizontal: tokens.space[6],
    paddingBottom: tokens.space[12],
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
