import { act, fireEvent, render } from "@testing-library/react-native";
import type { BottomSheetProps } from "@gorhom/bottom-sheet";
import { UpscaleSettingsSheetHost } from "../UpscaleSettingsSheet";
import { DEFAULT_UPSCALE_SETTINGS } from "../upscaleOptions";

const mockSheetProps = jest.fn();
const mockSnap = jest.fn();
const mockScrollProps = jest.fn();

jest.mock("@gorhom/bottom-sheet", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: React.forwardRef(function MockSheet(
      props: BottomSheetProps,
      ref: unknown,
    ) {
      mockSheetProps(props);
      React.useImperativeHandle(ref, () => ({ snapToIndex: mockSnap }));
      return <View>{props.children}</View>;
    }),
    BottomSheetView: View,
    useBottomSheetTimingConfigs: () => ({}),
    useBottomSheetGestureHandlers: () => ({ handlePanGestureHandler: {} }),
  };
});
jest.mock("react-native-gesture-handler", () => {
  const gesture: Record<string, unknown> = {};
  for (const name of [
    "activeOffsetY",
    "failOffsetX",
    "shouldCancelWhenOutside",
    "onStart",
    "onChange",
    "onEnd",
    "onFinalize",
  ])
    gesture[name] = () => gesture;
  return {
    Gesture: { Pan: () => gesture },
    GestureDetector: ({ children }: { children: React.ReactNode }) => children,
  };
});
jest.mock("react-native-reanimated", () => ({
  __esModule: true,
  default: { View: require("react-native").View },
  Extrapolation: { CLAMP: "clamp" },
  Easing: { bezier: () => (value: number) => value },
  interpolate: () => 1,
  useAnimatedStyle: (factory: () => object) => factory(),
  useSharedValue: (value: number) => ({ value }),
  withTiming: (value: number) => value,
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("../../../hooks/useGenerationChromeMetrics", () => ({
  GENERATION_SHEET_HEADER_HEIGHT: 44,
  useGenerationChromeMetrics: () => ({
    promptCollapsedHeight: 200,
    utilitySheetTop: 56,
    sheetContentPaddingBottom: 200,
  }),
}));
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 390, height: 844, scale: 1, fontScale: 1 }),
}));
jest.mock(
  "../../../components/generation/BottomSheetKeyboardAwareScrollView",
  () => {
    const React = require("react");
    const { View } = require("react-native");
    return {
      BottomSheetKeyboardAwareScrollView: React.forwardRef(function MockScroll(
        props: { children: React.ReactNode },
        ref: unknown,
      ) {
        mockScrollProps(props);
        React.useImperativeHandle(ref, () => ({ scrollTo: jest.fn() }));
        return <View>{props.children}</View>;
      }),
    };
  },
);
jest.mock("../../generation/sheets/SheetLayers", () => ({
  FixedSheetBackdrop: () => null,
  PredictiveBackSheetLayer: require("react-native").View,
  PressableSurface: require("react-native").Pressable,
}));
jest.mock("../../../components/forms/SheetSelect", () => ({
  SheetSelect: () => null,
}));
jest.mock("../../../components/forms/FormControls", () => ({
  Toggle: () => null,
}));
jest.mock("../../../components/forms/Slider", () => ({
  Slider: ({
    children,
    accessibilityLabel,
  }: {
    children: React.ReactNode;
    accessibilityLabel: string;
  }) => {
    const { View } = require("react-native");
    return <View testID={`${accessibilityLabel}-track`}>{children}</View>;
  },
}));
jest.mock("../../../store/generationStore", () => ({
  useGenerationStore: () => true,
}));
jest.mock("../../../components/forms/HelpButton", () => ({
  HelpButton: ({
    label,
    description,
    open,
    onToggle,
  }: {
    label: string;
    description: string;
    open: boolean;
    onToggle: () => void;
  }) => {
    const { View, Pressable, Text } = require("react-native");
    return (
      <View>
        <Pressable accessibilityLabel={`${label} 도움말`} onPress={onToggle} />
        {open ? <Text>{description}</Text> : null}
      </View>
    );
  },
}));

beforeEach(() => jest.clearAllMocks());

function props() {
  return mockSheetProps.mock.calls.at(-1)![0] as BottomSheetProps;
}

test("only uses collapsed and fully expanded positions", async () => {
  const onOpenChange = jest.fn();
  const sharedProps = {
    settings: DEFAULT_UPSCALE_SETTINGS,
    disabled: false,
    predictiveBackProgress: { value: 0 } as never,
    onOpenChange,
    onChange: jest.fn(),
  };
  const view = await render(<UpscaleSettingsSheetHost open {...sharedProps} />);
  expect(props().snapPoints).toEqual([200, 788]);
  expect(props().index).toBe(1);
  expect(mockSnap).toHaveBeenLastCalledWith(1);
  expect(
    mockScrollProps.mock.calls.at(-1)![0].contentContainerStyle.at(-1)
      .paddingBottom,
  ).toBe(200);
  await act(async () => {
    props().onChange?.(0, 200, 0);
  });
  expect(onOpenChange).toHaveBeenCalledWith(false);
  await view.rerender(
    <UpscaleSettingsSheetHost open={false} {...sharedProps} />,
  );
  expect(props().index).toBe(0);
  expect(mockSnap).toHaveBeenLastCalledWith(0);
});

test("keeps stepped labels and checkpoint decorations, and shows GPU help only on demand", async () => {
  const onChange = jest.fn();
  const view = await render(
    <UpscaleSettingsSheetHost
      open
      settings={DEFAULT_UPSCALE_SETTINGS}
      disabled={false}
      predictiveBackProgress={{ value: 0 } as never}
      onOpenChange={jest.fn()}
      onChange={onChange}
    />,
  );
  expect(view.getByTestId("Scale-track").props.children).toBeTruthy();
  await fireEvent.press(view.getByLabelText("Scale: 3x"));
  expect(onChange).toHaveBeenCalledWith({ scale: 3 });
  const description =
    "켜면 GPU를 사용하고, GPU가 없으면 CPU로 처리합니다. 끄면 CPU를 사용합니다.";
  expect(view.queryByText(description)).toBeNull();
  await fireEvent.press(view.getByLabelText("Use GPU 도움말"));
  expect(view.getByText(description)).toBeTruthy();
});
