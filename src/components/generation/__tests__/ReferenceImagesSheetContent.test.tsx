import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import * as ImagePicker from "expo-image-picker";

import { useGenerationStore } from "../../../store/generationStore";
import { ImageToImageReferenceCard, PreciseReferenceCard, VibeReferenceCard } from "../ReferenceImagesSheetContent";

jest.mock("react-native-reanimated", () => {
  const React = require("react");
  const { View, Text } = require("react-native");
  return {
    __esModule: true,
    default: { View, Text, createAnimatedComponent: (component: unknown) => component },
    Easing: { out: (value: unknown) => value, cubic: jest.fn() },
    ReduceMotion: { System: "system" },
    useSharedValue: (value: unknown) => React.useRef({ value }).current,
    useAnimatedProps: (callback: () => object) => callback(),
    useAnimatedStyle: (callback: () => object) => callback(),
    withTiming: (value: number) => value,
  };
});

jest.mock("@gorhom/bottom-sheet", () => ({
  BottomSheetTextInput: require("react-native").TextInput,
}));

jest.mock("../../../store/generationStore", () => {
  const { create } = require("zustand");
  return { useGenerationStore: create(() => ({})) };
});
jest.mock("../../../lib/vibeReferences", () => ({
  MAX_VIBE_REFERENCES: 16,
  canUseCachedVibeEncoding: () => false,
  resolveVibeReferenceThumbnailUri: () => "file:///vibe.png",
  resolveVibeReferenceImageUri: () => "file:///vibe.png",
}));
jest.mock("../../../lib/preciseReferences", () => ({
  MAX_PRECISE_REFERENCES: 16,
  resolvePreciseReferenceThumbnailUri: () => "file:///precise.png",
  resolvePreciseReferenceImageUri: () => "file:///precise.png",
}));
jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock("../BottomSheetKeyboardAwareScrollView", () => ({
  BottomSheetKeyboardAwareScrollView: require("react-native").ScrollView,
}));
jest.mock("../../forms/FormControls", () => ({ Toggle: () => null }));
jest.mock("../../forms/Slider", () => {
  const React = require("react");
  const { Pressable } = require("react-native");
  return {
    Slider: ({ accessibilityLabel, onSlidingComplete }: { accessibilityLabel: string; onSlidingComplete: (value: number) => void }) =>
      React.createElement(Pressable, { accessibilityLabel, onPress: () => onSlidingComplete(0.45) }),
  };
});
jest.mock("../../forms/SheetSelect", () => {
  const React = require("react");
  const { Pressable } = require("react-native");
  return {
    SheetSelect: ({ onChange }: { onChange: (value: string) => void }) =>
      React.createElement(Pressable, { accessibilityLabel: "Select mode", onPress: () => onChange("Style Only") }),
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  useGenerationStore.setState({
    model: "nai-diffusion-4-5-full",
    i2iSourceImage: null,
    vibeReferences: [],
    preciseReferences: [],
    normalizeVibeStrengths: false,
    setMessage: jest.fn(),
    setI2ISourceImage: jest.fn(),
    setI2IStrength: jest.fn(),
    setI2INoise: jest.fn(),
    setI2IEnabled: jest.fn(),
    clearI2I: jest.fn(() => useGenerationStore.setState({ i2iSourceImage: null, i2iEnabled: false })),
    addVibeReference: jest.fn(),
    addPreciseReference: jest.fn(),
    setVibeReferenceStrength: jest.fn(),
    setVibeReferenceInformationExtracted: jest.fn(),
    setVibeReferenceEnabled: jest.fn(),
    removeVibeReference: jest.fn(),
    setNormalizeVibeStrengths: jest.fn(),
    setPreciseReferenceType: jest.fn(),
    setPreciseReferenceFidelity: jest.fn(),
  });
  jest.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValue({ granted: true } as never);
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({ canceled: true, assets: null });
});

it.each(["vibe", "precise"] as const)("shows active/total counts for disabled %s images", async (kind) => {
  const key = kind === "vibe" ? "vibeReferences" : "preciseReferences";
  const references = [1, 2].map((id) => ({
    id: `${id}`, enabled: true, strength: 0.6, informationExtracted: 1,
    referenceType: "character&style", fidelity: 1,
  }));
  useGenerationStore.setState({ [key]: references } as never);
  const screen = await render(kind === "vibe" ? <VibeReferenceCard /> : <PreciseReferenceCard active />);
  expect(screen.getByText("(2)")).toBeTruthy();
  await act(() => useGenerationStore.setState({ [key]: references.map((item, index) => ({ ...item, enabled: index === 0 })) } as never));
  expect(screen.getByText("(1/2)")).toBeTruthy();
  await act(() => useGenerationStore.setState({ [key]: references.map((item) => ({ ...item, enabled: false })) } as never));
  expect(screen.getByText("(0/2)")).toBeTruthy();
  expect(screen.getByTestId(`${kind === "vibe" ? "Vibe Transfer" : "Precise Reference"}-images`)).toBeTruthy();
  await act(() => useGenerationStore.setState({ [key]: references } as never));
  expect(screen.getByText("(2)")).toBeTruthy();
});

it("uses the shared expanding section for I2I and restores it after deletion", async () => {
  const screen = await render(<ImageToImageReferenceCard />);
  expect(screen.getByText("이미지를 변형합니다.")).toBeTruthy();
  await act(() => useGenerationStore.setState({
    i2iSourceImage: { uri: "file:///source.png", width: 512, height: 512 } as never,
    i2iEnabled: true,
    i2iStrength: 0.7,
    i2iNoise: 0,
  }));
  expect(screen.queryByText("이미지를 변형합니다.")).toBeNull();
  expect(screen.getByTestId("Image2Image-images")).toBeTruthy();
  expect(StyleSheet.flatten(screen.getByTestId("Image2Image-header").props.style).marginHorizontal).toBe(8);
  await fireEvent.press(screen.getByLabelText("I2I 이미지 교체"));
  await waitFor(() => expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled());
  await fireEvent.press(screen.getByLabelText("I2I 이미지 사용"));
  expect(useGenerationStore.getState().setI2IEnabled).toHaveBeenCalledWith(false);
  await act(() => useGenerationStore.setState({ i2iEnabled: false }));
  expect(screen.getByText("(0/1)")).toBeTruthy();
  expect(screen.getByTestId("Image2Image-images")).toBeTruthy();
  await act(() => useGenerationStore.setState({ i2iEnabled: true }));
  expect(screen.getByText("(1)")).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("I2I 이미지 삭제"));
  expect(screen.queryByTestId("Image2Image-images")).toBeNull();
  expect(screen.getByText("이미지를 변형합니다.")).toBeTruthy();
  expect(screen.getByLabelText("Image2Image 이미지 추가")).toBeTruthy();
  expect(StyleSheet.flatten(screen.getByTestId("Image2Image-header").props.style).borderBottomWidth).toBe(1);
});

