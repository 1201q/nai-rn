import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import type { GenerationRecord } from "../../../../../lib/generationHistory";
import { MetadataSheetContent } from "../MetadataSheetContent";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("@gorhom/bottom-sheet", () => {
  const { ScrollView } = require("react-native") as typeof import("react-native");
  return { BottomSheetScrollView: ScrollView };
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
      qualityToggle: true,
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
  test("shows the current image record with its embedded metadata", async () => {
    const screen = await render(
      <MetadataSheetContent generation={generation} />,
    );

    expect(screen.getByText("V4.5 Full")).toBeTruthy();
    expect(screen.getByText("832 x 1216")).toBeTruthy();
    expect(screen.queryByText("CURRENT IMAGE")).toBeNull();
    expect(screen.getByText("embedded prompt")).toBeTruthy();
    expect(screen.queryByText("embedded negative prompt")).toBeNull();
    await fireEvent.press(
      screen.getByRole("radio", { name: "Undesired Content" }),
    );
    expect(screen.getByText("embedded negative prompt")).toBeTruthy();
    expect(screen.getByText("Character 1")).toBeTruthy();
    expect(screen.getByText("character prompt")).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("radio", {
        name: "Character 1 Undesired Content",
      }),
    );
    expect(screen.getByText("character negative prompt")).toBeTruthy();
    expect(screen.getByText("123456")).toBeTruthy();
    expect(screen.getByText("QUALITY TAGS")).toBeTruthy();
    expect(screen.getByText("UC PRESET")).toBeTruthy();
    expect(screen.getByText("ID generation-1")).toBeTruthy();

    const scroll = screen.getByTestId("metadata-scroll");
    expect(StyleSheet.flatten(scroll.props.contentContainerStyle)).toMatchObject({
      paddingBottom: 200,
    });
  });

});
