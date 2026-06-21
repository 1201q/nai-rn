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
import { BackHandler, Text } from "react-native";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
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
import {
  DETAIL_TITLES,
  renderOptionRoute,
  type OptionRoute,
} from "../screens/home/OptionsSheet";
import { MetadataViewContent } from "../screens/home/MetadataViewContent";
import { light, styles } from "../screens/home/styles";

// 전역 단일 바텀시트의 모든 라우트. 옵션 라우트 + 메타데이터 뷰어.
export type SheetRoute = OptionRoute | "metadataView";

type StackEntry = { route: SheetRoute; params?: GenerationRecord };
type TransitionDirection = "forward" | "back" | "none";

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
const ROUTE_ENTER_FORWARD = SlideInRight.duration(140);
const ROUTE_ENTER_BACK = SlideInLeft.duration(140);
const ROUTE_FADE_IN = FadeIn.duration(100);

function titleFor(route: SheetRoute) {
  if (route === "menu") return "Options";
  if (route === "metadataView") return "메타데이터";
  return DETAIL_TITLES[route] ?? "";
}

export function AppSheetProvider({ children }: { children: ReactNode }) {
  const sheetRef = useRef<BottomSheet>(null);
  const scrollRef = useRef<BottomSheetScrollViewMethods>(null);
  // 네비게이션 스택. 마지막 원소가 현재 라우트. 직접 진입(open)은 길이 1 →
  // 뒤로가기 시 닫힘, 메뉴 경유(push)는 쌓여 뒤로가기 시 pop(이전 복귀).
  const [stack, setStack] = useState<StackEntry[]>([{ route: "menu" }]);
  const stackRef = useRef<StackEntry[]>([{ route: "menu" }]);
  const [transitionDirection, setTransitionDirection] =
    useState<TransitionDirection>("forward");
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

  // 직접 진입: 스택 초기화. menu 면 루트(기존 등장 애니), 아니면 단일 상세 —
  // 이전 화면이 없으므로 슬라이드 전환 없음("none").
  const resetTo = useCallback(
    (entry: StackEntry) => {
      apply([entry], entry.route === "menu" ? "back" : "none");
    },
    [apply],
  );

  const close = useCallback(() => sheetRef.current?.close(), []);

  const open = useCallback(
    (route: SheetRoute, params?: GenerationRecord) => {
      resetTo({ route, params });
      sheetRef.current?.snapToIndex(0);
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
      // 닫힐 때 다음 열림 기본값은 항상 메뉴부터.
      if (!nextOpen) resetTo({ route: "menu" });
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
  const canBack = stack.length > 1;
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
        snapPoints={SNAP_POINTS}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        style={styles.sheetContainer}
        containerStyle={styles.sheetContainer}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.sheetHandle}
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
          <Reanimated.View entering={ROUTE_FADE_IN} style={styles.sheetBackHeader}>
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
            <Text style={styles.sheetBackTitle} numberOfLines={1}>
              {titleFor(route)}
            </Text>
          </Reanimated.View>
        </Reanimated.View>

        <BottomSheetScrollView
          ref={scrollRef}
          key={route}
          contentContainerStyle={styles.sheetScrollContent}
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
              {route === "metadataView" ? (
                current.params ? (
                  <MetadataViewContent record={current.params} />
                ) : null
              ) : (
                renderOptionRoute(route, {
                  back,
                  close,
                  push: (r) => push(r),
                })
              )}
            </Reanimated.View>
          </Reanimated.View>
        </BottomSheetScrollView>
      </BottomSheet>
    </AppSheetContext.Provider>
  );
}
