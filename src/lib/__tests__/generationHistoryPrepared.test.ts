import {
  prepareNativeGenerationFiles,
  savePreparedGeneration,
} from "../generationHistory";
import { extractImageMetadata } from "../imageMetadata";

const mockRun = jest.fn();
const mockDelete = jest.fn();
const mockBytes = jest.fn();
jest.mock("../imageMetadata", () => ({ extractImageMetadata: jest.fn() }));
jest.mock("expo-sqlite", () => ({
  openDatabaseAsync: async () => ({ execAsync: jest.fn(), runAsync: mockRun }),
}));
jest.mock("expo-image-manipulator", () => ({}));
jest.mock("expo-file-system", () => {
  class Directory {
    uri: string;
    constructor(...parts: Array<string | { uri: string }>) {
      this.uri = parts
        .map((p) => (typeof p === "string" ? p : p.uri))
        .join("/");
    }
    create() {}
  }
  class File extends Directory {
    exists = true;
    delete() {
      mockDelete(this.uri);
    }
    bytes() {
      return mockBytes();
    }
    write() {
      throw Error("Native output must not be written in JS");
    }
  }
  return { Directory, File, Paths: { document: "file:///documents" } };
});
const input = {
  prompt: "test",
  negativePrompt: "",
  model: "test",
  sampler: "test",
  noiseSchedule: "karras" as const,
  width: 832,
  height: 1216,
  steps: 28,
  scale: 5,
  cfgRescale: 0,
  seed: 42,
  metadata: { Comment: "test" },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockRun.mockResolvedValue({});
  mockBytes.mockImplementation(() => {
    throw Error("Native output must not be read in JS");
  });
});

test("registers prepared files without file reads or thumbnail regeneration", async () => {
  const files = await prepareNativeGenerationFiles("png");
  expect(files.imagePath).toBe(`originals/${files.id}.png`);
  const record = await savePreparedGeneration(files, input, false);
  expect(record).toMatchObject({
    imagePath: files.imagePath,
    thumbnailPath: null,
    metadataJson: '{"Comment":"test"}',
  });
  expect(record).not.toHaveProperty("metadata");
  expect(mockRun).toHaveBeenCalledTimes(1);
  expect(mockDelete).not.toHaveBeenCalled();
});

test("reads stealth metadata in JS when the native module finds none", async () => {
  const bytes = new Uint8Array([1]);
  mockBytes.mockResolvedValueOnce(bytes);
  jest.mocked(extractImageMetadata).mockReturnValueOnce({ Comment: "webp" });
  const files = await prepareNativeGenerationFiles("webp");
  expect(files.imagePath).toBe(`originals/${files.id}.webp`);
  const record = await savePreparedGeneration(
    files,
    { ...input, metadata: {} },
    true,
  );
  expect(extractImageMetadata).toHaveBeenCalledWith(bytes);
  expect(record.metadataJson).toBe('{"Comment":"webp"}');
});

test("keeps the generation when the metadata fallback fails", async () => {
  const files = await prepareNativeGenerationFiles("webp");
  const record = await savePreparedGeneration(
    files,
    { ...input, metadata: {} },
    true,
  );
  expect(record.metadataJson).toBe("{}");
  expect(mockDelete).not.toHaveBeenCalled();
});

test("removes both prepared files if the DB insert fails", async () => {
  const files = await prepareNativeGenerationFiles("png");
  mockRun.mockRejectedValueOnce(new Error("DB failure"));
  await expect(savePreparedGeneration(files, input, true)).rejects.toThrow(
    "DB failure",
  );
  expect(mockDelete.mock.calls.map(([uri]) => uri)).toEqual([
    files.originalUri,
    files.thumbnailUri,
  ]);
});
