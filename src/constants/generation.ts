export type NoiseSchedule =
  | "native"
  | "karras"
  | "exponential"
  | "polyexponential";

export type ImagePromptTokenizerType = "t5" | "clip";

export type ImagePromptTokenPolicy = {
  tokenizer: ImagePromptTokenizerType;
  maxTokens: number;
};

export const IMAGE_PROMPT_TOKEN_POLICIES: Readonly<
  Record<string, ImagePromptTokenPolicy>
> = {
  "nai-diffusion-4-5-full": { tokenizer: "t5", maxTokens: 512 },
  "nai-diffusion-4-5-curated": { tokenizer: "t5", maxTokens: 512 },
  "nai-diffusion-4-curated-preview": { tokenizer: "t5", maxTokens: 512 },
  "nai-diffusion-3": { tokenizer: "clip", maxTokens: 225 },
  "nai-diffusion-furry-3": { tokenizer: "clip", maxTokens: 225 },
};

export function getImagePromptTokenPolicy(
  model: string,
): ImagePromptTokenPolicy | undefined {
  return IMAGE_PROMPT_TOKEN_POLICIES[model];
}

export type NaiResolution = {
  label: string;
  width: number;
  height: number;
};

export const NAI_RESOLUTIONS = [
  {
    group: "Small",
    options: [
      { label: "Portrait 512×768", width: 512, height: 768 },
      { label: "Landscape 768×512", width: 768, height: 512 },
      { label: "Square 640×640", width: 640, height: 640 },
    ],
  },
  {
    group: "Normal",
    options: [
      { label: "Portrait 832×1216", width: 832, height: 1216 },
      { label: "Landscape 1216×832", width: 1216, height: 832 },
      { label: "Square 1024×1024", width: 1024, height: 1024 },
    ],
  },
  {
    group: "Large",
    options: [
      { label: "Portrait 1024×1536", width: 1024, height: 1536 },
      { label: "Landscape 1536×1024", width: 1536, height: 1024 },
      { label: "Square 1472×1472", width: 1472, height: 1472 },
    ],
  },
  {
    group: "Wallpaper",
    options: [
      { label: "Portrait 1088×1920", width: 1088, height: 1920 },
      { label: "Landscape 1920×1088", width: 1920, height: 1088 },
      { label: "Square 1440×1440", width: 1440, height: 1440 },
    ],
  },
] as const;

export const DEFAULT_NAI_RESOLUTION: NaiResolution =
  NAI_RESOLUTIONS[1].options[0];

export const MODELS = [
  {
    label: "V4.5 Full",
    value: "nai-diffusion-4-5-full",
    description: "최신 V4.5 모델, 배경 표현이 좋고 자유도 높음",
  },
  {
    label: "V4.5 Curated",
    value: "nai-diffusion-4-5-curated",
    description: "정제된 데이터로 학습해 안전하고 일관된 기본 모델",
  },
  {
    label: "V4 Curated (Legacy)",
    value: "nai-diffusion-4-curated-preview",
    description: "이전 세대 V4 모델, 정제된 데이터라 안전하지만 제한적",
  },
  {
    label: "Anime V3 (Legacy)",
    value: "nai-diffusion-3",
    description: "SDXL 기반 이전 세대 모델, 태그 순서 영향을 많이 받음",
  },
  {
    label: "Furry V3 (Legacy)",
    value: "nai-diffusion-furry-3",
    description: "퍼리 특화 데이터로 학습한 이전 세대 모델, 전용 태그 사용",
  },
];

export const SAMPLERS = [
  {
    label: "Euler Ancestral",
    value: "k_euler_ancestral",
    description: "매 스텝 무작위성을 더하는 기본 권장 샘플러",
  },
  {
    label: "Euler",
    value: "k_euler",
    description: "단순하고 빠른 결정론적 샘플러, 적은 스텝도 무난",
  },
  {
    label: "DPM++ 2S Ancestral",
    value: "k_dpmpp_2s_ancestral",
    description: "예측·보정 2차 계산에 무작위성을 더한 샘플러",
  },
  {
    label: "DPM++ 2M SDE",
    value: "k_dpmpp_2m_sde",
    description: "확률적 노이즈 처리로 적은 스텝에도 선명한 결과",
  },
  {
    label: "DPM++ 2M",
    value: "k_dpmpp_2m",
    description: "이전 스텝을 활용하는 2차 샘플러, 안정적이고 무난",
  },
  {
    label: "DPM++ SDE",
    value: "k_dpmpp_sde",
    description: "확률적 계산으로 품질·다양성은 높지만 느린 편",
  },
  {
    label: "DDIM (Legacy)",
    value: "ddim_v3",
    description: "적은 스텝에도 동작하는 구버전 샘플러",
  },
];

export const NOISE_SCHEDULES: Array<{
  label: string;
  value: NoiseSchedule;
  description: string;
}> = [
  {
    label: "Karras",
    value: "karras",
    description: "필요한 구간에 스텝을 집중 배분하는 권장 스케줄",
  },
  {
    label: "Exponential",
    value: "exponential",
    description: "초반에 노이즈를 빠르게 제거하는 카라스 유사 스케줄",
  },
  {
    label: "Polyexponential",
    value: "polyexponential",
    description: "여러 지수율을 조합해 손가락 등 디테일 표현에 강함",
  },
  {
    label: "Native (Legacy)",
    value: "native",
    description: "고정된 방식의 예전 스케줄, 최신보다 다소 구식",
  },
];

export const MAX_CHARACTER_PROMPTS = 6;
