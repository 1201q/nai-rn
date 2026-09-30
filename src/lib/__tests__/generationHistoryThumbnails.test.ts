import * as ImageManipulator from "expo-image-manipulator";

import {
  prepareNativeGenerationFiles,
  resolveGenerationThumbnailUri,
  saveGenerationImageBase64,
} from "../generationHistory";

const mockRun = jest.fn();
jest.mock("expo-sqlite", () => ({
  openDatabaseAsync: async () => ({ execAsync: jest.fn(), runAsync: mockRun }),
}));
jest.mock("expo-image-manipulator", () => ({
  manipulateAsync: jest.fn(async () => ({ uri: "file:///cache/thumb.jpg" })),
  SaveFormat: { JPEG: "jpeg" },
}));
jest.mock("../pngMetadata", () => ({ extractPngTextMetadata: () => ({}) }));
jest.mock("expo-file-system", () => {
  class Directory {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = parts
        .map((p) => (typeof p === "string" ? p : p.uri))
        .join("/");
    }
    create() {}
  }
  class File extends Directory {
    exists = true;
    write() {}
    delete() {}
    async bytes() {
      return new Uint8Array();
    }
    async copy() {}
  }
  return { Directory, File, Paths: { document: "file:///documents" } };
});

const mockManipulate = jest.mocked(ImageManipulator.manipulateAsync);
const ROOT = "file:///documents/nai-images";

function recordInput(width: number, height: number) {
  return {
    imageBase64: "",
    prompt: "test",
    negativePrompt: "",
    model: "test",
    sampler: "test",
    noiseSchedule: "karras" as const,
    width,
    height,
    steps: 28,
    scale: 5,
    cfgRescale: 0,
    seed: 42,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRun.mockResolvedValue({});
});

test("prepares native thumbnails in the aspect-fit thumbnail directory", async () => {
  const files = await prepareNativeGenerationFiles();
  expect(files.thumbnailPath).toBe(`grid-thumbnails/${files.id}.jpg`);
  expect(files.thumbnailUri).toBe(`${ROOT}/grid-thumbnails/${files.id}.jpg`);
});

test.each([
  [832, 1216, { height: 512 }],
  [1216, 832, { width: 512 }],
  [1024, 1024, { width: 512 }],
])(
  "resizes a %ix%i image to a 512px long side without cropping",
  async (width, height, resize) => {
    const record = await saveGenerationImageBase64(recordInput(width, height));

    expect(mockManipulate).toHaveBeenCalledWith(
      expect.any(String),
      [{ resize }],
      {
        compress: 0.9,
        format: "jpeg",
      },
    );
    expect(record.thumbnailPath).toBe(`grid-thumbnails/${record.id}.jpg`);
  },
);

test("uses aspect-fit thumbnails and falls back to the original otherwise", () => {
  expect(
    resolveGenerationThumbnailUri({
      imagePath: "originals/a.png",
      thumbnailPath: "grid-thumbnails/a.jpg",
    }),
  ).toBe(`${ROOT}/grid-thumbnails/a.jpg`);
  // Older records only have center-cropped square thumbnails.
  expect(
    resolveGenerationThumbnailUri({
      imagePath: "originals/b.png",
      thumbnailPath: "thumbnails/b.jpg",
    }),
  ).toBe(`${ROOT}/originals/b.png`);
  expect(
    resolveGenerationThumbnailUri({
      imagePath: "originals/c.png",
      thumbnailPath: null,
    }),
  ).toBe(`${ROOT}/originals/c.png`);
});
