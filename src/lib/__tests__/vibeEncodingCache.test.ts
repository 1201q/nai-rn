jest.mock("expo-file-system", () => ({}));
jest.mock("expo-image-manipulator", () => ({}));
jest.mock("expo-sqlite", () => ({}));

import { canUseCachedVibeEncoding, type VibeReference } from "../vibeReferences";

const reference: VibeReference = {
  id: "vibe-1",
  imagePath: "image.jpg",
  thumbnailPath: null,
  encodedPath: "encoded.bin",
  enabled: true,
  strength: 0.6,
  informationExtracted: 0.7,
  encodedInformationExtracted: 0.7,
  encodedModel: "nai-diffusion-4-5-curated",
  createdAt: 1,
  updatedAt: 1,
};

describe("vibe encoding cache", () => {
  it("reuses an encoding only for the model it was encoded with", () => {
    expect(canUseCachedVibeEncoding(reference, "nai-diffusion-4-5-curated")).toBe(true);
    expect(canUseCachedVibeEncoding(reference, "nai-diffusion-4-5-full")).toBe(false);
  });

  it("treats encodings saved before model tracking as V4.5 Full", () => {
    const legacy = { ...reference, encodedModel: null };
    expect(canUseCachedVibeEncoding(legacy, "nai-diffusion-4-5-full")).toBe(true);
    expect(canUseCachedVibeEncoding(legacy, "nai-diffusion-4-curated-preview")).toBe(false);
  });

  it("requires the same Information Extracted value", () => {
    expect(
      canUseCachedVibeEncoding(
        { ...reference, informationExtracted: 0.5 },
        "nai-diffusion-4-5-curated",
      ),
    ).toBe(false);
  });
});
