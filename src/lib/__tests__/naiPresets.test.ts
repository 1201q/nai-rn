import {
  inferUcPreset,
  mergeQualityTags,
  mergeUcPreset,
  stripUcPreset,
} from "../naiPresets";
import { getVarietyPlusSigma } from "../novelai";

const V45_FULL_HEAVY =
  "lowres, artistic error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, dithering, halftone, screentone, multiple views, logo, too many watermarks, negative space, blank page";

describe("quality tags (official web parity)", () => {
  it("uses the model-specific suffix", () => {
    expect(mergeQualityTags("1girl", true, "nai-diffusion-4-5-full")).toBe(
      "1girl, very aesthetic, masterpiece, no text",
    );
    expect(mergeQualityTags("1girl", true, "nai-diffusion-4-5-curated")).toBe(
      "1girl, very aesthetic, masterpiece, no text, -0.8::feet::, rating:general",
    );
    expect(mergeQualityTags("1girl", true, "nai-diffusion-3")).toBe(
      "1girl, best quality, amazing quality, very aesthetic, absurdres",
    );
    expect(mergeQualityTags("1girl", false, "nai-diffusion-3")).toBe("1girl");
  });

  it("does not leave a leading separator for an empty prompt", () => {
    expect(mergeQualityTags("", true, "nai-diffusion-4-5-full")).toBe(
      "very aesthetic, masterpiece, no text",
    );
  });

  it("inserts V4+ tags before the Text: block", () => {
    expect(
      mergeQualityTags("1girl, Text: hello", true, "nai-diffusion-4-5-full"),
    ).toBe("1girl,, very aesthetic, masterpiece, no text Text: hello");
  });
});

describe("UC presets (official web parity)", () => {
  it("prepends nsfw only when the prompt does not mention it", () => {
    expect(mergeUcPreset("", 0, "nai-diffusion-4-5-full", "1girl")).toBe(
      `nsfw, ${V45_FULL_HEAVY}`,
    );
    expect(
      mergeUcPreset("bad hands", 0, "nai-diffusion-4-5-full", "1girl, NSFW"),
    ).toBe(`${V45_FULL_HEAVY}, bad hands`);
  });

  it("never adds nsfw for curated models or the None preset", () => {
    expect(
      mergeUcPreset("", 0, "nai-diffusion-4-5-curated", "1girl"),
    ).toMatch(/^blurry, lowres, upscaled/);
    expect(mergeUcPreset("hat", 4, "nai-diffusion-4-5-full", "1girl")).toBe(
      "hat",
    );
  });

  it("falls back to None for presets a model lacks", () => {
    expect(
      mergeUcPreset("hat", 3, "nai-diffusion-4-curated-preview", "1girl"),
    ).toBe("hat");
  });

  it("uses the V3 lowres default for None with an empty UC", () => {
    expect(mergeUcPreset("", 4, "nai-diffusion-3", "1girl")).toBe("lowres");
    expect(mergeUcPreset("hat", 4, "nai-diffusion-3", "1girl")).toBe("hat");
  });

  it("round-trips imported UC with or without nsfw", () => {
    for (const merged of [
      `nsfw, ${V45_FULL_HEAVY}, hat`,
      `${V45_FULL_HEAVY}, hat`,
    ]) {
      const preset = inferUcPreset(merged, "nai-diffusion-4-5-full");
      expect(preset).toBe(0);
      expect(stripUcPreset(merged, preset, "nai-diffusion-4-5-full")).toBe(
        "hat",
      );
    }
  });
});

describe("Variety+ sigma (official web parity)", () => {
  it("scales the model base sigma by latent size", () => {
    expect(getVarietyPlusSigma("nai-diffusion-4-5-full", 832, 1216)).toBe(58);
    expect(getVarietyPlusSigma("nai-diffusion-4-curated-preview", 832, 1216)).toBe(19);
    expect(getVarietyPlusSigma("nai-diffusion-3", 832, 1216)).toBe(19);
    expect(getVarietyPlusSigma("nai-diffusion-4-5-full", 1024, 1536)).toBeCloseTo(72.32, 2);
  });
});
