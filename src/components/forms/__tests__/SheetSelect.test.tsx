import { useEffect, useState } from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import { BackHandler, Platform, StyleSheet, useWindowDimensions } from "react-native";

import { usePredictiveBackHandler } from "../../../native/predictiveBack";
import { SheetSelect } from "../SheetSelect";

const mockMeasure = jest.fn();
let mockPredictiveSupported = false;

jest.mock("react-native/Libraries/Components/Pressable/Pressable", () => {
  const React = require("react") as typeof import("react");
  const { default: Pressable } = jest.requireActual(
    "react-native/Libraries/Components/Pressable/Pressable",
  );
  return {
    __esModule: true,
    default: React.forwardRef(function MeasuredPressable(props, ref) {
      React.useImperativeHandle(ref, () => ({ measureInWindow: mockMeasure }));
      return React.createElement(Pressable, props);
    }),
  };
});
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("@gorhom/portal", () => ({
  Portal: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("../../../native/predictiveBack", () => ({
  get PREDICTIVE_BACK_SUPPORTED() { return mockPredictiveSupported; },
  usePredictiveBackHandler: jest.fn(),
}));
jest.mock("react-native-reanimated", () => {
  const React = require("react") as typeof import("react");
  const { View } = require("react-native") as typeof import("react-native");
  return {
    __esModule: true,
    default: { View },
    Extrapolation: { CLAMP: "clamp" },
    interpolate: () => 1,
    useSharedValue: <T,>(value: T) => React.useRef({ value }).current,
    useAnimatedStyle: (factory: () => object) => factory(),
    cancelAnimation: jest.fn(),
    withSpring: <T,>(value: T) => value,
  };
});

const options = ["Model A", "Model B"];
const mockChange = jest.fn();
const mockOuterBack = jest.fn(() => true);
const backListeners: Array<() => boolean | null | undefined> = [];
const mockDimensions = jest.mocked(useWindowDimensions);
const originalPlatform = Platform.OS;

function setWindow(width: number, height = 844) {
  mockDimensions.mockReturnValue({ width, height, scale: 1, fontScale: 1 });
}

function ControlledSelect() {
  const [open, setOpen] = useState(false);
  return <SheetSelect label="Model" value={options[0]} options={options}
    onChange={mockChange} open={open} onOpenChange={setOpen} />;
}

function SheetWithSelect() {
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", mockOuterBack);
    return () => subscription.remove();
  }, []);
  return <ControlledSelect />;
}

function pressBack() {
  // Match React Native's last-registered-first dispatch and consumption.
  for (const listener of [...backListeners].reverse()) {
    if (listener()) return true;
  }
  return false;
}

function menuLayout(screen: Awaited<ReturnType<typeof render>>) {
  const option = screen.getByLabelText("Model B");
  let parent = option.parent;
  while (parent) {
    const style = StyleSheet.flatten(parent.props.style);
    if (style?.position === "absolute" && typeof style.width === "number") return style;
    parent = parent.parent;
  }
  throw new Error("Options container not found");
}

describe("SheetSelect boundaries and back handling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = "android";
    mockPredictiveSupported = false;
    backListeners.length = 0;
    setWindow(390);
    mockMeasure.mockImplementation((callback) => callback(24, 100, 200, 46));
    jest.spyOn(BackHandler, "addEventListener").mockImplementation((_event, handler) => {
      const listener = handler as () => boolean | null | undefined;
      backListeners.push(listener);
      return { remove: () => {
        const index = backListeners.indexOf(listener);
        if (index !== -1) backListeners.splice(index, 1);
      } };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    Platform.OS = originalPlatform;
  });

  test.each([
    [390, 24, 200, 24, 200],
    [390, 200, 80, 200, 148],
    [390, 300, 60, 212, 148],
    [390, 370, 40, 230, 148],
    [390, -20, 80, 12, 148],
    [390, 24, 500, 12, 366],
    [160, 100, 40, 12, 136],
    [320, 228, 80, 160, 148],
  ])("clamps width %i, anchor x %i / width %i to left %i / width %i",
    async (windowWidth, x, width, expectedLeft, expectedWidth) => {
      setWindow(windowWidth);
      mockMeasure.mockImplementation((callback) => callback(x, 100, width, 46));
      const screen = await render(<ControlledSelect />);
      await fireEvent.press(screen.getByLabelText("Model 선택"));

      expect(menuLayout(screen)).toMatchObject({ left: expectedLeft, width: expectedWidth, top: 154 });
    },
  );

  test("reclamps an open menu when the window shrinks", async () => {
    mockMeasure.mockImplementation((callback) => callback(500, 100, 200, 46));
    setWindow(844);
    const screen = await render(<ControlledSelect />);
    await fireEvent.press(screen.getByLabelText("Model 선택"));
    expect(menuLayout(screen)).toMatchObject({ left: 500, width: 200 });

    setWindow(320);
    await screen.rerender(<ControlledSelect />);
    expect(menuLayout(screen)).toMatchObject({ left: 108, width: 200 });
  });

  test("keeps the existing vertical bottom boundary", async () => {
    mockMeasure.mockImplementation((callback) => callback(24, 800, 200, 46));
    const screen = await render(<ControlledSelect />);
    await fireEvent.press(screen.getByLabelText("Model 선택"));
    expect(menuLayout(screen).top).toBe(742);
  });

  test("closes only the select before passing the next back to its outer sheet", async () => {
    const screen = await render(<SheetWithSelect />);
    expect(backListeners).toHaveLength(1);
    await fireEvent.press(screen.getByLabelText("Model 선택"));
    await act(() => { expect(pressBack()).toBe(true); });

    expect(screen.queryByLabelText("Model B")).toBeNull();
    expect(screen.getByLabelText("Model 선택").props.accessibilityState.expanded).toBe(false);
    expect(mockOuterBack).not.toHaveBeenCalled();
    expect(mockChange).not.toHaveBeenCalled();
    expect(backListeners).toHaveLength(1);

    await act(() => { pressBack(); });
    expect(mockOuterBack).toHaveBeenCalledTimes(1);
  });

  test("removes the fallback on unmount and restores it on reopen", async () => {
    const screen = await render(<ControlledSelect />);
    await fireEvent.press(screen.getByLabelText("Model 선택"));
    expect(backListeners).toHaveLength(1);
    await fireEvent.press(screen.getByLabelText("Model 선택 닫기"));
    expect(backListeners).toHaveLength(0);
    await fireEvent.press(screen.getByLabelText("Model 선택"));
    expect(backListeners).toHaveLength(1);
    await screen.unmount();
    expect(backListeners).toHaveLength(0);
  });

  test("supports uncontrolled selection and releases its back handler", async () => {
    const screen = await render(<SheetSelect label="Model" value={options[0]}
      options={options} onChange={mockChange} variant="compact" />);
    await fireEvent.press(screen.getByLabelText("Model 선택"));
    expect(backListeners).toHaveLength(1);
    await fireEvent.press(screen.getByLabelText("Model B"));
    expect(mockChange).toHaveBeenCalledWith("Model B");
    expect(screen.queryByLabelText("Model B")).toBeNull();
    expect(backListeners).toHaveLength(0);
  });

  test("keeps predictive cancel open and closes on commit without a duplicate fallback", async () => {
    mockPredictiveSupported = true;
    const screen = await render(<ControlledSelect />);
    await fireEvent.press(screen.getByLabelText("Model 선택"));
    expect(backListeners).toHaveLength(0);
    const [enabled, handlers] = jest.mocked(usePredictiveBackHandler).mock.calls.at(-1)!;
    expect(enabled).toBe(true);
    await act(() => { handlers.onCancel?.(); });
    expect(screen.getByLabelText("Model B")).toBeTruthy();
    await act(() => { handlers.onCommit?.(); });
    expect(screen.queryByLabelText("Model B")).toBeNull();
    expect(mockChange).not.toHaveBeenCalled();
  });

  test.each(["ios", "web"] as const)("does not install an Android fallback on %s", async (os) => {
    Platform.OS = os;
    const screen = await render(<ControlledSelect />);
    await fireEvent.press(screen.getByLabelText("Model 선택"));
    expect(backListeners).toHaveLength(0);
  });
});
