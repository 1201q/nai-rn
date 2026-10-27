import * as MediaLibrary from "expo-media-library";
import { saveImageToGallery } from "../gallery";

jest.mock("expo-media-library", () => ({
  Asset: { create: jest.fn() },
  Album: { create: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

test("saves to the default gallery when no album is specified", async () => {
  await saveImageToGallery("file:///result.png");
  expect(MediaLibrary.Asset.create).toHaveBeenCalledWith("file:///result.png");
  expect(MediaLibrary.Album.create).not.toHaveBeenCalled();
});

test("imports directly into an album without creating an extra default-gallery asset", async () => {
  await saveImageToGallery("file:///result.png", "Upscaled");
  expect(MediaLibrary.Album.create).toHaveBeenCalledWith("Upscaled", [
    "file:///result.png",
  ]);
  expect(MediaLibrary.Asset.create).not.toHaveBeenCalled();
});
