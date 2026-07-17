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
import { BackHandler, StyleSheet, Text } from "react-native";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  BottomSheetTextInput,
  TouchableOpacity as BottomSheetTouchableOpacity,
  type BottomSheetBackdropProps,
  type BottomSheetScrollViewMethods,
} from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
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
import { RendraUcPresetSheet } from "../components/rendra/RendraUcPresetSheet";
import { tokens } from "../styles/tokens";
import { light, styles } from "../screens/home/styles";

// 전역 단일 바텀시트 라우트. 기존 연속 생성/메타데이터 시트와
// Rendra 설정의 짧은 선택 시트가 같은 제스처/백드롭 로직을 공유한다.
export type SheetRoute = "batchCount" | "metadataView" | "ucPreset";

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

type StackEntry = { route: SheetRoute; params?: GenerationRecord };
type TransitionDirection = "forward" | "back" | "none";
type OpenRequest = { id: number; route: SheetRoute };

type AppSheetContextValue = {
  open: (route: SheetRoute, params?: GenerationRecord) => void;
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
const UC_PRESET_SNAP_POINTS = ["44%"];
const ROUTE_ENTER_FORWARD = SlideInRight.duration(140);
const ROUTE_ENTER_BACK = SlideInLeft.duration(140);
const ROUTE_FADE_IN = FadeIn.duration(100);

function titleFor(route: SheetRoute) {
  if (route === "metadataView") return "메타데이터";
  if (route === "ucPreset") return "UC Preset";
  return "연속 생성";
}

export function AppSheetProvider({ children }: { children: ReactNode }) {
  const sheetRef = useRef<BottomSheet>(null);
  const scrollRef = useRef<BottomSheetScrollViewMethods>(null);
  // 네비게이션 스택. 마지막 원소가 현재 라우트. 직접 진입(open)은 길이 1 →
  // 뒤로가기 시 닫힘, 메뉴 경유(push)는 쌓여 뒤로가기 시 pop(이전 복귀).
  const [stack, setStack] = useState<StackEntry[]>([{ route: "batchCount" }]);
  const stackRef = useRef<StackEntry[]>([{ route: "batchCount" }]);
  const [transitionDirection, setTransitionDirection] =
    useState<TransitionDirection>("forward");
  const [openRequest, setOpenRequest] = useState<OpenRequest | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const openRef = useRef(false);

  const apply = useCallback(
    (next: StackEntry[], direction: TransitionDirection) => {
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

  const close = useCallback(() => sheetRef.current?.close(), []);

  const open = useCallback(
    (route: SheetRoute, params?: GenerationRecord) => {
      resetTo({ route, params });
      setOpenRequest((current) => ({
        id: (current?.id ?? 0) + 1,
        route,
      }));
      // 같은 라우트 재진입은 remount 가 안 일어나 스크롤이 잔류 → top 리셋.
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ y: 0, animated: false });
      });
    },
    [resetTo],
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

  // 헤더 백 / Android 백 공통: 쌓인 게 있으면 pop, 없으면 시트 닫기.
  const back = useCallback(() => {
    const s = stackRef.current;
    if (s.length > 1) {
      apply(s.slice(0, -1), "back");
    } else {
      sheetRef.current?.close();
    }
  }, [apply]);

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
        pressBehavior="close"
      />
    ),
    [],
  );

  const value = useMemo<AppSheetContextValue>(
    () => ({ open, push, back, close, isOpen }),
    [open, push, back, close, isOpen],
  );

  const current = stack[stack.length - 1];
  const route = current.route;
  const isRendraRoute = route === "ucPreset";
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

  return (
    <AppSheetContext.Provider value={value}>
      {children}
      <BottomSheet
        ref={sheetRef}
        index={-1}
        snapPoints={isRendraRoute ? UC_PRESET_SNAP_POINTS : SNAP_POINTS}
        enablePanDownToClose
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

        <BottomSheetScrollView
          ref={scrollRef}
          key={route}
          contentContainerStyle={[
            styles.sheetScrollContent,
            isRendraRoute && rendraSheetStyles.scrollContent,
          ]}
          showsVerticalScrollIndicator={false}
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
      </BottomSheet>
    </AppSheetContext.Provider>
  );
}

const rendraSheetStyles = StyleSheet.create({
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
    marginBottom: 4,
    paddingTop: 6,
    paddingHorizontal: tokens.space[14],
  },
  title: {
    paddingLeft: 0,
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.bold,
    fontSize: 24,
    lineHeight: 30,
  },
  scrollContent: {
    paddingHorizontal: tokens.space[8],
    paddingBottom: tokens.space[12],
    gap: 0,
  },
});
