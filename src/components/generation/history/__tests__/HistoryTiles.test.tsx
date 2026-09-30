import { render } from "@testing-library/react-native";
import { Image } from "expo-image";

import type { GenerationRecord } from "../../../../lib/generationHistory";
import { HistorySheetTile } from "../HistoryTiles";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("expo-image", () => ({ Image: jest.fn(() => null) }));
jest.mock("../../../../lib/generationHistory", () => ({
  resolveGenerationThumbnailUri: (record: GenerationRecord) =>
    `thumb:${record.thumbnailPath}`,
}));

test("history tiles show the grid thumbnail", async () => {
  await render(
    <HistorySheetTile
      item={
        {
          id: "gen_1",
          imagePath: "originals/gen_1.png",
          thumbnailPath: "grid-thumbnails/gen_1.jpg",
        } as GenerationRecord
      }
      index={0}
      size={100}
      selectionMode={false}
      selected={false}
      isCurrent={false}
      disabled={false}
      onPress={jest.fn()}
      onLongPress={jest.fn()}
    />,
  );

  expect(jest.mocked(Image).mock.calls[0][0]).toMatchObject({
    source: { uri: "thumb:grid-thumbnails/gen_1.jpg" },
    contentFit: "contain",
  });
});
