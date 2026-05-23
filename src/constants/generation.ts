export type AspectRatio = "1:1" | "3:4" | "16:9";

export const ASPECT_DIMENSIONS: Record<
  AspectRatio,
  { width: number; height: number }
> = {
  "1:1": { width: 1024, height: 1024 },
  "3:4": { width: 832, height: 1216 },
  "16:9": { width: 1216, height: 704 },
};

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
