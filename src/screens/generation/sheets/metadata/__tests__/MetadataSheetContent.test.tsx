import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import * as Clipboard from "expo-clipboard";

import type { GenerationRecord } from "../../../../../lib/generationHistory";
import { MetadataSheetContent } from "../MetadataSheetContent";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("expo-linear-gradient", () => ({ LinearGradient: () => null }));
jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn() }));
jest.mock("@gorhom/bottom-sheet", () => {
  const { ScrollView } =
    require("react-native") as typeof import("react-native");
  return { BottomSheetScrollView: ScrollView };
});
jest.mock("../../../../../components/forms/PromptHighlightTextInput", () => {
  const React = require("react") as typeof import("react");
  const { TextInput } =
    require("react-native") as typeof import("react-native");
  return {
    PromptHighlightTextInput: React.forwardRef(function MockPromptInput(
      props: import("react-native").TextInputProps,
      ref: import("react").ForwardedRef<import("react-native").TextInput>,
    ) {
      return React.createElement(TextInput, { ...props, ref });
    }),
  };
});
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const generation: GenerationRecord = {
  id: "generation-1",
  imagePath: "originals/generation-1.png",
  thumbnailPath: null,
  prompt: "record prompt",
  negativePrompt: "record negative prompt",
  model: "nai-diffusion-4-5-full",
  sampler: "k_euler_ancestral",
  noiseSchedule: "karras",
  width: 832,
  height: 1216,
  steps: 28,
  scale: 5,
  cfgRescale: 0,
  seed: 123456,
  createdAt: new Date("2026-09-04T12:00:00Z").getTime(),
  metadataJson: JSON.stringify({
    Source: "NovelAI Diffusion V4.5",
    Comment: JSON.stringify({
      prompt: "embedded prompt",
      uc: "embedded negative prompt",
      width: 832,
      height: 1216,
      steps: 28,
      scale: 5,
      cfg_rescale: 0,
      sampler: "k_euler_ancestral",
      noise_schedule: "karras",
      seed: 123456,
      qualityPreset: "standard" as const,
      ucPreset: 0,
      v4_prompt: {
        caption: {
          char_captions: [{ char_caption: "character prompt" }],
        },
      },
      v4_negative_prompt: {
        caption: {
          char_captions: [{ char_caption: "character negative prompt" }],
        },
      },
    }),
  }),
};

describe("MetadataSheetContent", () => {
  test("displays extracted metadata without a generated record", async () => {
    const screen = await render(
      <MetadataSheetContent
        generation={{
          metadataJson: JSON.stringify({
            Comment: JSON.stringify({ prompt: "external prompt", seed: 42 }),
          }),
        }}
        onImport={jest.fn()}
      />,
    );
    expect(screen.getByDisplayValue("external prompt")).toBeTruthy();
    expect(screen.getByText("42")).toBeTruthy();
    expect(screen.queryByText("Created")).toBeNull();
    expect(screen.queryByText(/undefined/)).toBeNull();
    expect(screen.queryByText(/^ID /)).toBeNull();
  });
  test("shows the current image record with its embedded metadata", async () => {
    const onImport = jest.fn();
    const screen = await render(
      <MetadataSheetContent generation={generation} onImport={onImport} />,
    );

    expect(screen.getByText("V4.5 Full")).toBeTruthy();
    expect(screen.getByText("832 x 1216")).toBeTruthy();
    expect(screen.queryByText("CURRENT IMAGE")).toBeNull();
    // 탭 전환 없이 Base와 Undesired Content를 모두 펼쳐 보여준다.
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.getByDisplayValue("embedded prompt")).toBeTruthy();
    expect(screen.getByDisplayValue("embedded negative prompt")).toBeTruthy();
    expect(screen.getByText("Character 1")).toBeTruthy();
    expect(screen.getByDisplayValue("character prompt")).toBeTruthy();
    expect(screen.getByDisplayValue("character negative prompt")).toBeTruthy();
    expect(screen.getByText("123456")).toBeTruthy();
    expect(screen.getByText("Quality Tags")).toBeTruthy();
    expect(screen.getByText("UC Preset")).toBeTruthy();
    expect(screen.getByText("ID generation-1")).toBeTruthy();

    const basePrompt = screen.getByLabelText("Undesired Content text");
    expect(basePrompt.props).toMatchObject({
      caretHidden: true,
      editable: false,
      showSoftInputOnFocus: false,
    });
    expect(StyleSheet.flatten(basePrompt.props.style)).toMatchObject({
      lineHeight: 23,
    });
    expect(
      screen.getByLabelText("Character 1 Undesired Content text").props
        .editable,
    ).toBe(false);

    // 스크롤 끝이 플로팅 버튼(액션바 72 + 간격 12 + 버튼 48 + 여유 24)에 가려지지 않는다.
    const scroll = screen.getByTestId("metadata-scroll");
    expect(
      StyleSheet.flatten(scroll.props.contentContainerStyle),
    ).toMatchObject({
      paddingBottom: 156,
    });

    await fireEvent.press(
      screen.getByRole("button", { name: "설정으로 가져오기" }),
    );
    expect(onImport).toHaveBeenCalledTimes(1);
  });

  test("copies prompts and the seed", async () => {
    const screen = await render(
      <MetadataSheetContent generation={generation} onImport={jest.fn()} />,
    );

    await fireEvent.press(
      screen.getByRole("button", { name: "Base Prompt 복사" }),
    );
    expect(Clipboard.setStringAsync).toHaveBeenLastCalledWith(
      "embedded prompt",
    );
    await fireEvent.press(
      screen.getByRole("button", {
        name: "Character 1 Undesired Content 복사",
      }),
    );
    expect(Clipboard.setStringAsync).toHaveBeenLastCalledWith(
      "character negative prompt",
    );
    await fireEvent.press(screen.getByRole("button", { name: "Seed 복사" }));
    expect(Clipboard.setStringAsync).toHaveBeenLastCalledWith("123456");
  });

  test("shows a placeholder and disables copy for an empty prompt", async () => {
    const screen = await render(
      <MetadataSheetContent
        generation={{
          metadataJson: JSON.stringify({
            Comment: JSON.stringify({ prompt: "external prompt" }),
          }),
        }}
        onImport={jest.fn()}
      />,
    );

    expect(screen.getByText("없음")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Undesired Content 복사" }).props
        .accessibilityState,
    ).toMatchObject({ disabled: true });
  });
});
