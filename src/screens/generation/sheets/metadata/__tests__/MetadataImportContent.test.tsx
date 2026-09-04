import { fireEvent, render } from "@testing-library/react-native";

import type { GenerationRecord } from "../../../../../lib/generationHistory";
import { MetadataImportContent } from "../MetadataImportContent";

const mockApplyMetadataImport = jest.fn();
const mockToastSuccess = jest.fn();

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("@gorhom/bottom-sheet", () => {
  const { ScrollView } = require("react-native") as typeof import("react-native");
  return { BottomSheetScrollView: ScrollView };
});
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock("sonner-native", () => ({
  toast: { success: (...args: unknown[]) => mockToastSuccess(...args) },
}));
jest.mock("../../../../../store/generationStore", () => ({
  useGenerationStore: (selector: (state: object) => unknown) =>
    selector({ applyMetadataImport: mockApplyMetadataImport }),
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
  height: 1210,
  steps: 28,
  scale: 5,
  cfgRescale: 0,
  seed: 123456,
  createdAt: 1,
  metadataJson: JSON.stringify({
    Comment: JSON.stringify({
      prompt: "embedded prompt",
      uc: "embedded negative",
      v4_prompt: {
        caption: {
          char_captions: [{ char_caption: "character prompt" }],
        },
      },
    }),
  }),
};

describe("MetadataImportContent", () => {
  beforeEach(() => jest.clearAllMocks());

  test("applies the selected metadata with the chosen character mode", async () => {
    const onImported = jest.fn();
    const screen = await render(
      <MetadataImportContent
        generation={generation}
        onImported={onImported}
      />,
    );

    expect(screen.getByRole("checkbox", { name: "Prompt" }).props.accessibilityState)
      .toMatchObject({ checked: true });
    expect(screen.getByRole("checkbox", { name: "Seed" }).props.accessibilityState)
      .toMatchObject({ checked: false });

    await fireEvent.press(screen.getByRole("radio", { name: "Append" }));
    await fireEvent.press(screen.getByRole("checkbox", { name: "Seed" }));
    await fireEvent.press(
      screen.getByRole("button", { name: "선택 항목 가져오기" }),
    );

    expect(mockApplyMetadataImport).toHaveBeenCalledTimes(1);
    expect(mockApplyMetadataImport.mock.calls[0][1]).toMatchObject({
      prompt: true,
      negativePrompt: true,
      characters: true,
      characterMode: "append",
      settings: true,
      seed: true,
    });
    expect(mockToastSuccess).toHaveBeenCalledWith("메타데이터를 가져왔습니다.");
    expect(onImported).toHaveBeenCalledTimes(1);
  });
});
