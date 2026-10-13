import type {
  UpscaleFormat,
  UpscaleModel,
} from "../../../modules/image-upscaler";
import type { UpscaleSettings } from "../../store/upscaleQueueStore";

export const MODELS: { value: UpscaleModel; label: string }[] = [
  { value: "realcugan-se", label: "CUGAN Standard" },
  { value: "realcugan-pro", label: "CUGAN Pro" },
  { value: "waifu2x-cunet", label: "waifu2x CUNet" },
];

// 모델별 배율 -> 번들된 denoise 단계 (모듈 assets/upscaler-models와 일치해야 한다)
const NOISE_LEVELS: Record<UpscaleModel, Record<number, number[]>> = {
  "realcugan-se": { 2: [-1, 0, 1, 2, 3], 3: [-1, 0, 3], 4: [-1, 0, 3] },
  "realcugan-pro": { 2: [-1, 0, 3], 3: [-1, 0, 3] },
  "waifu2x-cunet": { 1: [0, 1, 2, 3], 2: [-1, 0, 1, 2, 3] },
};

export function scaleOptions(model: UpscaleModel) {
  return Object.keys(NOISE_LEVELS[model]).map((scale) => ({
    value: Number(scale),
    label: `${scale}x`,
  }));
}

export function noiseOptions(model: UpscaleModel, scale: number) {
  return NOISE_LEVELS[model][scale].map((noise) => ({
    value: noise,
    label: String(noise),
  }));
}

export const TILE_SIZES = [
  { value: 0, label: "자동" },
  { value: 100, label: "100" },
  { value: 200, label: "200" },
  { value: 400, label: "400" },
];

export const FORMATS: { value: UpscaleFormat; label: string }[] = [
  { value: "png", label: "PNG" },
  { value: "jpg", label: "JPG" },
  { value: "webp", label: "WebP" },
];

export const DEFAULT_UPSCALE_SETTINGS: UpscaleSettings = {
  model: "realcugan-se",
  scale: 2,
  noise: -1,
  tileSize: 0,
  format: "png",
};

// 모델이나 배율이 바뀌면 그 조합에 없는 배율 / denoise는 첫 값으로 되돌린다.
export function normalizeUpscaleSettings(
  settings: UpscaleSettings,
): UpscaleSettings {
  const levels = NOISE_LEVELS[settings.model];
  const scale = levels[settings.scale] ? settings.scale : 2;
  const noise = levels[scale].includes(settings.noise)
    ? settings.noise
    : levels[scale][0];
  return { ...settings, scale, noise };
}

export function upscaleSettingsSummary(settings: UpscaleSettings) {
  const model = MODELS.find((option) => option.value === settings.model)!;
  const format = FORMATS.find((option) => option.value === settings.format)!;
  return `${model.label} · ${settings.scale}x · ${format.label}`;
}
