import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

import { imageUpscaler } from "../../../../modules/image-upscaler";
import { DEFAULT_UPSCALE_SETTINGS } from "../upscaleOptions";
import { UpscaleCpuSettings } from "../UpscaleCpuSettings";

jest.mock("../../../store/generationStore", () => ({
  useGenerationStore: (selector: (state: object) => unknown) =>
    selector({ sliderHandleOnly: true }),
}));
jest.mock("@gorhom/bottom-sheet", () => ({
  BottomSheetTextInput: require("react-native").TextInput,
}));
jest.mock("react-native-reanimated", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: { createAnimatedComponent: (component: unknown) => component },
    useSharedValue: (value: number) => React.useRef({ value }).current,
    useAnimatedProps: () => ({}),
  };
});

jest.mock("../../../components/forms/HelpButton", () => ({
  HelpButton: () => null,
}));

jest.mock("../../../../modules/image-upscaler", () => ({
  imageUpscaler: { getCpuInfo: jest.fn(), getGpuInfo: jest.fn() },
}));
jest.mock("../../../components/forms/FormControls", () => ({
  Toggle: ({
    label,
    value,
    disabled,
    onChange,
  }: {
    label: string;
    value: boolean;
    disabled: boolean;
    onChange: (value: boolean) => void;
  }) => {
    const { Pressable } = require("react-native");
    return (
      <Pressable
        accessibilityLabel={label}
        accessibilityState={{ disabled, checked: value }}
        disabled={disabled}
        onPress={() => onChange(!value)}
      />
    );
  },
}));
jest.mock("../../../components/forms/Slider", () => ({
  Slider: (props: object) => {
    const { View } = require("react-native");
    return <View {...props} testID="cpu-slider" />;
  },
}));
jest.mock("../../../components/forms/SteppedSeekbar", () => ({
  SteppedSeekbar: ({
    stops,
    onChange,
  }: {
    stops: { value: number }[];
    onChange: (value: number) => void;
  }) => {
    const { View, Pressable } = require("react-native");
    return (
      <View>
        {stops.map(({ value }) => (
          <Pressable
            key={value}
            accessibilityLabel={`CPU Policy: ${value}`}
            onPress={() => onChange(value)}
          />
        ))}
      </View>
    );
  },
}));

beforeEach(() => {
  jest.resetAllMocks();
  jest
    .mocked(imageUpscaler!.getCpuInfo)
    .mockResolvedValue({ all: 8, little: 6, big: 2 });
  jest
    .mocked(imageUpscaler!.getGpuInfo)
    .mockResolvedValue({ available: true, heapBudgetMiB: 512 });
});

test("CPU controls are disabled with GPU enabled and become available after forcing CPU", async () => {
  const onChange = jest.fn();
  const view = await render(
    <UpscaleCpuSettings
      active
      disabled={false}
      settings={DEFAULT_UPSCALE_SETTINGS}
      onChange={onChange}
    />,
  );
  await view.findByText("GPU 처리 중에는 CPU 설정을 사용하지 않습니다.");
  expect(
    view.getByLabelText("CPU Threads 자동", { includeHiddenElements: true })
      .props.accessibilityState.disabled,
  ).toBe(true);
  await fireEvent.press(view.getByLabelText("Use GPU"));
  expect(onChange).toHaveBeenCalledWith({ useGpu: false });
  await view.rerender(
    <UpscaleCpuSettings
      active
      disabled={false}
      settings={{ ...DEFAULT_UPSCALE_SETTINGS, useGpu: false }}
      onChange={onChange}
    />,
  );
  await view.findByText("CPU로 처리합니다.");
  expect(
    view.getByLabelText("CPU Threads 자동").props.accessibilityState.disabled,
  ).toBe(false);
});

test("GPU absence enables CPU controls even with Use GPU on", async () => {
  jest
    .mocked(imageUpscaler!.getGpuInfo)
    .mockResolvedValue({ available: false, heapBudgetMiB: null });
  const view = await render(
    <UpscaleCpuSettings
      active
      disabled={false}
      settings={DEFAULT_UPSCALE_SETTINGS}
      onChange={jest.fn()}
    />,
  );
  await view.findByText("GPU가 없어 CPU로 처리합니다.");
  expect(
    view.getByLabelText("CPU Threads 자동").props.accessibilityState.disabled,
  ).toBe(false);
});

