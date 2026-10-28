import { useState } from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import { Pressable } from "react-native";

import {
  GenerationInputCommitProvider,
  useGenerationInputCommit,
} from "../../../context/GenerationInputCommitContext";
import type { Slider } from "../../../components/forms/Slider";
import { DEFAULT_UPSCALE_SETTINGS } from "../upscaleOptions";
import { UpscaleQualityControl } from "../UpscaleQualityControl";
import type { UpscaleSettings } from "../../../store/upscaleQueueStore";

type SliderProps = React.ComponentProps<typeof Slider>;
const mockSliderProps = jest.fn();
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("../../../native/usePopoverBackHandler", () => ({
  usePopoverBackHandler: () => ({
    popoverStyle: {},
    resetPredictiveBack: jest.fn(),
  }),
}));
let mockHandleOnly = false;

jest.mock("../../../store/generationStore", () => ({
  useGenerationStore: (selector: (state: object) => unknown) =>
    selector({ sliderHandleOnly: mockHandleOnly }),
}));
jest.mock("../../../components/forms/Slider", () => ({
  Slider: (props: SliderProps) => {
    mockSliderProps(props);
    return null;
  },
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

function Harness({
  format = "jpg",
  onCommit = () => {},
}: {
  format?: UpscaleSettings["format"];
  onCommit?: (settings: UpscaleSettings) => void;
}) {
  const [settings, setSettings] = useState({
    ...DEFAULT_UPSCALE_SETTINGS,
    format,
  });
  const { commitPendingInput } = useGenerationInputCommit();
  return (
    <>
      <UpscaleQualityControl
        settings={settings}
        active
        onChange={(patch) =>
          setSettings((current) => ({ ...current, ...patch }))
        }
      />
      <Pressable
        accessibilityLabel="확정"
        onPress={() => {
          commitPendingInput();
          onCommit(settings);
        }}
      />
    </>
  );
}

function slider(): SliderProps {
  return mockSliderProps.mock.calls.at(-1)![0];
}

beforeEach(() => {
  jest.clearAllMocks();
  mockHandleOnly = false;
});

test("uses the existing seekbar's numeric input and handle-only preference", async () => {
  mockHandleOnly = true;
  const view = await render(
    <GenerationInputCommitProvider>
      <Harness />
    </GenerationInputCommitProvider>,
  );
  expect(view.getByLabelText("Image quality 값").props.value).toBe("95");
  expect(slider()).toMatchObject({
    min: 1,
    max: 100,
    step: 1,
    precision: 0,
    handleOnly: true,
  });
});

test("commits the drag only at completion instead of writing every movement", async () => {
  const onChange = jest.fn();
  await render(
    <GenerationInputCommitProvider>
      <UpscaleQualityControl
        settings={{ ...DEFAULT_UPSCALE_SETTINGS, format: "webp" }}
        active
        onChange={onChange}
      />
    </GenerationInputCommitProvider>,
  );
  expect(slider().onValueChange).toBeUndefined();
  await act(async () => {
    slider().onSlidingStart?.();
  });
  slider().display!.value = 72;
  await act(async () => {
    slider().onSlidingComplete(72);
  });
  expect(onChange).toHaveBeenLastCalledWith({ webpQuality: 72 });
});

test("commits and bounds typed values using the shared input behavior", async () => {
  const onChange = jest.fn();
  const view = await render(
    <GenerationInputCommitProvider>
      <UpscaleQualityControl
        settings={{ ...DEFAULT_UPSCALE_SETTINGS, format: "jpg" }}
        active
        onChange={onChange}
      />
    </GenerationInputCommitProvider>,
  );
  const input = view.getByLabelText("Image quality 값");
  await fireEvent(input, "focus");
  await fireEvent.changeText(input, "150");
  await fireEvent(input, "blur");
  expect(onChange).toHaveBeenLastCalledWith({ jpgQuality: 100 });
});

test("flushes a still-focused input through the screen's commit context", async () => {
  const onChange = jest.fn();
  function CommitButton() {
    const { commitPendingInput } = useGenerationInputCommit();
    return <Pressable accessibilityLabel="확정" onPress={commitPendingInput} />;
  }
  const view = await render(
    <GenerationInputCommitProvider>
      <UpscaleQualityControl
        settings={{ ...DEFAULT_UPSCALE_SETTINGS, format: "jpg" }}
        active
        onChange={onChange}
      />
      <CommitButton />
    </GenerationInputCommitProvider>,
  );
  await fireEvent(view.getByLabelText("Image quality 값"), "focus");
  await fireEvent.changeText(view.getByLabelText("Image quality 값"), "67");
  await fireEvent.press(view.getByLabelText("확정"));
  expect(onChange).toHaveBeenLastCalledWith({ jpgQuality: 67 });
});

test("renders PNG as lossless without an editable seekbar", async () => {
  const view = await render(
    <UpscaleQualityControl
      settings={DEFAULT_UPSCALE_SETTINGS}
      active
      onChange={jest.fn()}
    />,
  );
  expect(view.queryByLabelText("Image quality 값")).toBeNull();
  expect(view.getByText("무손실")).toBeTruthy();
  expect(mockSliderProps).not.toHaveBeenCalled();
});
