import { getModelCapabilities } from "../constants/models";

// NovelAI 웹 클라이언트 번들(2026-09-24)에서 추출한 비용 산식 기반 예상치 (V4.5 이하).
// 근거: docs/2026-09-24-novelai-anlas-cost-policy.md §2, §3.3, §4.2

const OPUS_TIER = 3;
const OPUS_FREE_MAX_PIXELS = 1_048_576;
const OPUS_FREE_MAX_STEPS = 28;
export const VIBE_ENCODE_COST = 2;
const VIBE_FREE_COUNT = 4;
const VIBE_EXTRA_COST = 2;
export const PRECISE_REFERENCE_COST = 5;
const SMEA_MULTIPLIER = 1.2;

export type AnlasCostInput = {
  model: string;
  width: number;
  height: number;
  steps: number;
  // i2i가 켜져 있으면 i2i strength, 아니면 1
  strength: number;
  // V3 자동 SMEA가 켜지는 요청이면 true (비용 1.2배)
  smea: boolean;
  batchCount: number;
  tier: number;
  // 구독 만료 시각 (Unix 초)
  expiresAt: number;
  nowSeconds: number;
  activeVibeCount: number;
  unencodedVibeCount: number;
  activePreciseReferenceCount: number;
};

export function estimateAnlasCost(input: AnlasCostInput): number {
  const px = input.width * input.height;
  const base = Math.ceil(
    2.951823174884865e-6 * px + 5.753298233447344e-7 * px * input.steps,
  );
  const smeaMultiplier = input.smea ? SMEA_MULTIPLIER : 1;
  const perImage = Math.max(
    Math.ceil(base * smeaMultiplier * input.strength),
    2,
  );

  // i2i도 무료 대상 (웹 클라이언트 기준)
  const free =
    input.tier >= OPUS_TIER &&
    input.expiresAt > input.nowSeconds &&
    px <= OPUS_FREE_MAX_PIXELS &&
    input.steps <= OPUS_FREE_MAX_STEPS;

  const supportsVibe = getModelCapabilities(input.model).vibeTransfer;
  const vibeExtra = supportsVibe
    ? Math.max(0, input.activeVibeCount - VIBE_FREE_COUNT) * VIBE_EXTRA_COST
    : 0;
  const perRequest =
    (free ? 0 : perImage) +
    vibeExtra +
    input.activePreciseReferenceCount * PRECISE_REFERENCE_COST;

  // Vibe 인코딩은 첫 요청에서만 발생하고 이후는 캐시를 쓴다.
  const oneTime = supportsVibe
    ? input.unencodedVibeCount * VIBE_ENCODE_COST
    : 0;
  return perRequest * input.batchCount + oneTime;
}
