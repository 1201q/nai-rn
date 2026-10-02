export type NoiseSchedule =
  "native" | "karras" | "exponential" | "polyexponential";

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

// 공식 웹과 동일한 요청 해상도 상한 (width * height).
export const MAX_GENERATION_PIXELS = 3_145_728;

export const DEFAULT_NAI_RESOLUTION: NaiResolution =
  NAI_RESOLUTIONS[1].options[0];

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

export const MAX_SEED = 4_294_967_295;

export function generateRandomSeed(): number {
  return Math.floor(Math.random() * (MAX_SEED + 1));
}

export function isNoiseSchedule(value: unknown): value is NoiseSchedule {
  return NOISE_SCHEDULES.some((item) => item.value === value);
}

export function findResolutionPreset(
  width: number,
  height: number,
): NaiResolution | undefined {
  for (const group of NAI_RESOLUTIONS) {
    const preset = group.options.find(
      (option) => option.width === width && option.height === height,
    );
    if (preset) return preset;
  }
  return undefined;
}

// preset에 없는 크기는 Custom 해상도로 만든다.
export function resolutionFromDimensions(
  width: number,
  height: number,
): NaiResolution {
  return (
    findResolutionPreset(width, height) ?? {
      label: `Custom ${width}x${height}`,
      width,
      height,
    }
  );
}
