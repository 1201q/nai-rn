import { act, fireEvent, render } from "@testing-library/react-native";
import { AppState, StyleSheet, type AppStateStatus } from "react-native";
import { imageUpscaler } from "../../../../modules/image-upscaler";
import { useUpscaleQueueStore } from "../../../store/upscaleQueueStore";
import { UpscaleCanvas } from "../UpscaleCanvas";

let mockFocused = true;
jest.mock("expo-router", () => ({ useIsFocused: () => mockFocused }));
jest.mock("expo-image", () => ({ Image: require("react-native").View }));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("../../../../modules/image-upscaler", () => ({
  imageUpscaler: { acknowledgePreview: jest.fn(), releasePreviews: jest.fn() },
}));
jest.mock("../../../store/upscaleQueueStore", () => {
  const { create } = require("zustand");
  return {
    useUpscaleQueueStore: create(() => ({
      items: [],
      progress: 0,
      currentItemId: null,
      preview: null,
      setPreviewVisible: jest.fn(),
    })),
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockFocused = true;
  useUpscaleQueueStore.setState({
    items: [
      {
        id: "image",
        uri: "file:///original.png",
        width: 100,
        height: 100,
        status: "running",
      },
    ],
    currentItemId: "image",
    progress: 0,
    preview: {
      requestId: "request",
      phase: "preparing",
      uri: null,
      sequence: -1,
      tile: null,
      updatedAt: Date.now(),
      failed: false,
    },
  });
});

async function frame(sequence: number) {
  await act(() =>
    useUpscaleQueueStore.setState((state) => ({
      preview: {
        ...state.preview!,
        phase: "upscaling",
        uri: "file:///frame" + sequence + ".jpg",
        sequence,
        updatedAt: Date.now(),
      },
    })),
  );
}

test("shows the original and spinner until a real frame decodes, then positions the actual tile", async () => {
  const screen = await render(<UpscaleCanvas onOpenQueue={jest.fn()} />);
  expect(screen.getByTestId("upscale-preview-fallback")).toBeTruthy();
  expect(screen.getByLabelText("현재 업스케일 이미지").props.source.uri).toBe(
    "file:///original.png",
  );
  await fireEvent(screen.getByTestId("upscale-image-viewport"), "layout", {
    nativeEvent: { layout: { width: 200, height: 200 } },
  });
  await frame(0);
  await act(() =>
    useUpscaleQueueStore.setState((state) => ({
      preview: {
        ...state.preview!,
        tile: { x: 25, y: 50, width: 25, height: 30 },
      },
    })),
  );
  expect(
    StyleSheet.flatten(screen.getByTestId("upscale-active-tile").props.style),
  ).toMatchObject({ left: 50, top: 100, width: 50, height: 60 });
  await fireEvent(screen.getByTestId("upscale-preview-candidate"), "load");
  expect(screen.queryByTestId("upscale-preview-fallback")).toBeNull();
  expect(screen.getByLabelText("현재 업스케일 이미지").props.source.uri).toBe(
    "file:///frame0.jpg",
  );
  expect(imageUpscaler!.acknowledgePreview).toHaveBeenCalledWith("request", 0);
});

test("retains the last decoded frame on a preview error and recovers on the next good frame", async () => {
  const screen = await render(<UpscaleCanvas onOpenQueue={jest.fn()} />);
  await frame(0);
  await fireEvent(screen.getByTestId("upscale-preview-candidate"), "load");
  await frame(1);
  await fireEvent(screen.getByTestId("upscale-preview-candidate"), "error");
  expect(screen.getByTestId("upscale-preview-fallback")).toBeTruthy();
  expect(screen.getByLabelText("현재 업스케일 이미지").props.source.uri).toBe(
    "file:///frame0.jpg",
  );
  await frame(2);
  await fireEvent(screen.getByTestId("upscale-preview-candidate"), "load");
  expect(screen.queryByTestId("upscale-preview-fallback")).toBeNull();
  expect(screen.getByLabelText("현재 업스케일 이미지").props.source.uri).toBe(
    "file:///frame2.jpg",
  );
});

test("falls back when progress stalls and resumes when a new event arrives", async () => {
  jest.useFakeTimers();
  try {
    const screen = await render(<UpscaleCanvas onOpenQueue={jest.fn()} />);
    await frame(0);
    await fireEvent(screen.getByTestId("upscale-preview-candidate"), "load");
    await act(() => jest.advanceTimersByTime(5001));
    expect(screen.getByTestId("upscale-preview-fallback")).toBeTruthy();
    await frame(1);
    await fireEvent(screen.getByTestId("upscale-preview-candidate"), "load");
    expect(screen.queryByTestId("upscale-preview-fallback")).toBeNull();
  } finally {
    jest.useRealTimers();
  }
});

test("gates previews on screen focus and app state, and releases the old request after switching images", async () => {
  let change!: (state: AppStateStatus) => void;
  const subscription = jest
    .spyOn(AppState, "addEventListener")
    .mockImplementation((_name, fn) => {
      change = fn;
      return { remove: jest.fn() };
    });
  try {
    const screen = await render(<UpscaleCanvas onOpenQueue={jest.fn()} />);
    const setVisible = useUpscaleQueueStore.getState().setPreviewVisible;
    expect(setVisible).toHaveBeenLastCalledWith(true);
    await act(() => change("background"));
    expect(setVisible).toHaveBeenLastCalledWith(false);
    await act(() => change("active"));
    expect(setVisible).toHaveBeenLastCalledWith(true);
    mockFocused = false;
    await screen.rerender(<UpscaleCanvas onOpenQueue={jest.fn()} />);
    expect(setVisible).toHaveBeenLastCalledWith(false);
    await act(() =>
      useUpscaleQueueStore.setState((state) => ({
        preview: { ...state.preview!, requestId: "next" },
      })),
    );
    expect(imageUpscaler!.releasePreviews).toHaveBeenCalledWith("request");
  } finally {
    subscription.mockRestore();
  }
});
