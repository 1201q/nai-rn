import { useMemo } from "react";
import { State } from "react-native-gesture-handler";
import { useSharedValue, type SharedValue } from "react-native-reanimated";
import {
  SCROLLABLE_STATUS,
  useBottomSheetInternal,
  useScrollEventsHandlersDefault,
  type ScrollEventHandlerCallbackType,
  type ScrollEventsHandlersHookType,
} from "@gorhom/bottom-sheet";

type HistoryScrollContext = {
  initialContentOffsetY?: number;
  shouldLockInitialPosition?: boolean;
  historyContentDragging?: boolean;
};

// 시트가 펼쳐지지 않은 동안(열기·닫기 애니메이션) BottomSheet는 스크롤을 잠그는데,
// 기본 핸들러는 잠금 위치를 0으로 둔다. 그러면 복원 위치에서 마운트한 리스트가
// 열리는 동안 맨 위로 튀었다가 다 열린 뒤에야 제자리로 돌아온다.
// 사용자가 본문을 끄는 중이 아니면 마지막으로 머문 위치에 잠근다.
export function createHistoryScrollEventsHandlers(
  restingOffset: SharedValue<number>,
): ScrollEventsHandlersHookType {
  return function useHistoryScrollEventsHandlers(ref, contentOffsetY) {
    const { animatedScrollableStatus, animatedHandleGestureState } =
      useBottomSheetInternal();
    const {
      handleOnScroll,
      handleOnBeginDrag,
      handleOnEndDrag,
      handleOnMomentumBegin,
      handleOnMomentumEnd,
    } = useScrollEventsHandlersDefault(ref, contentOffsetY);

    return useMemo(() => {
      // 초기 contentOffset 이벤트는 BottomSheet의 animated ref가 연결되기 전에 도착할 수 있다.
      // JS의 ref.current 대신 명령을 실행할 UI 스레드의 native ref를 확인한다.
      const nativeRef = ref as unknown as () => unknown;
      const guard = (
        handler: ScrollEventHandlerCallbackType | undefined,
        before?: (
          event: Parameters<ScrollEventHandlerCallbackType>[0],
          context: HistoryScrollContext,
        ) => void,
      ) => {
        if (!handler) return undefined;
        const guarded: ScrollEventHandlerCallbackType = (event, context) => {
          "worklet";
          if (!nativeRef()) return;
          before?.(event, context as HistoryScrollContext);
          handler(event, context);
        };
        return guarded;
      };
      return {
        handleOnScroll: guard(handleOnScroll, (event, context) => {
          "worklet";
          if (animatedScrollableStatus.value !== SCROLLABLE_STATUS.LOCKED) {
            restingOffset.value = Math.max(0, event.contentOffset.y);
            return;
          }
          // 핸들 드래그와 본문 드래그(당겨서 닫기)는 기본 동작을 따른다.
          if (
            context.historyContentDragging ||
            animatedHandleGestureState.value === State.ACTIVE
          ) {
            return;
          }
          context.shouldLockInitialPosition = true;
          context.initialContentOffsetY = restingOffset.value;
        }),
        handleOnBeginDrag: guard(handleOnBeginDrag, (_event, context) => {
          "worklet";
          context.historyContentDragging = true;
        }),
        handleOnEndDrag: guard(handleOnEndDrag, (_event, context) => {
          "worklet";
          context.historyContentDragging = false;
        }),
        handleOnMomentumBegin: guard(handleOnMomentumBegin),
        handleOnMomentumEnd: guard(handleOnMomentumEnd),
      };
    }, [
      animatedHandleGestureState,
      animatedScrollableStatus,
      handleOnBeginDrag,
      handleOnEndDrag,
      handleOnMomentumBegin,
      handleOnMomentumEnd,
      handleOnScroll,
      ref,
    ]);
  };
}

// 그리드 인스턴스마다 잠금 위치를 따로 두고, 훅의 정체성은 마운트 동안 유지한다.
export function useHistoryScrollLock(initialOffset: number) {
  const restingOffset = useSharedValue(initialOffset);
  const scrollEventsHandlersHook = useMemo(
    () => createHistoryScrollEventsHandlers(restingOffset),
    [restingOffset],
  );
  return { restingOffset, scrollEventsHandlersHook };
}
