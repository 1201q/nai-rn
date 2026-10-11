import { getModelCapabilities } from "../constants/models";

// NovelAI 웹 클라이언트 번들(2026-09-24)에서 추출한 비용 산식 기반 예상치.
// 근거: docs/2026-09-24-novelai-anlas-cost-policy.md §2, §3.3, §4.2

const OPUS_TIER = 3;
const OPUS_FREE_MAX_PIXELS = 1_048_576;
const OPUS_FREE_MAX_STEPS = 28;
export const VIBE_ENCODE_COST = 2;
const VIBE_FREE_COUNT = 4;
const VIBE_EXTRA_COST = 2;
export const PRECISE_REFERENCE_COST = 5;
const SMEA_MULTIPLIER = 1.2;
const V5_MULTIPLIER = 1.5;

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
  // Opus 사용량 한도 소진 여부 (V5 전용). 모르면 undefined
  usageNegative?: boolean;
  activeVibeCount: number;
  unencodedVibeCount: number;
  activePreciseReferenceCount: number;
};

export function estimateAnlasCost(input: AnlasCostInput): number {
  const px = input.width * input.height;
  const capabilities = getModelCapabilities(input.model);
  const base = Math.ceil(
    2.951823174884865e-6 * px +
      5.753298233447344e-7 *
        px *
        input.steps *
        (capabilities.stepsCostScale ?? 1),
  );
  const smeaMultiplier = input.smea ? SMEA_MULTIPLIER : 1;
  const isV5 = capabilities.v5Request;
  // V5 배율은 올림한 base에 곱한다 (실측과 일치하는 순서).
  const perImage = Math.max(
    Math.ceil(
      base * smeaMultiplier * (isV5 ? V5_MULTIPLIER : 1) * input.strength,
    ),
    2,
  );

  // i2i도 무료 대상 (웹 클라이언트 기준).
  // V5는 Opus 사용량 한도가 남아 있을 때만 무료이고, 한도 상태를 모르면 무료로 보지 않는다.
  const free =
    input.tier >= OPUS_TIER &&
    input.expiresAt > input.nowSeconds &&
    px <= OPUS_FREE_MAX_PIXELS &&
    input.steps <= OPUS_FREE_MAX_STEPS &&
    (!isV5 || input.usageNegative === false);

  const supportsVibe = capabilities.vibeTransfer;
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
