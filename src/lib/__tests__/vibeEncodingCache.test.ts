jest.mock("expo-file-system", () => ({}));
jest.mock("expo-image-manipulator", () => ({}));
jest.mock("expo-sqlite", () => ({}));

import { canUseCachedVibeEncoding, type VibeReference } from "../vibeReferences";

const reference: VibeReference = {
  id: "vibe-1",
  imagePath: "image.jpg",
  thumbnailPath: null,
  enabled: true,
  strength: 0.6,
  informationExtracted: 0.7,
  encodings: [
    { model: "nai-diffusion-4-5-curated", informationExtracted: 0.7, path: "curated.bin" },
    { model: "nai-diffusion-4-5-full", informationExtracted: 0.7, path: "full.bin" },
  ],
  createdAt: 1,
  updatedAt: 1,
};

describe("vibe encoding cache", () => {
  it("keeps a separate encoding per model", () => {
    expect(canUseCachedVibeEncoding(reference, "nai-diffusion-4-5-curated")).toBe(true);
    expect(canUseCachedVibeEncoding(reference, "nai-diffusion-4-5-full")).toBe(true);
    expect(canUseCachedVibeEncoding(reference, "nai-diffusion-4-curated-preview")).toBe(false);
  });

  it("requires the current Information Extracted value", () => {
    expect(
      canUseCachedVibeEncoding(
        { ...reference, informationExtracted: 0.5 },
        "nai-diffusion-4-5-curated",
      ),
    ).toBe(false);
  });

  it("has no cache without encodings", () => {
    expect(
      canUseCachedVibeEncoding({ ...reference, encodings: [] }, "nai-diffusion-4-5-full"),
    ).toBe(false);
  });
});
