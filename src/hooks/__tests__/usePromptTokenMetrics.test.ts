import { act, renderHook } from "@testing-library/react-native";

import { usePromptTokenMetrics } from "../usePromptTokenMetrics";

const mockStoreState = {
  model: "nai-diffusion-4-5-full",
  prompt: "base",
  negativePrompt: "negative",
  qualityPreset: "none" as const,
  ucPreset: 4,
  characterPrompts: [],
};
const mockChunkState = { chunks: [] };
const mockCalculate = jest.fn();

jest.mock("../../store/generationStore", () => ({
  useGenerationStore: (selector: (state: typeof mockStoreState) => unknown) =>
    selector(mockStoreState),
}));

jest.mock("../../store/promptChunkStore", () => ({
  usePromptChunkStore: (selector: (state: { chunks: never[] }) => unknown) =>
    selector(mockChunkState),
}));

jest.mock("../../lib/promptTokens/metrics", () => ({
  calculatePromptTokenMetrics: (...args: unknown[]) => mockCalculate(...args),
}));

const firstMetrics = {
  status: "ready" as const,
  fieldTokens: 4,
  totalTokens: 4,
  maxTokens: 512,
  remainingTokens: 508,
  includedInTotal: true,
};
const secondMetrics = {
  ...firstMetrics,
  fieldTokens: 8,
  totalTokens: 8,
  remainingTokens: 504,
};
const target = { scope: "base", channel: "positive" } as const;

describe("usePromptTokenMetrics", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockCalculate.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("keeps the previous value until the 250ms draft debounce completes", async () => {
    mockCalculate
      .mockResolvedValueOnce(firstMetrics)
      .mockResolvedValueOnce(secondMetrics);
    const { result, rerender } = await renderHook(
      ({ draftText }: { draftText: string }) =>
        usePromptTokenMetrics(target, draftText),
      { initialProps: { draftText: "base" } },
    );

    expect(result.current.status).toBe("loading");
    await act(async () => {
      await jest.advanceTimersByTimeAsync(249);
    });
    expect(mockCalculate).not.toHaveBeenCalled();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(1);
    });
    expect(result.current).toEqual(firstMetrics);

    await rerender({ draftText: "base plus" });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(249);
    });
    expect(result.current).toEqual(firstMetrics);
    expect(mockCalculate).toHaveBeenCalledTimes(1);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(1);
    });
    expect(result.current).toEqual(secondMetrics);
    expect(mockCalculate.mock.calls[1][2]).toBe("base plus");
  });

  it("does not restart or repeat counting when an equivalent target is recreated", async () => {
    mockCalculate.mockImplementation(async () => ({ ...firstMetrics }));
    const { rerender } = await renderHook(
      ({ draftText }: { draftText: string }) =>
        usePromptTokenMetrics(
          { scope: "base", channel: "positive" },
          draftText,
        ),
      { initialProps: { draftText: "base" } },
    );

    await act(async () => {
      await jest.advanceTimersByTimeAsync(200);
    });
    await rerender({ draftText: "base" });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(50);
    });
    expect(mockCalculate).toHaveBeenCalledTimes(1);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(750);
    });
    expect(mockCalculate).toHaveBeenCalledTimes(1);
  });

  it("recounts when the target channel or character changes", async () => {
    mockCalculate.mockResolvedValue(firstMetrics);
    const { rerender } = await renderHook(
      ({
        channel,
        characterId,
      }: {
        channel: "positive" | "negative";
        characterId: string;
      }) =>
        usePromptTokenMetrics(
          { scope: "character", channel, characterId },
          "hero",
        ),
      {
        initialProps: {
          channel: "positive" as "positive" | "negative",
          characterId: "first",
        },
      },
    );
    await act(async () => {
      await jest.advanceTimersByTimeAsync(250);
    });
    await rerender({ channel: "negative", characterId: "first" });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(250);
    });
    await rerender({ channel: "negative", characterId: "second" });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(250);
    });

    expect(mockCalculate.mock.calls.map((call) => call[1])).toEqual([
      { scope: "character", channel: "positive", characterId: "first" },
      { scope: "character", channel: "negative", characterId: "first" },
      { scope: "character", channel: "negative", characterId: "second" },
    ]);
  });
});
