import { act, fireEvent, render } from "@testing-library/react-native";
import { UpscaleSettingsSheetContent } from "../UpscaleSettingsSheet";
import { DEFAULT_UPSCALE_SETTINGS } from "../upscaleOptions";

const mockScrollProps = jest.fn();
const mockSelectProps = jest.fn();

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
  SheetSelect: (props: object) => {
    mockSelectProps(props);
    return null;
  },
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

test("uses keyboard-aware scrolling only while active and editable", async () => {
  const sharedProps = {
    settings: DEFAULT_UPSCALE_SETTINGS,
    disabled: false,
    onChange: jest.fn(),
  };
  const view = await render(
    <UpscaleSettingsSheetContent active {...sharedProps} />,
  );
  expect(mockScrollProps.mock.calls.at(-1)![0]).toMatchObject({
    active: true,
    enabled: true,
    bottomOffset: 108,
    extraKeyboardSpace: 96,
  });
  expect(
    mockScrollProps.mock.calls.at(-1)![0].contentContainerStyle.at(-1)
      .paddingBottom,
  ).toBe(200);
  await view.rerender(
    <UpscaleSettingsSheetContent active={false} {...sharedProps} />,
  );
  expect(mockScrollProps.mock.calls.at(-1)![0]).toMatchObject({
    active: false,
    enabled: false,
  });
  await view.rerender(
    <UpscaleSettingsSheetContent active {...sharedProps} disabled />,
  );
  expect(mockScrollProps.mock.calls.at(-1)![0]).toMatchObject({
    active: true,
    enabled: false,
  });
});

test("keeps stepped labels and checkpoint decorations, and shows GPU help only on demand", async () => {
  const onChange = jest.fn();
  const view = await render(
    <UpscaleSettingsSheetContent
      active
      settings={DEFAULT_UPSCALE_SETTINGS}
      disabled={false}
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

test("closes the model selector when the settings sheet becomes inactive", async () => {
  const shared = {
    settings: DEFAULT_UPSCALE_SETTINGS,
    disabled: false,
    onChange: jest.fn(),
  };
  const view = await render(<UpscaleSettingsSheetContent active {...shared} />);
  await act(() => {
    mockSelectProps.mock.calls.at(-1)![0].onOpenChange(true);
  });
  expect(mockSelectProps.mock.calls.at(-1)![0].open).toBe(true);
  await view.rerender(
    <UpscaleSettingsSheetContent active={false} {...shared} />,
  );
  await view.rerender(<UpscaleSettingsSheetContent active {...shared} />);
  expect(mockSelectProps.mock.calls.at(-1)![0].open).toBe(false);
});
