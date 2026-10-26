import { useMemo } from "react";
import {
  useScrollEventsHandlersDefault,
  type ScrollEventHandlerCallbackType,
  type ScrollEventsHandlersHookType,
} from "@gorhom/bottom-sheet";

// 초기 contentOffset 이벤트는 BottomSheet의 animated ref가 연결되기 전에 도착할 수 있다.
// JS의 ref.current 대신 명령을 실행할 UI 스레드의 native ref를 확인한다.
export const useHistoryScrollEventsHandlers: ScrollEventsHandlersHookType = (
  ref,
  contentOffsetY,
) => {
  const {
    handleOnScroll,
    handleOnBeginDrag,
    handleOnEndDrag,
    handleOnMomentumBegin,
    handleOnMomentumEnd,
  } = useScrollEventsHandlersDefault(ref, contentOffsetY);

  return useMemo(() => {
    const nativeRef = ref as unknown as () => unknown;
    const guard = (handler: ScrollEventHandlerCallbackType | undefined) => {
      if (!handler) return undefined;
      const guarded: ScrollEventHandlerCallbackType = (event, context) => {
        "worklet";
        if (!nativeRef()) return;
        handler(event, context);
      };
      return guarded;
    };
    return {
      handleOnScroll: guard(handleOnScroll),
      handleOnBeginDrag: guard(handleOnBeginDrag),
      handleOnEndDrag: guard(handleOnEndDrag),
      handleOnMomentumBegin: guard(handleOnMomentumBegin),
      handleOnMomentumEnd: guard(handleOnMomentumEnd),
    };
  }, [
    handleOnBeginDrag,
    handleOnEndDrag,
    handleOnMomentumBegin,
    handleOnMomentumEnd,
    handleOnScroll,
    ref,
  ]);
};
