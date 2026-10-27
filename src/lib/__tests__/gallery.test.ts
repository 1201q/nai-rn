import { Platform } from "react-native";
import { Directory } from "expo-file-system";
import * as MediaLibrary from "expo-media-library";

import { useGenerationStore } from "../../store/generationStore";
import {
  chooseImageSaveDirectory,
  getImageSaveDirectoryLabel,
  requestGallerySavePermission,
  saveImageToGallery,
} from "../gallery";

const mockBytes = jest.fn();
const mockCopy = jest.fn();
const mockWrite = jest.fn();
const mockDelete = jest.fn();
const mockCreateFile = jest.fn();

jest.mock("expo-file-system", () => ({
  Directory: Object.assign(
    jest.fn(() => ({ createFile: mockCreateFile })),
    {
      pickDirectoryAsync: jest.fn(),
    },
  ),
  File: jest.fn((uri: string) => ({
    extension: uri.endsWith(".webp") ? ".webp" : ".png",
    bytes: mockBytes,
    copy: mockCopy,
  })),
}));

jest.mock("expo-media-library", () => ({
  Asset: { create: jest.fn() },
  requestPermissionsAsync: jest.fn(),
}));

jest.mock("../../store/generationStore", () => {
  const { create } = require("zustand") as typeof import("zustand");
  return {
    useGenerationStore: create<{
      imageSaveDirectory: string | null;
      setImageSaveDirectory: (uri: string | null) => void;
    }>((set) => ({
      imageSaveDirectory: null,
      setImageSaveDirectory: (imageSaveDirectory) =>
        set({ imageSaveDirectory }),
    })),
  };
});

const directoryUri =
  "content://com.android.externalstorage.documents/tree/primary%3APictures%2FNaiRN/";
const originalOS = Platform.OS;

beforeEach(() => {
  jest.clearAllMocks();
  Platform.OS = "android";
  useGenerationStore.setState({ imageSaveDirectory: null });
  mockBytes.mockResolvedValue(new Uint8Array([137, 80, 78, 71]));
  mockCreateFile.mockReturnValue({ write: mockWrite, delete: mockDelete });
  mockWrite.mockImplementation(() => undefined);
});

afterAll(() => {
  Platform.OS = originalOS;
});

test("keeps the default gallery save and write-only permission request", async () => {
  jest
    .mocked(MediaLibrary.requestPermissionsAsync)
    .mockResolvedValue({ granted: true } as Awaited<
      ReturnType<typeof MediaLibrary.requestPermissionsAsync>
    >);
  expect(await requestGallerySavePermission()).toBe(true);
  expect(MediaLibrary.requestPermissionsAsync).toHaveBeenCalledWith(true, [
    "photo",
  ]);
  await saveImageToGallery("file:///image.png");
  expect(MediaLibrary.Asset.create).toHaveBeenCalledWith("file:///image.png");
});

test("selects a folder and avoids unrelated gallery permission requests", async () => {
  jest
    .mocked(Directory.pickDirectoryAsync)
    .mockResolvedValue({ uri: directoryUri } as Directory);
  expect(await chooseImageSaveDirectory()).toBe(true);
  expect(useGenerationStore.getState().imageSaveDirectory).toBe(directoryUri);
  expect(await requestGallerySavePermission()).toBe(true);
  expect(MediaLibrary.requestPermissionsAsync).not.toHaveBeenCalled();
  expect(getImageSaveDirectoryLabel(directoryUri)).toBe("Pictures/NaiRN");
});

test.each(["ERR_PICKER_CANCELLED", "ERR_FILE_PICKING_CANCELLED"])(
  "keeps the previous folder when the picker is cancelled (%s)",
  async (code) => {
    useGenerationStore.setState({ imageSaveDirectory: directoryUri });
    jest.mocked(Directory.pickDirectoryAsync).mockRejectedValue({ code });
    expect(await chooseImageSaveDirectory()).toBe(false);
    expect(useGenerationStore.getState().imageSaveDirectory).toBe(directoryUri);
  },
);

test.each([
  ["png", "image/png"],
  ["webp", "image/webp"],
])(
  "saves original %s bytes to the selected folder with distinct names",
  async (extension, mimeType) => {
    useGenerationStore.setState({ imageSaveDirectory: directoryUri });
    await saveImageToGallery(`file:///image.${extension}`);
    await saveImageToGallery(`file:///image.${extension}`);
    expect(Directory).toHaveBeenCalledWith(directoryUri);
    expect(mockCreateFile).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`^NaiRN-.*\\.${extension}$`)),
      mimeType,
    );
    expect(mockCreateFile.mock.calls[0][0]).not.toBe(
      mockCreateFile.mock.calls[1][0],
    );
    expect(mockWrite).toHaveBeenCalledWith(new Uint8Array([137, 80, 78, 71]));
    expect(mockCopy).not.toHaveBeenCalled();
    expect(MediaLibrary.Asset.create).not.toHaveBeenCalled();
  },
);

test("removes a partial destination on failure without saving elsewhere", async () => {
  useGenerationStore.setState({ imageSaveDirectory: directoryUri });
  mockWrite.mockImplementation(() => {
    throw new Error("permission revoked");
  });
  await expect(saveImageToGallery("file:///image.png")).rejects.toThrow(
    "permission revoked",
  );
  expect(mockDelete).toHaveBeenCalledTimes(1);
  expect(MediaLibrary.Asset.create).not.toHaveBeenCalled();
});

test("renews iOS folder access once before saving a batch after a restart", async () => {
  Platform.OS = "ios";
  useGenerationStore.setState({ imageSaveDirectory: "file:///old-folder" });
  jest
    .mocked(Directory.pickDirectoryAsync)
    .mockResolvedValue({ uri: "file:///new-folder" } as Directory);
  expect(await requestGallerySavePermission()).toBe(true);
  expect(await requestGallerySavePermission()).toBe(true);
  expect(Directory.pickDirectoryAsync).toHaveBeenCalledTimes(1);
  await saveImageToGallery("file:///image.png");
  expect(mockCopy).toHaveBeenCalledWith(expect.anything(), { overwrite: true });
  expect(MediaLibrary.Asset.create).not.toHaveBeenCalled();
});
