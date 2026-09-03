import { act, renderHook } from "@testing-library/react-native";
import type { GestureEventPayloadType } from "@gorhom/bottom-sheet/lib/typescript/types";

const { useGestureEventsHandlersDefault } = require(
  "@gorhom/bottom-sheet/lib/commonjs/hooks/useGestureEventsHandlersDefault",
) as typeof import("@gorhom/bottom-sheet");
const {
  ANIMATION_SOURCE,
  GESTURE_SOURCE,
  KEYBOARD_STATUS,
  SCROLLABLE_TYPE,
} = require("@gorhom/bottom-sheet/lib/commonjs/constants") as
  typeof import("@gorhom/bottom-sheet/lib/typescript/constants");

function shared<T>(value: T) {
  return { value, get() { return this.value; } };
}

const mockInternal = {
  animatedPosition: shared(716),
  animatedDetentsState: shared({
    detents: [716, 400, 70],
    highestDetentPosition: 70,
    closedDetentPosition: 844,
  }),
  animatedKeyboardState: shared({ status: KEYBOARD_STATUS.HIDDEN }),
  animatedScrollableState: shared({
    type: SCROLLABLE_TYPE.VIEW,
    contentOffsetY: 0,
    refreshable: false,
  }),
  animatedLayoutState: shared({ window: { height: 844 } }),
  enableOverDrag: false,
  enablePanDownToClose: false,
  isInTemporaryPosition: shared(false),
  animateToPosition: jest.fn(),
  stopAnimation: jest.fn(),
};

jest.mock("@gorhom/bottom-sheet/lib/commonjs/hooks/useBottomSheetInternal", () => ({
  useBottomSheetInternal: () => mockInternal,
}));
jest.mock("react-native-reanimated", () => ({
  Easing: { out: jest.fn(), exp: jest.fn() },
  useSharedValue: (value: unknown) => ({ value }),
  runOnJS: (callback: unknown) => callback,
}));

describe("bottom sheet clamped gesture regression", () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test.each([
    [716, -900, -2000, 70],
    [70, 900, 2000, 716],
  ])("settles a drag from %i even when it already reached its detent", async (
    start, translationY, velocityY, destination,
  ) => {
    mockInternal.animatedPosition.value = start;
    const { result } = await renderHook(useGestureEventsHandlersDefault);
    const event = { translationY, velocityY, absoluteY: 0 } as GestureEventPayloadType;

    await act(() => {
      result.current.handleOnStart(GESTURE_SOURCE.HANDLE, event);
      result.current.handleOnChange(GESTURE_SOURCE.HANDLE, event);
      expect(mockInternal.animatedPosition.value).toBe(destination);
      result.current.handleOnEnd(GESTURE_SOURCE.HANDLE, event);
    });

    expect(mockInternal.animateToPosition).toHaveBeenCalledWith(
      destination, ANIMATION_SOURCE.GESTURE, velocityY / 2,
    );
  });
});
