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
  return metrics.totalTokens > metrics.maxTokens
    ? tokens.color.negative
    : tokens.color.accent;
}

export function getPromptTokenProgress(metrics: PromptTokenMetrics): number {
  if (
    metrics.status !== "ready" ||
    metrics.totalTokens === null ||
    metrics.maxTokens === null ||
    metrics.maxTokens <= 0
  ) {
    return 0;
  }
  return Math.max(0, Math.min(1, metrics.totalTokens / metrics.maxTokens));
}

export function getPromptTokenFieldProgress(
  metrics: PromptTokenMetrics,
): number {
  if (
    metrics.status !== "ready" ||
    metrics.fieldTokens === null ||
    metrics.totalTokens === null ||
    metrics.maxTokens === null ||
    metrics.maxTokens <= 0 ||
    !metrics.includedInTotal
  ) {
    return 0;
  }
  return Math.max(
    0,
    Math.min(1, metrics.fieldTokens / metrics.maxTokens, metrics.totalTokens / metrics.maxTokens),
  );
}

export function formatPromptTokenTooltip(
  metrics: PromptTokenMetrics,
  target: PromptTokenTarget,
  tokenizer: ImagePromptTokenizerType | undefined,
): string {
  if (metrics.status === "loading") return "토큰을 계산하는 중입니다";
  if (metrics.status !== "ready") return "토큰을 계산할 수 없습니다";

  const remaining = metrics.remainingTokens ?? 0;
  const includedFieldTokens = metrics.includedInTotal
    ? (metrics.fieldTokens ?? 0)
    : 0;
  const otherTokens = Math.max(
    0,
    (metrics.totalTokens ?? 0) - includedFieldTokens,
  );
  const usage = `이 입력 ${metrics.fieldTokens} · 다른 입력 ${otherTokens} · 전체 ${metrics.totalTokens} / ${metrics.maxTokens}`;
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
