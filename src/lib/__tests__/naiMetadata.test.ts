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
    expect(parsed.qualityPreset).toBe("standard");
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

describe("imported character limit", () => {
  const comment = {
    v4_prompt: {
      caption: {
        char_captions: Array.from({ length: 8 }, (_, index) => ({
          char_caption: `character ${index}`,
          centers: [{ x: 0.5, y: 0.5 }],
        })),
      },
    },
  };

  it("keeps more than six characters for V5 images", () => {
    expect(
      parse("NovelAI Diffusion V5 657484A5", comment).characters,
    ).toHaveLength(8);
  });

  it("keeps the six character limit for V4.5 images", () => {
    expect(
      parse("NovelAI Diffusion V4.5 4BDE2A90", comment).characters,
    ).toHaveLength(6);
  });
});

describe("V5 auto Text block on import", () => {
  it("removes the generated teXt: block before detecting quality tags", () => {
    const parsed = parse("NovelAI Diffusion V5 657484A5", {
      prompt:
        '1girl, "hello", very aesthetic, masterpiece, no text, teXt: hello\n\nworld',
    });

    expect(parsed.prompt).toBe('1girl, "hello"');
    expect(parsed.qualityPreset).toBe("standard");
  });

  it("keeps a hand-written Text: block", () => {
    expect(
      parse("NovelAI Diffusion V5 657484A5", { prompt: "1girl, Text: hello" })
        .prompt,
    ).toBe("1girl, Text: hello");
  });
});

// UC 문자열이 어떤 프리셋으로도 시작하지 않으면 None으로 생성된 것이다.
describe("UC preset None on import", () => {
  it("infers None for a V5 image whose UC matches no preset", () => {
    const parsed = parse("NovelAI Diffusion V5 657484A5", {
      prompt: "1girl",
      uc: "bad hands",
    });

    expect(parsed.ucPreset).toBe(4);
    expect(parsed.negativePrompt).toBe("bad hands");
  });

  it("infers None and an empty UC for a V5 image generated without UC", () => {
    const parsed = parse("NovelAI Diffusion V5 657484A5", {
      prompt: "1girl",
      uc: "",
      v4_negative_prompt: { caption: { base_caption: "", char_captions: [] } },
    });

    expect(parsed.ucPreset).toBe(4);
    expect(parsed.negativePrompt).toBe("");
  });

  it("leaves the UC untouched when the image has no UC field", () => {
    const parsed = parse("NovelAI Diffusion V5 657484A5", { prompt: "1girl" });

    expect(parsed.ucPreset).toBeUndefined();
    expect(parsed.negativePrompt).toBeUndefined();
  });
});

describe("character position mode on import", () => {
  const withCoords = (useCoords: unknown) => ({
    v4_prompt: {
      caption: {
        char_captions: [
          { char_caption: "a", centers: [{ x: 0.1, y: 0.1 }] },
          { char_caption: "b", centers: [{ x: 0.9, y: 0.9 }] },
        ],
      },
      use_coords: useCoords,
    },
  });

  it.each([true, false])("reads use_coords %s", (useCoords) => {
    expect(
      parse("NovelAI Diffusion V4.5 4BDE2A90", withCoords(useCoords))
        .characterPositionEnabled,
    ).toBe(useCoords);
  });

  it("leaves the mode untouched when use_coords is missing", () => {
    expect(
      parse("NovelAI Diffusion V4.5 4BDE2A90", withCoords(undefined))
        .characterPositionEnabled,
    ).toBeUndefined();
  });
});

describe("quality preset on import", () => {
  it("infers Light from the V5 prompt suffix", () => {
    const parsed = parse("NovelAI Diffusion V5 657484A5", {
      prompt: "1girl, very aesthetic, amazing quality, no text",
    });

    expect(parsed.qualityPreset).toBe("light");
    expect(parsed.prompt).toBe("1girl");
  });

  it("prefers qualityPresetId when the image has it", () => {
    expect(
      parse("NovelAI Diffusion V5 657484A5", {
        prompt: "1girl",
        qualityPresetId: "none",
      }).qualityPreset,
    ).toBe("none");
  });

  it("maps the V4.5 qualityToggle", () => {
    expect(
      parse("NovelAI Diffusion V4.5 4BDE2A90", {
        prompt: "1girl, very aesthetic, masterpiece, no text",
        qualityToggle: true,
      }).qualityPreset,
    ).toBe("standard");
    expect(
      parse("NovelAI Diffusion V4.5 4BDE2A90", {
        prompt: "1girl",
        qualityToggle: false,
      }).qualityPreset,
    ).toBe("none");
  });
});

describe("transparent background on import", () => {
  it("restores the option and removes its tag before detecting quality", () => {
    const parsed = parse("NovelAI Diffusion V5 657484A5", {
      prompt:
        "solo, cat, transparent background, very aesthetic, masterpiece, no text",
      qualityPresetId: "standard",
      tag_hint_transparent_background: true,
    });

    expect(parsed.transparentBackground).toBe(true);
    expect(parsed.prompt).toBe("solo, cat");
  });

  it("matches the captured web request without quality tags", () => {
    const parsed = parse("NovelAI Diffusion V5 657484A5", {
      prompt: "solo, cat, transparent background",
      qualityPresetId: "none",
      tag_hint_transparent_background: true,
    });

    expect(parsed.prompt).toBe("solo, cat");
  });

  it("turns the option off for V5 images without the hint", () => {
    const parsed = parse("NovelAI Diffusion V5 657484A5", {
      prompt: "solo, transparent background",
    });

    expect(parsed.transparentBackground).toBe(false);
    expect(parsed.prompt).toBe("solo, transparent background");
  });

  it("leaves the option untouched for older models", () => {
    expect(
      parse("NovelAI Diffusion V4.5 4BDE2A90", { prompt: "1girl" })
        .transparentBackground,
    ).toBeUndefined();
  });
});
