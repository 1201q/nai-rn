import { act, fireEvent, render } from "@testing-library/react-native";
import { Keyboard, Pressable, View } from "react-native";
import type {
  BottomSheetBackdropProps,
  BottomSheetProps,
} from "@gorhom/bottom-sheet";

import { AppSheetProvider, useAppSheet } from "../AppSheetContext";

const mockSheetProps = jest.fn<void, [BottomSheetProps]>();
const mockSheetClose = jest.fn();
const mockPredictiveBack = jest.fn();

jest.mock("@gorhom/bottom-sheet", () => {
  const React = require("react") as typeof import("react");
  const { View, ScrollView, Pressable } =
    require("react-native") as typeof import("react-native");
  return {
    __esModule: true,
    default: React.forwardRef(function MockSheet(props: BottomSheetProps, ref) {
      mockSheetProps(props);
      React.useImperativeHandle(ref, () => ({ close: mockSheetClose }));
      return React.createElement(
        View,
        null,
        props.backdropComponent
          ? React.createElement(props.backdropComponent, {
              animatedIndex: { value: 0 },
              animatedPosition: { value: 0 },
            } as BottomSheetBackdropProps)
          : null,
        props.children as React.ReactNode,
      );
    }),
    BottomSheetScrollView: ScrollView,
    BottomSheetBackdrop: ({ onPress }: { onPress?: () => void }) =>
      React.createElement(Pressable, {
        accessibilityLabel: "Dismiss options",
        onPress,
      }),
  };
});

jest.mock("react-native-reanimated", () => {
  const { View } = require("react-native") as typeof import("react-native");
  return {
    __esModule: true,
    default: { View },
    FadeIn: { duration: () => ({}) },
  };
});
jest.mock("../../native/predictiveBack", () => ({
  usePredictiveBackHandler: (...args: unknown[]) => mockPredictiveBack(...args),
}));
jest.mock("../../components/sheets/BatchCountSheet", () => ({
  BatchCountSheet: () => null,
}));

function SheetControls() {
  const { open, close } = useAppSheet();
  return (
    <View>
      <Pressable
        accessibilityLabel="Open batch"
        onPress={() => open("batchCount")}
      />
      <Pressable accessibilityLabel="Close options" onPress={close} />
    </View>
  );
}

async function renderSheets() {
  return render(
    <AppSheetProvider>
      <SheetControls />
    </AppSheetProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Keyboard, "isVisible").mockReturnValue(false);
});

afterEach(() => jest.restoreAllMocks());

test("opens Batch Count, keeps backdrop taps inert, and closes on predictive back", async () => {
  const screen = await renderSheets();
  await fireEvent.press(screen.getByLabelText("Open batch"));
  expect(screen.getByText("Batch Count")).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("Dismiss options"));
  expect(mockSheetClose).not.toHaveBeenCalled();

  const [active, handlers] = mockPredictiveBack.mock.calls.at(-1)!;
  expect(active).toBe(true);
  await act(() => handlers.onCommit());
  expect(mockSheetClose).toHaveBeenCalledTimes(1);
  await act(() => mockSheetProps.mock.calls.at(-1)![0].onClose?.());
  expect(screen.queryByText("Batch Count")).toBeNull();

  await fireEvent.press(screen.getByLabelText("Open batch"));
  expect(screen.getByText("Batch Count")).toBeTruthy();
  await screen.unmount();
});

test("Batch Count uses the route's snap point and content panning", async () => {
  const screen = await renderSheets();
  await fireEvent.press(screen.getByLabelText("Open batch"));

  expect(mockSheetProps.mock.calls.at(-1)![0]).toMatchObject({
    snapPoints: ["44%"],
    enableContentPanningGesture: false,
  });
  await screen.unmount();
});
