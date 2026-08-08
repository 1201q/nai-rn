import { tokens } from "../../../styles/tokens";
import {
  formatPromptTokenTooltip,
  getPromptTokenCounterColor,
  getPromptTokenFieldProgress,
  getPromptTokenProgress,
} from "../promptTokenPresentation";

function readyMetrics(totalTokens: number, maxTokens = 512) {
  return {
    status: "ready" as const,
    fieldTokens: 94,
    totalTokens,
    maxTokens,
    remainingTokens: maxTokens - totalTokens,
    includedInTotal: true,
  };
}

describe("prompt token presentation", () => {
  it("uses accent for the current field and negative when over budget", () => {
    expect(getPromptTokenCounterColor(readyMetrics(460))).toBe(
      tokens.color.accent,
    );
    expect(getPromptTokenCounterColor(readyMetrics(513))).toBe(
      tokens.color.negative,
    );
  });

  it("clamps ring progress and leaves non-ready states empty", () => {
    expect(getPromptTokenProgress(readyMetrics(256))).toBe(0.5);
    expect(getPromptTokenProgress(readyMetrics(520))).toBe(1);
    expect(
      getPromptTokenProgress({
        status: "loading",
        fieldTokens: null,
        totalTokens: null,
        maxTokens: 512,
        remainingTokens: null,
        includedInTotal: false,
      }),
    ).toBe(0);
  });

  it("shows only the included current field as the accent segment", () => {
    expect(getPromptTokenFieldProgress(readyMetrics(188))).toBeCloseTo(
      94 / 512,
    );
    expect(
      getPromptTokenFieldProgress({
        ...readyMetrics(188),
        includedInTotal: false,
      }),
    ).toBe(0);
  });

  it("formats remaining and exceeded budgets", () => {
    expect(
      formatPromptTokenTooltip(
        readyMetrics(281),
        { scope: "base", channel: "positive" },
        "t5",
      ),
    ).toBe(
      "이 입력 94 · 다른 입력 187 · 전체 281 / 512 · 231 남음",
    );
    expect(
      formatPromptTokenTooltip(
        readyMetrics(520),
        { scope: "base", channel: "positive" },
        "t5",
      ),
    ).toBe(
      "이 입력 94 · 다른 입력 426 · 전체 520 / 512 · 8 초과",
    );
  });

  it("explains why character prompts are excluded", () => {
    const metrics = { ...readyMetrics(281), includedInTotal: false };
    const target = {
      scope: "character" as const,
      characterId: "character-1",
      channel: "positive" as const,
    };

    expect(formatPromptTokenTooltip(metrics, target, "t5")).toContain(
      "전체 합계에서 제외",
    );
    expect(formatPromptTokenTooltip(metrics, target, "clip")).toContain(
      "현재 모델에서 사용되지 않음",
    );
  });
});
