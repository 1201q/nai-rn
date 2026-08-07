import { calculatePromptTokenMetrics } from "../metrics";

jest.mock("../loader", () => ({
  getPromptTokenizer: async (type: "t5" | "clip") => ({
    encode: (text: string) =>
      Array.from({
        length: text.length + (type === "t5" ? 1 : 0),
      }, (_, index) => index),
  }),
}));

const snapshot = {
  model: "nai-diffusion-4-5-full",
  prompt: "base",
  negativePrompt: "neg",
  qualityToggle: false,
  ucPreset: 4 as const,
  characterPrompts: [
    {
      id: "character-1",
      prompt: "hero",
      negativePrompt: "",
      enabled: true,
      position: { x: 0.2, y: 0.4 },
    },
    {
      id: "character-2",
      prompt: "",
      negativePrompt: "hat",
      enabled: true,
      position: { x: 0.8, y: 0.4 },
    },
    {
      id: "character-disabled",
      prompt: "unused",
      negativePrompt: "",
      enabled: false,
      position: { x: 0.5, y: 0.5 },
    },
  ],
};

describe("prompt token metrics", () => {
  it("shares the V4 positive budget with all active characters", async () => {
    await expect(
      calculatePromptTokenMetrics(
        snapshot,
        {
          scope: "character",
          characterId: "character-1",
          channel: "positive",
        },
        "longer",
      ),
    ).resolves.toMatchObject({
      status: "ready",
      fieldTokens: 6 + 1,
      totalTokens: 4 + 1 + (6 + 1) + 1,
      maxTokens: 512,
      includedInTotal: true,
    });
  });

  it("keeps positive and negative totals independent", async () => {
    const positive = await calculatePromptTokenMetrics(
      snapshot,
      { scope: "base", channel: "positive" },
      "base",
    );
    const negative = await calculatePromptTokenMetrics(
      snapshot,
      { scope: "base", channel: "negative" },
      "neg",
    );

    expect(positive.totalTokens).toBe(5 + 5 + 1);
    expect(negative.totalTokens).toBe(4 + 1 + 4);
  });

  it("counts a disabled field but excludes it from the V4 total", async () => {
    await expect(
      calculatePromptTokenMetrics(
        snapshot,
        {
          scope: "character",
          characterId: "character-disabled",
          channel: "positive",
        },
        "unused",
      ),
    ).resolves.toMatchObject({
      fieldTokens: 7,
      totalTokens: 11,
      includedInTotal: false,
    });
  });

  it("excludes V3 character prompts from the total", async () => {
    await expect(
      calculatePromptTokenMetrics(
        { ...snapshot, model: "nai-diffusion-3" },
        {
          scope: "character",
          characterId: "character-1",
          channel: "positive",
        },
        "hero",
      ),
    ).resolves.toMatchObject({
      fieldTokens: 4,
      totalTokens: 4,
      maxTokens: 225,
      includedInTotal: false,
    });
  });

  it("does not guess a policy for an unknown model", async () => {
    await expect(
      calculatePromptTokenMetrics(
        { ...snapshot, model: "future-model" },
        { scope: "base", channel: "positive" },
        "base",
      ),
    ).resolves.toMatchObject({
      status: "unavailable",
      maxTokens: null,
    });
  });
});