it.each(["i2i", "vibe", "precise"] as const)(
  "commits typed %s values using Settings range and step normalization",
  async (kind) => {
    useGenerationStore.setState({
      i2iSourceImage: { uri: "file:///source.png", width: 512, height: 512 } as never,
      i2iStrength: 0.7,
      i2iNoise: 0,
      vibeReferences: [{ id: "v1", enabled: true, strength: 0.6, informationExtracted: 1 }] as never,
      preciseReferences: [{ id: "p1", enabled: true, referenceType: "character&style", strength: 1, fidelity: 1 }] as never,
    });
    const screen = await render(kind === "i2i"
      ? <ImageToImageReferenceCard />
      : kind === "vibe" ? <VibeReferenceCard /> : <PreciseReferenceCard active />);
    const label = kind === "i2i" ? "Strength 값" : kind === "vibe" ? "Reference Strength 값" : "Fidelity 값";
    const input = screen.getByLabelText(label);
    await fireEvent(input, "focus");
    await fireEvent.changeText(input, "0,37");
    const state = useGenerationStore.getState();
    const change = kind === "i2i" ? state.setI2IStrength : kind === "vibe" ? state.setVibeReferenceStrength : state.setPreciseReferenceFidelity;
    expect(change).not.toHaveBeenCalled();
    await fireEvent(input, "blur");
    expect(change).toHaveBeenLastCalledWith(...(kind === "i2i" ? [0.37] : kind === "vibe" ? ["v1", 0.37] : ["p1", 0.35]));
    await fireEvent(input, "focus");
    await fireEvent.changeText(input, "99");
    await fireEvent(input, "submitEditing");
    expect(change).toHaveBeenLastCalledWith(...(kind === "i2i" ? [0.99] : kind === "vibe" ? ["v1", 1] : ["p1", 1]));
  },
);

it.each(["vibe", "precise"] as const)(
  "returns the %s header to its empty state only after the last image is removed",
  async (kind) => {
    const title = kind === "vibe" ? "Vibe Transfer" : "Precise Reference";
    const description = kind === "vibe"
      ? "이미지를 바꾸되 분위기는 유지합니다."
      : "캐릭터나 스타일의 참조 이미지를 추가합니다.";
    const screen = await render(kind === "vibe" ? <VibeReferenceCard /> : <PreciseReferenceCard active />);
    const update = async (count: number) => {
      const references = Array.from({ length: count }, (_, index) => ({
        id: `ref-${index}`, enabled: false, strength: 0.6,
        informationExtracted: 1, fidelity: 1, referenceType: "character&style",
      }));
      await act(() => {
        useGenerationStore.setState(
          kind === "vibe"
            ? { vibeReferences: references as never }
            : { preciseReferences: references as never },
        );
      });
    };

    expect(screen.getByText(description)).toBeTruthy();
    expect(screen.queryByTestId(`${title}-images`)).toBeNull();
    await update(2);
    expect(screen.queryByText(description)).toBeNull();
    expect(screen.getByTestId(`${title}-images`)).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId(`${title}-header`).props.style).marginHorizontal).toBe(8);
    await update(1);
    expect(screen.queryByText(description)).toBeNull();
    expect(screen.getByTestId(`${title}-images`)).toBeTruthy();
    await update(0);
    expect(screen.getByText(description)).toBeTruthy();
    expect(screen.queryByTestId(`${title}-images`)).toBeNull();
    expect(StyleSheet.flatten(screen.getByTestId(`${title}-header`).props.style).marginHorizontal).toBe(0);
    expect(StyleSheet.flatten(screen.getByTestId(`${title}-header`).props.style)).toMatchObject({
      borderBottomWidth: 1,
      borderBottomLeftRadius: 16,
      borderBottomRightRadius: 16,
    });
    expect(screen.getByLabelText(`${title} 이미지 추가`)).toBeTruthy();
    await update(1);
    expect(screen.getByTestId(`${title}-images`)).toBeTruthy();
    await update(0);
    expect(screen.getByText(description)).toBeTruthy();
    expect(screen.getByLabelText(`${title} 이미지 추가`)).toBeTruthy();
  },
);

