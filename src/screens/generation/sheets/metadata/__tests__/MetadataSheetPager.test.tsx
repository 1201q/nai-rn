import { act, fireEvent, render } from "@testing-library/react-native";

import type { GenerationRecord } from "../../../../../lib/generationHistory";
import {
  MetadataSheetPager,
  useMetadataSheetPagerController,
} from "../MetadataSheetPager";

const mockGestureCallbacks: Record<string, (...args: any[]) => void> = {};

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 390, height: 844, scale: 1, fontScale: 1 }),
}));
jest.mock("react-native-gesture-handler", () => {
  const React = require("react") as typeof import("react");
  const { View } = require("react-native") as typeof import("react-native");
  return {
    GestureDetector: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
    Gesture: {
      Pan: () => {
        const gesture: Record<string, jest.Mock> = {};
        for (const method of [
          "enabled",
          "activeOffsetX",
          "failOffsetY",
          "shouldCancelWhenOutside",
          "onStart",
          "onUpdate",
          "onEnd",
          "onFinalize",
        ]) {
          gesture[method] = jest.fn((callback: (...args: any[]) => void) => {
            if (method.startsWith("on"))
              mockGestureCallbacks[method] = callback;
            return gesture;
          });
        }
        return gesture;
      },
    },
  };
});
jest.mock("react-native-reanimated", () => {
  const React = require("react") as typeof import("react");
  const { View } = require("react-native") as typeof import("react-native");
  return {
    __esModule: true,
    default: { View },
    cancelAnimation: jest.fn(),
    Easing: { bezier: () => jest.fn() },
    Extrapolation: { CLAMP: "clamp" },
    interpolate: jest.fn(),
    runOnJS: (callback: (...args: any[]) => void) => callback,
    useAnimatedStyle: (factory: () => object) => factory(),
    useSharedValue: <T,>(value: T) => React.useRef({ value }).current,
    withTiming: <T,>(value: T) => value,
  };
});
jest.mock("../MetadataSheetContent", () => {
  const React = require("react") as typeof import("react");
  const { Text } = require("react-native") as typeof import("react-native");
  return {
    MetadataSheetContent: () =>
      React.createElement(Text, null, "metadata body"),
  };
});
jest.mock("../MetadataImportContent", () => {
  const React = require("react") as typeof import("react");
  const { Text } = require("react-native") as typeof import("react-native");
  return {
    MetadataImportContent: () => React.createElement(Text, null, "import body"),
  };
});

const generation = {
  id: "generation-1",
} as GenerationRecord;

function TestMetadataSheetPager() {
  const controller = useMetadataSheetPagerController();
  return (
    <MetadataSheetPager
      generation={generation}
      onClose={jest.fn()}
      controller={controller}
    />
  );
}

describe("MetadataSheetPager", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const key of Object.keys(mockGestureCallbacks)) {
      delete mockGestureCallbacks[key];
    }
  });

  test("switches pages from tabs and horizontal swipes", async () => {
    const screen = await render(<TestMetadataSheetPager />);

    expect(
      screen.getByRole("tab", { name: "Metadata" }).props.accessibilityState,
    ).toMatchObject({ selected: true });
    expect(
      screen.getByTestId("metadata-page-import", {
        includeHiddenElements: true,
      }).props,
    ).toMatchObject({ accessibilityElementsHidden: true });

    await fireEvent.press(screen.getByRole("tab", { name: "Import" }));
    expect(
      screen.getByRole("tab", { name: "Import" }).props.accessibilityState,
    ).toMatchObject({ selected: true });

    await fireEvent.press(screen.getByRole("tab", { name: "Metadata" }));
    await act(() => {
      mockGestureCallbacks.onEnd({ translationX: -120, velocityX: 0 });
    });
    expect(
      screen.getByRole("tab", { name: "Import" }).props.accessibilityState,
    ).toMatchObject({ selected: true });
    expect(screen.getByTestId("metadata-page-import").props).toMatchObject({
      accessibilityElementsHidden: false,
      importantForAccessibility: "auto",
    });
  });

  test("applies rubber-band resistance past the first and last pages", async () => {
    const screen = await render(<TestMetadataSheetPager />);
    const trackStyle = () =>
      screen.getByTestId("metadata-page-metadata", {
        includeHiddenElements: true,
      }).parent!.props.style;
    const translateX = () =>
      (
        [trackStyle()].flat(3).find((style) => style?.transform) as {
          transform: [{ translateX: number }];
        }
      ).transform[0].translateX;

    await act(() => {
      mockGestureCallbacks.onStart();
      mockGestureCallbacks.onUpdate({ translationX: 100 });
    });
    await screen.rerender(<TestMetadataSheetPager />);
    expect(translateX()).toBe(20);

    await act(() => {
      mockGestureCallbacks.onUpdate({ translationX: -490 });
    });
    await screen.rerender(<TestMetadataSheetPager />);
    expect(translateX()).toBe(-410);

    await act(() => {
      mockGestureCallbacks.onUpdate({ translationX: -200 });
    });
    await screen.rerender(<TestMetadataSheetPager />);
    expect(translateX()).toBe(-200);
  });

  test("changes pages by distance or velocity and clamps at the ends", async () => {
    const screen = await render(<TestMetadataSheetPager />);
    const selected = (name: string) =>
      screen.getByRole("tab", { name }).props.accessibilityState.selected;

    await act(() => {
      mockGestureCallbacks.onEnd({ translationX: -60, velocityX: 0 });
    });
    expect(selected("Metadata")).toBe(true);

    await act(() => {
      mockGestureCallbacks.onEnd({ translationX: -10, velocityX: -700 });
    });
    expect(selected("Import")).toBe(true);

    await act(() => {
      mockGestureCallbacks.onEnd({ translationX: -200, velocityX: -900 });
    });
    expect(selected("Import")).toBe(true);

    await act(() => {
      mockGestureCallbacks.onEnd({ translationX: 80, velocityX: 0 });
    });
    expect(selected("Metadata")).toBe(true);
  });
});
