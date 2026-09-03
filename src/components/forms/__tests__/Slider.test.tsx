import { useState } from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import { runOnJS, type SharedValue } from "react-native-reanimated";

import { Slider } from "../Slider";

type GestureHandlers = Record<string, (...args: any[]) => void>;
let mockPan: GestureHandlers;
let mockTap: GestureHandlers;

jest.mock("expo-haptics", () => ({ selectionAsync: jest.fn().mockResolvedValue(undefined) }));
jest.mock("sonner-native", () => ({ toast: jest.fn() }));
jest.mock("react-native-gesture-handler", () => {
  function gesture(handlers: GestureHandlers) {
    const builder: Record<string, jest.Mock> = {};
    for (const name of ["activeOffsetX", "failOffsetY", "onStart", "onUpdate", "onFinalize", "onEnd"]) {
      builder[name] = jest.fn((callback) => {
        if (typeof callback === "function") handlers[name] = callback;
        return builder;
      });
    }
    return builder;
  }
  return {
    GestureDetector: ({ children }: { children: React.ReactNode }) => children,
    Gesture: {
      Pan: () => gesture(mockPan = {}),
      Tap: () => gesture(mockTap = {}),
      Exclusive: jest.fn(),
    },
  };
});
jest.mock("react-native-reanimated", () => {
  const React = require("react") as typeof import("react");
  const { View } = require("react-native") as typeof import("react-native");
  return {
    __esModule: true,
    default: { View },
    useSharedValue: <T,>(value: T) => React.useRef({ value }).current,
    useAnimatedStyle: (factory: () => object) => factory(),
    withSpring: <T,>(value: T) => value,
    runOnJS: jest.fn((callback) => callback),
  };
});

const defaults = {
  accessibilityLabel: "Steps", value: 5, min: 1, max: 10, step: 1, precision: 0,
};

function ControlledSlider() {
  const [value, setValue] = useState(5);
  return <Slider {...defaults} value={value} onSlidingComplete={setValue} />;
}

describe("Slider accessibility and drag updates", () => {
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => jest.restoreAllMocks());

  test("announces the label, range, current value and adjustment actions", async () => {
    const screen = await render(<ControlledSlider />);
    const slider = screen.getByRole("adjustable", { name: "Steps" });
    expect(slider.props.accessibilityValue).toEqual({ min: 1, max: 10, now: 5, text: "5" });
    expect(slider.props.accessibilityActions.map((action: { name: string }) => action.name))
      .toEqual(["increment", "decrement"]);
    await fireEvent(slider, "accessibilityAction", { nativeEvent: { actionName: "increment" } });
    expect(screen.getByRole("adjustable").props.accessibilityValue.now).toBe(6);
    await fireEvent(screen.getByRole("adjustable"), "accessibilityAction", {
      nativeEvent: { actionName: "decrement" },
    });
    expect(screen.getByRole("adjustable").props.accessibilityValue.now).toBe(5);
  });

  test.each([
    [1, "decrement"], [10, "increment"], [5, "activate"],
  ])("does not commit value %i for %s", async (value, actionName) => {
    const commit = jest.fn();
    const screen = await render(<Slider {...defaults} value={value} onSlidingComplete={commit} />);
    await fireEvent(screen.getByRole("adjustable"), "accessibilityAction", {
      nativeEvent: { actionName },
    });
    expect(commit).not.toHaveBeenCalled();
    expect(Haptics.selectionAsync).not.toHaveBeenCalled();
  });

  test("accumulates decimal accessibility actions before a parent render", async () => {
    const commit = jest.fn();
    const display = { value: 0.94 } as SharedValue<number>;
    const screen = await render(<Slider {...defaults} value={0.94} min={0} max={1}
      step={0.02} precision={2} display={display} onSlidingComplete={commit} />);
    const adjust = screen.getByRole("adjustable").props.onAccessibilityAction;
    await act(() => {
      for (let i = 0; i < 5; i++) adjust({ nativeEvent: { actionName: "increment" } });
    });
    expect(commit.mock.calls).toEqual([[0.96], [0.98], [1]]);
    expect(display.value).toBe(1);
  });

  test.each([false, true])("uses a new external value with layout measured: %s", async (measured) => {
    const commit = jest.fn();
    const screen = await render(<Slider {...defaults} onSlidingComplete={commit} />);
    if (measured) {
      await fireEvent(screen.getByRole("adjustable"), "layout", {
        nativeEvent: { layout: { width: 122 } },
      });
    }
    await screen.rerender(<Slider {...defaults} value={8} onSlidingComplete={commit} />);
    await fireEvent(screen.getByRole("adjustable"), "accessibilityAction", {
      nativeEvent: { actionName: "decrement" },
    });
    expect(commit).toHaveBeenLastCalledWith(7);
  });

  test("updates shared display during drag and commits only at finalization", async () => {
    const commit = jest.fn();
    const start = jest.fn();
    const display = { value: 5 } as SharedValue<number>;
    const screen = await render(<Slider {...defaults} display={display}
      onSlidingStart={start} onSlidingComplete={commit} />);
    await fireEvent(screen.getByRole("adjustable"), "layout", {
      nativeEvent: { layout: { width: 122 } },
    });
    await act(() => {
      mockPan.onStart({ x: 11 });
      mockPan.onUpdate({ x: 61 });
      mockPan.onUpdate({ x: 111 });
    });
    expect(start).toHaveBeenCalledTimes(1);
    expect(display.value).toBe(10);
    expect(commit).not.toHaveBeenCalled();
    await act(() => { mockPan.onFinalize(); });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith(10);
  });

  test("limits haptic JS dispatch during fast stepping without dropping values", async () => {
    const now = jest.spyOn(Date, "now").mockReturnValue(1000);
    const change = jest.fn();
    const screen = await render(<Slider {...defaults} onValueChange={change} onSlidingComplete={jest.fn()} />);
    await fireEvent(screen.getByRole("adjustable"), "layout", {
      nativeEvent: { layout: { width: 122 } },
    });
    await act(() => {
      mockPan.onStart({ x: 11 });
      mockPan.onUpdate({ x: 31 });
      mockPan.onUpdate({ x: 61 });
    });
    expect(change).toHaveBeenCalledTimes(3);
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
    now.mockReturnValue(1050);
    await act(() => { mockPan.onUpdate({ x: 111 }); });
    expect(change).toHaveBeenLastCalledWith(10);
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(2);
    expect(jest.mocked(runOnJS).mock.calls.filter(([callback]) => callback === change)).toHaveLength(4);
  });

  test("tap-to-jump starts and commits the bounded value", async () => {
    const start = jest.fn();
    const commit = jest.fn();
    const screen = await render(<Slider {...defaults} jumpOnTap
      onSlidingStart={start} onSlidingComplete={commit} />);
    await fireEvent(screen.getByRole("adjustable"), "layout", {
      nativeEvent: { layout: { width: 122 } },
    });
    await act(() => { mockTap.onEnd({ x: 300 }, true); });
    expect(start).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith(10);
  });

  test("failed gestures do not start or commit", async () => {
    const start = jest.fn();
    const commit = jest.fn();
    await render(<Slider {...defaults} jumpOnTap onSlidingStart={start} onSlidingComplete={commit} />);
    await act(() => {
      mockTap.onEnd({ x: 100 }, false);
      mockPan.onFinalize();
    });
    expect(start).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
  });
});