it("does not change the I2I source when selection is canceled or permission is denied", async () => {
  const screen = await render(<ImageToImageReferenceCard />);
  await fireEvent.press(screen.getByLabelText("Image2Image 이미지 추가"));
  await waitFor(() => expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.getByLabelText("Image2Image 이미지 추가").props.accessibilityState.busy).toBe(false));
  expect(useGenerationStore.getState().setI2ISourceImage).not.toHaveBeenCalled();

  jest.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValue({ granted: false } as never);
  await fireEvent.press(screen.getByLabelText("Image2Image 이미지 추가"));
  await waitFor(() => expect(useGenerationStore.getState().setMessage).toHaveBeenCalledWith("이미지를 선택하려면 사진 접근 권한이 필요합니다."));
  expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledTimes(1);
});

it("passes the selected image to existing I2I storage", async () => {
  const asset = { uri: "file:///picked.png", width: 512, height: 768, fileName: "picked.png", mimeType: "image/png" };
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({ canceled: false, assets: [asset] });
  const screen = await render(<ImageToImageReferenceCard />);
  await fireEvent.press(screen.getByLabelText("Image2Image 이미지 추가"));
  await waitFor(() => expect(useGenerationStore.getState().setI2ISourceImage).toHaveBeenCalledWith(asset));
});

it("blocks incompatible references and unsupported Precise models before opening the picker", async () => {
  useGenerationStore.setState({ preciseReferences: [{ enabled: true }] as never });
  const vibe = await render(<VibeReferenceCard />);
  await fireEvent.press(vibe.getByLabelText("Vibe Transfer 이미지 추가"));
  expect(useGenerationStore.getState().setMessage).toHaveBeenCalledWith("Precise Reference와 Vibe Transfer는 함께 사용할 수 없습니다.");
  await vibe.unmount();
  useGenerationStore.setState({ preciseReferences: [], model: "nai-diffusion-4-full" });
  const precise = await render(<PreciseReferenceCard active />);
  await fireEvent.press(precise.getByLabelText("Precise Reference 이미지 추가"));
  expect(useGenerationStore.getState().setMessage).toHaveBeenCalledWith("Precise Reference는 V4.5 모델에서 사용할 수 있습니다.");
  expect(ImagePicker.requestMediaLibraryPermissionsAsync).not.toHaveBeenCalled();
});

it("connects Vibe settings, enable, removal and normalization to store actions", async () => {
  useGenerationStore.setState({ vibeReferences: [{ id: "v1", enabled: true, strength: 0.6, informationExtracted: 1 }] as never });
  const screen = await render(<VibeReferenceCard />);
  await fireEvent.press(screen.getByLabelText("Reference Strength"));
  await fireEvent.press(screen.getByLabelText("Information Extracted"));
  await fireEvent.press(screen.getByLabelText("Vibe 1 사용"));
  await fireEvent.press(screen.getByLabelText("Vibe 1 삭제"));
  await fireEvent.press(screen.getByLabelText("Normalize Reference Strength Values"));
  const state = useGenerationStore.getState();
  expect(state.setVibeReferenceStrength).toHaveBeenCalledWith("v1", 0.45);
  expect(state.setVibeReferenceInformationExtracted).toHaveBeenCalledWith("v1", 0.45);
  expect(state.setVibeReferenceEnabled).toHaveBeenCalledWith("v1", false);
  expect(state.removeVibeReference).toHaveBeenCalledWith("v1");
  expect(state.setNormalizeVibeStrengths).toHaveBeenCalledWith(true);
});

it("maps Precise mode labels to existing API values and updates fidelity", async () => {
  useGenerationStore.setState({ preciseReferences: [{ id: "p1", enabled: true, referenceType: "character&style", strength: 1, fidelity: 1 }] as never });
  const screen = await render(<PreciseReferenceCard active />);
  await fireEvent.press(screen.getByLabelText("Select mode"));
  await fireEvent.press(screen.getByLabelText("Fidelity"));
  expect(useGenerationStore.getState().setPreciseReferenceType).toHaveBeenCalledWith("p1", "style");
  expect(useGenerationStore.getState().setPreciseReferenceFidelity).toHaveBeenCalledWith("p1", 0.45);
});
