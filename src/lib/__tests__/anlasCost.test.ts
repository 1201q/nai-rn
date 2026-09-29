import { estimateAnlasCost, type AnlasCostInput } from "../anlasCost";

const NOW = 1_800_000_000;

function input(overrides: Partial<AnlasCostInput> = {}): AnlasCostInput {
  return {
    model: "nai-diffusion-4-5-full",
    width: 832,
    height: 1216,
    steps: 28,
    strength: 1,
    smea: false,
    batchCount: 1,
    tier: 1,
    expiresAt: NOW + 86_400,
    nowSeconds: NOW,
    activeVibeCount: 0,
    unencodedVibeCount: 0,
    activePreciseReferenceCount: 0,
    ...overrides,
  };
}

describe("estimateAnlasCost", () => {
  test.each([
    [832, 1216, 23, 17],
    [832, 1216, 28, 20],
    [1024, 1024, 28, 20],
    [1024, 1536, 28, 30],
    [512, 768, 28, 8],
  ])("%sx%s · %s steps costs %s for non-Opus", (width, height, steps, cost) => {
    expect(estimateAnlasCost(input({ width, height, steps }))).toBe(cost);
  });

  test("multiplies by batch count", () => {
    expect(estimateAnlasCost(input({ batchCount: 3 }))).toBe(60);
  });

  test("scales by i2i strength with a minimum of 2", () => {
    expect(estimateAnlasCost(input({ strength: 0.5 }))).toBe(10);
    expect(estimateAnlasCost(input({ strength: 0.01 }))).toBe(2);
  });

  test("Opus within 1MP and 28 steps is free, including i2i and batches", () => {
    expect(estimateAnlasCost(input({ tier: 3, batchCount: 10 }))).toBe(0);
    expect(estimateAnlasCost(input({ tier: 3, strength: 0.7 }))).toBe(0);
  });

  test("Opus outside the free shape pays full price", () => {
    expect(
      estimateAnlasCost(input({ tier: 3, width: 1024, height: 1536 })),
    ).toBe(30);
    expect(
      estimateAnlasCost(
        input({ tier: 3, width: 1024, height: 1024, steps: 29 }),
      ),
    ).toBe(21);
  });

  test("expired Opus subscription is not free", () => {
    expect(estimateAnlasCost(input({ tier: 3, expiresAt: NOW }))).toBe(20);
  });

  test("Precise Reference adds 5 per reference per request on top of free generation", () => {
    expect(
      estimateAnlasCost(input({ tier: 3, activePreciseReferenceCount: 1 })),
    ).toBe(5);
    expect(
      estimateAnlasCost(
        input({ tier: 3, activePreciseReferenceCount: 1, batchCount: 3 }),
      ),
    ).toBe(15);
  });

  test("unencoded vibes cost 2 once, not per request", () => {
    expect(
      estimateAnlasCost(
        input({
          tier: 3,
          activeVibeCount: 2,
          unencodedVibeCount: 2,
          batchCount: 3,
        }),
      ),
    ).toBe(4);
  });

  test("vibes beyond 4 cost 2 each per request", () => {
    expect(
      estimateAnlasCost(input({ tier: 3, activeVibeCount: 6, batchCount: 2 })),
    ).toBe(8);
  });

  test("V3 auto SMEA multiplies the rounded base cost by 1.2", () => {
    // 1536x1536 · 28 steps: base 45 -> 54
    expect(
      estimateAnlasCost(
        input({ model: "nai-diffusion-3", width: 1536, height: 1536 }),
      ),
    ).toBe(45);
    expect(
      estimateAnlasCost(
        input({
          model: "nai-diffusion-3",
          width: 1536,
          height: 1536,
          smea: true,
        }),
      ),
    ).toBe(54);
  });
});
