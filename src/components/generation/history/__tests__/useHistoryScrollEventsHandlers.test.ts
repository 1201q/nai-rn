import { renderHook } from "@testing-library/react-native";
import type {
  ScrollEventHandlerCallbackType,
  ScrollEventsHandlersHookType,
} from "@gorhom/bottom-sheet";

import { createHistoryScrollEventsHandlers } from "../useHistoryScrollEventsHandlers";

const mockHandlers = {
  handleOnScroll: jest.fn(),
  handleOnBeginDrag: jest.fn(),
  handleOnEndDrag: jest.fn(),
  handleOnMomentumBegin: jest.fn(),
  handleOnMomentumEnd: jest.fn(),
};
const mockSheet = {
  animatedScrollableStatus: { value: 0 },
  animatedHandleGestureState: { value: 0 },
};

jest.mock("react-native-reanimated", () => ({
  useSharedValue: (value: number) => ({ value }),
}));
jest.mock("react-native-gesture-handler", () => ({
  State: { ACTIVE: 4 },
}));
jest.mock("@gorhom/bottom-sheet", () => ({
  SCROLLABLE_STATUS: { LOCKED: 0, UNLOCKED: 1, UNDETERMINED: 2 },
  useBottomSheetInternal: () => mockSheet,
  useScrollEventsHandlersDefault: () => mockHandlers,
}));

const LOCKED = 0;
const UNLOCKED = 1;
const HANDLE_ACTIVE = 4;

function render(restingOffset = { value: 0 }) {
  const useHandlers = createHistoryScrollEventsHandlers(
    restingOffset as Parameters<typeof createHistoryScrollEventsHandlers>[0],
  );
  const ref = Object.assign(() => ({}), { current: {} });
  return renderHook(() =>
    useHandlers(
      ref as unknown as Parameters<ScrollEventsHandlersHookType>[0],
      { value: 0 } as Parameters<ScrollEventsHandlersHookType>[1],
    ),
  );
}

function scrollEvent(y: number) {
  return {
    contentOffset: { x: 0, y },
  } as Parameters<ScrollEventHandlerCallbackType>[0];
}

beforeEach(() => {
  Object.values(mockHandlers).forEach((handler) => handler.mockClear());
  mockSheet.animatedScrollableStatus.value = LOCKED;
  mockSheet.animatedHandleGestureState.value = 0;
});

test.each(Object.keys(mockHandlers) as (keyof typeof mockHandlers)[])(
  "%s waits for the UI ref, preserves event context, and ignores detached refs",
  async (name) => {
    let nativeNode: object | null = null;
    // JS .current can already exist while the UI thread's shadow node is not ready.
    const ref = Object.assign(() => nativeNode, { current: {} });
    const useHandlers = createHistoryScrollEventsHandlers({
      value: 0,
    } as Parameters<typeof createHistoryScrollEventsHandlers>[0]);
    const { result } = await renderHook(() =>
      useHandlers(
        ref as unknown as Parameters<ScrollEventsHandlersHookType>[0],
        { value: 0 } as Parameters<ScrollEventsHandlersHookType>[1],
      ),
    );
    const event = scrollEvent(180);
    const context = { initialContentOffsetY: 180 };
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

test("locks at the restored offset while the sheet is opening", async () => {
  const { result } = await render({ value: 720 });
  const context: Record<string, unknown> = {};

  result.current.handleOnScroll!(scrollEvent(0), context as never);

  expect(context).toMatchObject({
    shouldLockInitialPosition: true,
    initialContentOffsetY: 720,
  });
});

test("remembers the last unlocked offset for the closing animation", async () => {
  const restingOffset = { value: 720 };
  const { result } = await render(restingOffset);
  const context: Record<string, unknown> = {};

  mockSheet.animatedScrollableStatus.value = UNLOCKED;
  result.current.handleOnScroll!(scrollEvent(1500), context as never);
  expect(restingOffset.value).toBe(1500);

  mockSheet.animatedScrollableStatus.value = LOCKED;
  result.current.handleOnScroll!(scrollEvent(1500), context as never);
  expect(context.initialContentOffsetY).toBe(1500);
});

test("keeps the default lock while the user drags the content or handle", async () => {
  const { result } = await render({ value: 720 });
  const context: Record<string, unknown> = {
    shouldLockInitialPosition: false,
    initialContentOffsetY: 0,
  };

  result.current.handleOnBeginDrag!(scrollEvent(0), context as never);
  result.current.handleOnScroll!(scrollEvent(0), context as never);
  expect(context.shouldLockInitialPosition).toBe(false);

  result.current.handleOnEndDrag!(scrollEvent(0), context as never);
  mockSheet.animatedHandleGestureState.value = HANDLE_ACTIVE;
  result.current.handleOnScroll!(scrollEvent(0), context as never);
  expect(context.shouldLockInitialPosition).toBe(false);
});
