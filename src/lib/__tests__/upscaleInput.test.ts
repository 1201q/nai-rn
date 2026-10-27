import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { imageUpscaler } from "../../../modules/image-upscaler";
import { pickUpscaleFiles, pickUpscaleGalleryImages } from "../upscaleInput";

jest.mock("expo-file-system", () => ({ File: { pickFileAsync: jest.fn() } }));
jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock("../../../modules/image-upscaler", () => ({
  imageUpscaler: { getInputInfo: jest.fn() },
}));

beforeEach(() => {
  jest.resetAllMocks();
});

test("preserves gallery filenames when present and supports missing names", async () => {
  jest
    .mocked(ImagePicker.requestMediaLibraryPermissionsAsync)
    .mockResolvedValue({ granted: true } as never);
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
    canceled: false,
    assets: [
      {
        uri: "file:///picked.png",
        width: 10,
        height: 20,
        fileName: "original.png",
      },
      { uri: "file:///other.png", width: 30, height: 40 },
    ],
  } as never);
  expect(await pickUpscaleGalleryImages()).toEqual([
    {
      uri: "file:///picked.png",
      width: 10,
      height: 20,
      originalFilename: "original.png",
    },
    { uri: "file:///other.png", width: 30, height: 40, originalFilename: null },
  ]);
});

test("does not open the gallery after permission denial", async () => {
  jest
    .mocked(ImagePicker.requestMediaLibraryPermissionsAsync)
    .mockResolvedValue({ granted: false } as never);
  await expect(pickUpscaleGalleryImages()).rejects.toThrow(
    "PHOTO_PERMISSION_DENIED",
  );
  expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
});

test("canceling gallery selection adds no images", async () => {
  jest
    .mocked(ImagePicker.requestMediaLibraryPermissionsAsync)
    .mockResolvedValue({ granted: true } as never);
  jest
    .mocked(ImagePicker.launchImageLibraryAsync)
    .mockResolvedValue({ canceled: true, assets: null });
  expect(await pickUpscaleGalleryImages()).toEqual([]);
});

test("reads original content-provider names and skips unreadable files without requesting gallery access", async () => {
  jest.mocked(File.pickFileAsync).mockResolvedValue({
    canceled: false,
    result: [{ uri: "content://document/1" }, { uri: "content://document/2" }],
  } as never);
  jest
    .mocked(imageUpscaler!.getInputInfo)
    .mockResolvedValueOnce({
      width: 100,
      height: 200,
      filename: "my-photo.png",
    })
    .mockRejectedValueOnce(new Error("UNSUPPORTED_IMAGE"));
  expect(await pickUpscaleFiles()).toEqual({
    images: [
      {
        uri: "content://document/1",
        width: 100,
        height: 200,
        originalFilename: "my-photo.png",
      },
    ],
    rejected: 1,
  });
  expect(File.pickFileAsync).toHaveBeenCalledWith({
    multipleFiles: true,
    mimeTypes: "image/*",
  });
  expect(
    ImagePicker.requestMediaLibraryPermissionsAsync,
  ).not.toHaveBeenCalled();
});

test("canceling the file picker leaves the queue unchanged", async () => {
  jest
    .mocked(File.pickFileAsync)
    .mockResolvedValue({ canceled: true, result: null } as never);
  expect(await pickUpscaleFiles()).toEqual({ images: [], rejected: 0 });
  expect(imageUpscaler!.getInputInfo).not.toHaveBeenCalled();
});
