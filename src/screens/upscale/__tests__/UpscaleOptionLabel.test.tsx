import { act, fireEvent, render } from "@testing-library/react-native";
import { UpscaleOptionLabel } from "../UpscaleOptionLabel";

const mockMeasure = jest.fn((callback) => callback(30, 200, 19, 19));
const mockPortal = jest.fn();
let mockClose: () => void;
jest.mock("react-native/Libraries/Components/Pressable/Pressable", () => {
  const React = require("react");
  const { default: Pressable } = jest.requireActual(
    "react-native/Libraries/Components/Pressable/Pressable",
  );
  return {
    __esModule: true,
    default: React.forwardRef(function MeasuredPressable(
      props: object,
      ref: unknown,
    ) {
      React.useImperativeHandle(ref, () => ({ measureInWindow: mockMeasure }));
      return React.createElement(Pressable, props);
    }),
  };
});
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("@gorhom/portal", () => ({
  Portal: ({
    children,
    hostName,
  }: {
    children: React.ReactNode;
    hostName: string;
  }) => {
    mockPortal(hostName);
    return children;
  },
}));
jest.mock("../../../native/usePopoverBackHandler", () => ({
  usePopoverBackHandler: (_open: boolean, onClose: () => void) => {
    mockClose = onClose;
    return { popoverStyle: {}, resetPredictiveBack: jest.fn() };
  },
}));
jest.mock("react-native-reanimated", () => ({
  __esModule: true,
  default: { View: require("react-native").View },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

test("shows help only after pressing i and closes on an outside tap", async () => {
  const view = await render(
    <UpscaleOptionLabel
      label="TTA mode"
      description="8가지 방향으로 추론합니다."
    />,
  );
  expect(view.queryByText("8가지 방향으로 추론합니다.")).toBeNull();
  await fireEvent.press(view.getByLabelText("TTA mode 설명"));
  expect(view.getByText("8가지 방향으로 추론합니다.")).toBeTruthy();
  expect(mockPortal).toHaveBeenCalledWith("upscale-select-overlay");
  expect(
    view.getByLabelText("TTA mode 설명").props.accessibilityState.expanded,
  ).toBe(true);
  await fireEvent.press(view.getByLabelText("TTA mode 설명 닫기"));
  expect(view.queryByText("8가지 방향으로 추론합니다.")).toBeNull();
});

test("back closes help before its sheet", async () => {
  const view = await render(
    <UpscaleOptionLabel label="저장 앨범" description="앨범에 저장합니다." />,
  );
  await fireEvent.press(view.getByLabelText("저장 앨범 설명"));
  await act(async () => mockClose());
  expect(view.queryByText("앨범에 저장합니다.")).toBeNull();
});

test("closing the sheet clears its tooltip before reopening", async () => {
  const view = await render(
    <UpscaleOptionLabel label="TTA mode" description="설명" active />,
  );
  await fireEvent.press(view.getByLabelText("TTA mode 설명"));
  await view.rerender(
    <UpscaleOptionLabel label="TTA mode" description="설명" active={false} />,
  );
  expect(view.queryByText("설명")).toBeNull();
  await view.rerender(
    <UpscaleOptionLabel label="TTA mode" description="설명" active />,
  );
  expect(view.queryByText("설명")).toBeNull();
});