test("switching to big cores clamps explicit threads and the slider range", async () => {
  const onChange = jest.fn();
  const settings = {
    ...DEFAULT_UPSCALE_SETTINGS,
    useGpu: false,
    cpuThreads: 8,
  };
  const view = await render(
    <UpscaleCpuSettings
      active
      disabled={false}
      settings={settings}
      onChange={onChange}
    />,
  );
  await view.findByText("CPU로 처리합니다.");
  await fireEvent.press(view.getByLabelText("CPU Policy: 2"));
  expect(onChange).toHaveBeenCalledWith({ cpuPolicy: 2, cpuThreads: 2 });
  await view.rerender(
    <UpscaleCpuSettings
      active
      disabled={false}
      settings={{ ...settings, cpuPolicy: 2, cpuThreads: 2 }}
      onChange={onChange}
    />,
  );
  expect(view.getByTestId("cpu-slider").props.max).toBe(2);
});

test("unavailable cluster falls back to all cores and query failure disables CPU controls", async () => {
  jest
    .mocked(imageUpscaler!.getCpuInfo)
    .mockResolvedValue({ all: 4, little: 0, big: 0 });
  const view = await render(
    <UpscaleCpuSettings
      active
      disabled={false}
      settings={{ ...DEFAULT_UPSCALE_SETTINGS, useGpu: false, cpuPolicy: 1 }}
      onChange={jest.fn()}
    />,
  );
  await view.findByText("CPU로 처리합니다.");
  expect(view.getByText("CPU Policy · 전체 코어")).toBeTruthy();
  expect(view.getByText("자동 · 4")).toBeTruthy();
  await view.rerender(
    <UpscaleCpuSettings
      active={false}
      disabled={false}
      settings={DEFAULT_UPSCALE_SETTINGS}
      onChange={jest.fn()}
    />,
  );
  jest
    .mocked(imageUpscaler!.getCpuInfo)
    .mockRejectedValue(new Error("unavailable"));
  await view.rerender(
    <UpscaleCpuSettings
      active
      disabled={false}
      settings={DEFAULT_UPSCALE_SETTINGS}
      onChange={jest.fn()}
    />,
  );
  await waitFor(() =>
    expect(view.getByText(/기기 정보를 조회하지 못했습니다/)).toBeTruthy(),
  );
  expect(
    view.getByLabelText("CPU Threads 자동", { includeHiddenElements: true })
      .props.accessibilityState.disabled,
  ).toBe(true);
});

test("does not query hardware while inactive", async () => {
  await render(
    <UpscaleCpuSettings
      active={false}
      disabled={false}
      settings={DEFAULT_UPSCALE_SETTINGS}
      onChange={jest.fn()}
    />,
  );
  expect(imageUpscaler!.getCpuInfo).not.toHaveBeenCalled();
});

test("uses the shared seekbar for manual input and bounds typed threads to the selected cluster", async () => {
  const onChange = jest.fn();
  const view = await render(
    <UpscaleCpuSettings
      active
      disabled={false}
      settings={{
        ...DEFAULT_UPSCALE_SETTINGS,
        useGpu: false,
        cpuThreads: 2,
        cpuPolicy: 2,
      }}
      onChange={onChange}
    />,
  );
  await view.findByText("CPU로 처리합니다.");
  expect(view.getByTestId("cpu-slider").props).toMatchObject({
    min: 1,
    max: 2,
    step: 1,
    handleOnly: true,
  });
  const input = view.getByLabelText("Number of CPU Threads 값");
  await fireEvent(input, "focus");
  await fireEvent.changeText(input, "8");
  await fireEvent(input, "blur");
  expect(onChange).toHaveBeenLastCalledWith({ cpuThreads: 2 });
});

test("commits a manual thread drag at release using the shared seekbar", async () => {
  const onChange = jest.fn();
  const view = await render(
    <UpscaleCpuSettings
      active
      disabled={false}
      settings={{
        ...DEFAULT_UPSCALE_SETTINGS,
        useGpu: false,
        cpuThreads: 2,
        cpuPolicy: 2,
      }}
      onChange={onChange}
    />,
  );
  await view.findByText("CPU로 처리합니다.");
  const slider = view.getByTestId("cpu-slider").props;
  expect(slider.onValueChange).toBeUndefined();
  await act(async () => {
    slider.onSlidingStart();
    slider.display.value = 1;
    slider.onSlidingComplete(1);
  });
  expect(onChange).toHaveBeenLastCalledWith({ cpuThreads: 1 });
});
