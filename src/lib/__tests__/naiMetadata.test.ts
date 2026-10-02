import { parseNaiMetadata } from "../naiMetadata";

const HEAVY =
  "lowres, artistic error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, dithering, halftone, screentone, multiple views, logo, too many watermarks, negative space, blank page";

function parse(source: string, comment: Record<string, unknown>) {
  return parseNaiMetadata({ Source: source, Comment: JSON.stringify(comment) });
}

describe("V5 metadata", () => {
  it("maps known Full hashes to V5 Full and other V5 sources to V5 Curated", () => {
    expect(parse("NovelAI Diffusion V5 657484A5", {}).model).toBe(
      "nai-diffusion-5-full",
    );
    expect(parse("NovelAI Diffusion V5 DB276663", {}).model).toBe(
      "nai-diffusion-5-curated",
    );
  });

  it("infers presets from the prompt text, ignoring a numeric ucPreset", () => {
    const parsed = parse("NovelAI Diffusion V5 657484A5", {
      prompt: "1girl, very aesthetic, masterpiece, no text",
      uc: `nsfw, ${HEAVY}, bad hands`,
      // V5 웹의 ID 체계(2 = Heavy)는 앱 인덱스(2 = Furry Focus)와 다르다.
      ucPreset: 2,
    });

    expect(parsed.prompt).toBe("1girl");
    expect(parsed.qualityToggle).toBe(true);
    expect(parsed.ucPreset).toBe(0);
    expect(parsed.negativePrompt).toBe("bad hands");
  });

  it("still reads the numeric ucPreset for V4.5", () => {
    expect(
      parse("NovelAI Diffusion V4.5 4BDE2A90", { uc: "x", ucPreset: 3 })
        .ucPreset,
    ).toBe(3);
  });
});
