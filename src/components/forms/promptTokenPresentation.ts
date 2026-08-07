import type { ImagePromptTokenizerType } from "../../constants/generation";
import type {
  PromptTokenMetrics,
  PromptTokenTarget,
} from "../../lib/promptTokens/metrics";
import { tokens } from "../../styles/tokens";

export function getPromptTokenCounterColor(
  metrics: PromptTokenMetrics,
): string {
  if (
    metrics.status !== "ready" ||
    metrics.totalTokens === null ||
    metrics.maxTokens === null
  ) {
    return tokens.color.textMuted;
  }
  if (metrics.totalTokens > metrics.maxTokens) return tokens.color.negative;
  if (metrics.totalTokens / metrics.maxTokens >= 0.9) {
    return tokens.color.accent;
  }
  return tokens.color.textMuted;
}

export function formatPromptTokenTooltip(
  metrics: PromptTokenMetrics,
  target: PromptTokenTarget,
  tokenizer: ImagePromptTokenizerType | undefined,
): string {
  if (metrics.status === "loading") return "토큰을 계산하는 중입니다";
  if (metrics.status !== "ready") return "토큰을 계산할 수 없습니다";

  const remaining = metrics.remainingTokens ?? 0;
  const usage = `이 입력 ${metrics.fieldTokens} · 전체 ${metrics.totalTokens} / ${metrics.maxTokens}`;
  const balance =
    remaining >= 0 ? `${remaining} 남음` : `${Math.abs(remaining)} 초과`;
  if (target.scope === "character" && !metrics.includedInTotal) {
    const exclusion =
      tokenizer === "clip"
        ? "현재 모델에서 사용되지 않음"
        : "전체 합계에서 제외";
    return `${usage} · ${balance}\n${exclusion}`;
  }
  return `${usage} · ${balance}`;
}
