export type ImagePromptTokenizerType = "t5" | "clip" | "qwen";

export type ImagePromptTokenPolicy = {
  tokenizer: ImagePromptTokenizerType;
  maxTokens: number;
};

// 모델별 동작 차이는 모두 이 테이블에서 판정한다. 모델 ID 접두사로 판정하지 않는다.
export type ModelCapabilities = {
  label: string;
  description: string;
  // v4_prompt 요청 구조, 캐릭터 캡션, V4식 Quality/UC 결합
  v4Prompt: boolean;
  vibeTransfer: boolean;
  preciseReference: boolean;
  // 픽셀 수 기준 자동 SMEA (V3 계열)
  autoSmea: boolean;
  // false면 native 스케줄을 샘플러 기본 스케줄로 대체하고 선택지에서도 숨긴다.
  nativeNoiseSchedule: boolean;
  // Curated 계열은 UC에 nsfw를 자동으로 붙이지 않는다.
  curated: boolean;
  // Variety+ 기준 sigma (832x1216 latent 기준). 없으면 Variety+를 지원하지 않는다.
  varietyPlusBaseSigma?: number;
  // 없으면 토큰 수를 표시하지 않는다.
  tokenPolicy?: ImagePromptTokenPolicy;
  // 캐릭터 프롬프트 상한 (V5 22명은 공식 문서 기준)
  maxCharacters: number;
  // V5 요청 형식: params_version 4, Karras 고정, 프리셋을 문자열 ID와 tag_hint로 전송
  v5Request: boolean;
};

const T5_POLICY: ImagePromptTokenPolicy = { tokenizer: "t5", maxTokens: 512 };
const CLIP_POLICY: ImagePromptTokenPolicy = {
  tokenizer: "clip",
  maxTokens: 225,
};

// 선택지 표시 순서를 겸한다.
export const MODEL_CAPABILITIES = {
  "nai-diffusion-5-full": {
    label: "V5 Full",
    description: "최신 V5 모델, 자연어 이해와 세부 묘사가 가장 좋음",
    v4Prompt: true,
    vibeTransfer: false,
    preciseReference: false,
    autoSmea: false,
    nativeNoiseSchedule: false,
    curated: false,
    // 공식 문서 기준 한도 (Full 1471, Curated 703)
    tokenPolicy: { tokenizer: "qwen", maxTokens: 1471 },
    maxCharacters: 22,
    v5Request: true,
  },
  "nai-diffusion-5-curated": {
    label: "V5 Curated",
    description: "정제된 데이터로 학습한 V5 모델, 안전하고 일관된 결과",
    v4Prompt: true,
    vibeTransfer: false,
    preciseReference: false,
    autoSmea: false,
    nativeNoiseSchedule: false,
    curated: true,
    tokenPolicy: { tokenizer: "qwen", maxTokens: 703 },
    maxCharacters: 22,
    v5Request: true,
  },
  "nai-diffusion-4-5-full": {
    label: "V4.5 Full",
    description: "V4.5 모델, 배경 표현이 좋고 자유도 높음",
    v4Prompt: true,
    vibeTransfer: true,
    preciseReference: true,
    autoSmea: false,
    nativeNoiseSchedule: false,
    curated: false,
    varietyPlusBaseSigma: 58,
    tokenPolicy: T5_POLICY,
    maxCharacters: 6,
    v5Request: false,
  },
  "nai-diffusion-4-5-curated": {
    label: "V4.5 Curated",
    description: "정제된 데이터로 학습해 안전하고 일관된 기본 모델",
    v4Prompt: true,
    vibeTransfer: true,
    preciseReference: true,
    autoSmea: false,
    nativeNoiseSchedule: false,
    curated: true,
    varietyPlusBaseSigma: 58,
    tokenPolicy: T5_POLICY,
    maxCharacters: 6,
    v5Request: false,
  },
  "nai-diffusion-4-curated-preview": {
    label: "V4 Curated (Legacy)",
    description: "이전 세대 V4 모델, 정제된 데이터라 안전하지만 제한적",
    v4Prompt: true,
    vibeTransfer: true,
    preciseReference: false,
    autoSmea: false,
    nativeNoiseSchedule: false,
    curated: true,
    varietyPlusBaseSigma: 19,
    tokenPolicy: T5_POLICY,
    maxCharacters: 6,
    v5Request: false,
  },
  "nai-diffusion-3": {
    label: "Anime V3 (Legacy)",
    description: "SDXL 기반 이전 세대 모델, 태그 순서 영향을 많이 받음",
    v4Prompt: false,
    vibeTransfer: false,
    preciseReference: false,
    autoSmea: true,
    nativeNoiseSchedule: true,
    curated: false,
    varietyPlusBaseSigma: 19,
    tokenPolicy: CLIP_POLICY,
    maxCharacters: 6,
    v5Request: false,
  },
  "nai-diffusion-furry-3": {
    label: "Furry V3 (Legacy)",
    description: "퍼리 특화 데이터로 학습한 이전 세대 모델, 전용 태그 사용",
    v4Prompt: false,
    vibeTransfer: false,
    preciseReference: false,
    autoSmea: true,
    nativeNoiseSchedule: true,
    curated: false,
    varietyPlusBaseSigma: 19,
    tokenPolicy: CLIP_POLICY,
    maxCharacters: 6,
    v5Request: false,
  },
} as const satisfies Record<string, ModelCapabilities>;

export type ModelId = keyof typeof MODEL_CAPABILITIES;

// 저장값 복원처럼 모델과 무관하게 자를 때 쓰는 가장 큰 상한.
export const MAX_STORED_CHARACTER_PROMPTS = Math.max(
  ...Object.values(MODEL_CAPABILITIES).map((item) => item.maxCharacters),
);

export const DEFAULT_MODEL: ModelId = "nai-diffusion-4-5-full";

export const MODELS = Object.entries(MODEL_CAPABILITIES).map(
  ([value, capabilities]) => ({
    label: capabilities.label,
    value,
    description: capabilities.description,
  }),
);

export function isKnownModel(model: string): model is ModelId {
  return Object.prototype.hasOwnProperty.call(MODEL_CAPABILITIES, model);
}

// 알 수 없는 모델은 요청 형식을 기본 모델(V4.5 Full)과 같게 보낸다 (프리셋 폴백과 같은 규칙).
// 레퍼런스 기능은 모델별 서버 지원이 필요하고 Anlas가 들어가므로 끈다.
const UNKNOWN_MODEL_CAPABILITIES: ModelCapabilities = {
  ...MODEL_CAPABILITIES[DEFAULT_MODEL],
  vibeTransfer: false,
  preciseReference: false,
};

export function getModelCapabilities(model: string): ModelCapabilities {
  return isKnownModel(model)
    ? MODEL_CAPABILITIES[model]
    : UNKNOWN_MODEL_CAPABILITIES;
}

// 알 수 없는 모델은 토큰 수를 표시하지 않는다.
export function getImagePromptTokenPolicy(
  model: string,
): ImagePromptTokenPolicy | undefined {
  return isKnownModel(model)
    ? getModelCapabilities(model).tokenPolicy
    : undefined;
}
