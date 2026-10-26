import { renderHook } from "@testing-library/react-native";
import type {
  ScrollEventHandlerCallbackType,
  ScrollEventsHandlersHookType,
} from "@gorhom/bottom-sheet";

import { useHistoryScrollEventsHandlers } from "../useHistoryScrollEventsHandlers";

const mockHandlers = {
  handleOnScroll: jest.fn(),
  handleOnBeginDrag: jest.fn(),
  handleOnEndDrag: jest.fn(),
  handleOnMomentumBegin: jest.fn(),
  handleOnMomentumEnd: jest.fn(),
};

jest.mock("@gorhom/bottom-sheet", () => ({
  useScrollEventsHandlersDefault: () => mockHandlers,
}));

test.each(Object.keys(mockHandlers) as (keyof typeof mockHandlers)[])(
  "%s waits for the UI ref, preserves event context, and ignores detached refs",
  async (name) => {
    let nativeNode: object | null = null;
    // JS .current can already exist while the UI thread's shadow node is not ready.
    const ref = Object.assign(() => nativeNode, { current: {} });
    const { result } = await renderHook(() =>
      useHistoryScrollEventsHandlers(
        ref as unknown as Parameters<ScrollEventsHandlersHookType>[0],
        { value: 0 } as Parameters<ScrollEventsHandlersHookType>[1],
      ),
    );
    const event = {
      contentOffset: { x: 0, y: 180 },
    } as Parameters<ScrollEventHandlerCallbackType>[0];
    const context = { initialContentOffsetY: 180 };
    mockHandlers[name].mockClear();
    result.current[name]!(event, context as never);
    expect(mockHandlers[name]).not.toHaveBeenCalled();

    nativeNode = {};
    result.current[name]!(event, context as never);
    expect(mockHandlers[name]).toHaveBeenCalledWith(event, context);

    nativeNode = null;
    result.current[name]!(event, context as never);
    expect(mockHandlers[name]).toHaveBeenCalledTimes(1);
  },
);
