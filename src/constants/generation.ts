export type NoiseSchedule =
  | "native"
  | "karras"
  | "exponential"
  | "polyexponential";

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
    ],
  },
] as const;

export const DEFAULT_NAI_RESOLUTION: NaiResolution =
  NAI_RESOLUTIONS[1].options[0];

export const MODELS = [
  { label: "V4.5 Full", value: "nai-diffusion-4-5-full" },
  { label: "V4.5 Curated", value: "nai-diffusion-4-5-curated" },
  { label: "V4 Curated", value: "nai-diffusion-4-curated-preview" },
  { label: "Anime V3", value: "nai-diffusion-3" },
  { label: "Furry V3", value: "nai-diffusion-furry-3" },
];

export const SAMPLERS = [
  { label: "Euler Ancestral", value: "k_euler_ancestral" },
  { label: "Euler", value: "k_euler" },
  { label: "DPM++ 2S Ancestral", value: "k_dpmpp_2s_ancestral" },
  { label: "DPM++ 2M SDE", value: "k_dpmpp_2m_sde" },
  { label: "DPM++ 2M", value: "k_dpmpp_2m" },
  { label: "DPM++ SDE", value: "k_dpmpp_sde" },
  { label: "DDIM", value: "ddim_v3" },
];

export const NOISE_SCHEDULES: Array<{
  label: string;
  value: NoiseSchedule;
}> = [
  { label: "Native", value: "native" },
  { label: "Karras", value: "karras" },
  { label: "Exponential", value: "exponential" },
  { label: "Polyexponential", value: "polyexponential" },
];
