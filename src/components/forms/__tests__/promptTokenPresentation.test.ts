import { tokens } from "../../../styles/tokens";
import {
  formatPromptTokenTooltip,
  getPromptTokenCounterColor,
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
  it("uses muted, accent, and negative threshold colors", () => {
    expect(getPromptTokenCounterColor(readyMetrics(460))).toBe(
      tokens.color.textMuted,
    );
    expect(getPromptTokenCounterColor(readyMetrics(461))).toBe(
      tokens.color.accent,
    );
    expect(getPromptTokenCounterColor(readyMetrics(513))).toBe(
      tokens.color.negative,
    );
  });

  it("formats remaining and exceeded budgets", () => {
    expect(
      formatPromptTokenTooltip(
        readyMetrics(281),
        { scope: "base", channel: "positive" },
        "t5",
      ),
    ).toBe("이 입력 94 · 전체 281 / 512 · 231 남음");
    expect(
      formatPromptTokenTooltip(
        readyMetrics(520),
        { scope: "base", channel: "positive" },
        "t5",
      ),
    ).toBe("이 입력 94 · 전체 520 / 512 · 8 초과");
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
