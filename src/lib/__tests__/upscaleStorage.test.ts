import { Directory, File } from "expo-file-system";
import { saveImageToGallery } from "../gallery";
import {
  normalizeUpscaleAlbumName,
  upscaleOutputFilename,
} from "../upscaleFilenames";
import { saveUpscaledImage } from "../upscaleStorage";

const mockCopy = jest.fn();
const mockDelete = jest.fn();
jest.mock("expo-file-system", () => ({
  Paths: { cache: "file:///cache" },
  Directory: jest.fn((root: string, name: string) => ({
    uri: `${root}/${name}`,
    create: jest.fn(),
    delete: mockDelete,
  })),
  File: jest.fn((root: string | { uri: string }, filename?: string) => ({
    uri: filename
      ? `${typeof root === "string" ? root : root.uri}/${filename}`
      : root,
    copy: mockCopy,
  })),
}));
jest.mock("../gallery", () => ({ saveImageToGallery: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(saveImageToGallery).mockResolvedValue();
});

test("rejects dot-only album names even when surrounded by whitespace", () => {
  expect(normalizeUpscaleAlbumName(" .. ").trim()).toBe("");
  expect(normalizeUpscaleAlbumName("../Images")).toBe("_Images");
});

test("preserves long valid filenames and limits UTF-8 length without splitting emoji", () => {
  expect(upscaleOutputFilename(`${"a".repeat(200)}.jpg`, "png")).toBe(
    `${"a".repeat(200)}.png`,
  );
  expect(upscaleOutputFilename(`${"😀".repeat(100)}.jpg`, "webp")).toBe(
    `${"😀".repeat(60)}.webp`,
  );
});

test.each([
  ["drawing.final.PNG", "webp", "drawing.final.webp"],
  ["../../picture.jpg", "png", "picture.png"],
  ["그림.png", "jpg", "그림.jpg"],
  ["", "png", null],
  ["...", "png", null],
] as const)(
  "uses a safe basename and the output extension for %s",
  (source, format, expected) => {
    expect(upscaleOutputFilename(source, format)).toBe(expected);
  },
);

test("saves directly without temporary copies when the source filename is missing", async () => {
  await saveUpscaledImage("file:///output.png", {
    format: "png",
    keepOriginalFilename: true,
    albumName: "",
  });
  expect(saveImageToGallery).toHaveBeenCalledWith("file:///output.png");
  expect(Directory).not.toHaveBeenCalled();
});

test("copies into an isolated directory with the original name and imports into the chosen album", async () => {
  await saveUpscaledImage("file:///output.webp", {
    format: "webp",
    originalFilename: "drawing.png",
    keepOriginalFilename: true,
    albumName: " My Images ",
  });
  const uri = jest.mocked(saveImageToGallery).mock.calls[0][0];
  expect(uri).toMatch(/^file:\/\/\/cache\/upscale-export-.*\/drawing\.webp$/);
  expect(saveImageToGallery).toHaveBeenCalledWith(uri, "My Images");
  expect(mockCopy).toHaveBeenCalled();
  expect(mockDelete).toHaveBeenCalledTimes(1);
});

test("cleans up renamed copies after a gallery failure without deleting the input file", async () => {
  jest
    .mocked(saveImageToGallery)
    .mockRejectedValueOnce(new Error("save denied"));
  await expect(
    saveUpscaledImage("file:///output.jpg", {
      format: "jpg",
      originalFilename: "drawing.png",
      keepOriginalFilename: true,
      albumName: "Images",
    }),
  ).rejects.toThrow("save denied");
  expect(mockDelete).toHaveBeenCalledTimes(1);
  expect(File).toHaveBeenCalledWith("file:///output.jpg");
});

test("ignores the source name when filename preservation is disabled", async () => {
  await saveUpscaledImage("file:///output.jpg", {
    format: "jpg",
    originalFilename: "drawing.png",
    keepOriginalFilename: false,
    albumName: "Images",
  });
  expect(saveImageToGallery).toHaveBeenCalledWith(
    "file:///output.jpg",
    "Images",
  );
  expect(Directory).not.toHaveBeenCalled();
});
