import type {
  UpscaleFormat,
  UpscaleModel,
  UpscaleCpuInfo,
} from "../../../modules/image-upscaler";
import type { UpscaleSettings } from "../../store/upscaleQueueStore";
import { normalizeUpscaleAlbumName } from "../../lib/upscaleFilenames";

export const UPSCALE_SELECT_PORTAL_HOST = "upscale-select-overlay";

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

export const SYNC_GAPS = [
  { value: 0, label: "0" },
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 3, label: "3" },
] as const;

export const DEFAULT_UPSCALE_SETTINGS: UpscaleSettings = {
  model: "realcugan-se",
  scale: 2,
  noise: -1,
  tileSize: 0,
  format: "png",
  jpgQuality: 95,
  webpQuality: 90,
  ttaMode: false,
  syncGap: 3,
  limitGpuPerformance: false,
  useGpu: true,
  cpuThreads: 0,
  cpuPolicy: 0,
  keepOriginalFilename: false,
  albumName: "",
};

// 모델이나 배율이 바뀌면 그 조합에 없는 배율 / denoise는 첫 값으로 되돌린다.
export function normalizeUpscaleSettings(input: unknown): UpscaleSettings {
  const settings = (
    input !== null && typeof input === "object" ? input : {}
  ) as Partial<UpscaleSettings>;
  const model = MODELS.some((option) => option.value === settings.model)
    ? settings.model!
    : DEFAULT_UPSCALE_SETTINGS.model;
  const levels = NOISE_LEVELS[model];
  const scale =
    typeof settings.scale === "number" && Object.hasOwn(levels, settings.scale)
      ? settings.scale
      : 2;
  const noise =
    settings.noise !== undefined && levels[scale].includes(settings.noise)
      ? settings.noise
      : levels[scale][0];
  return {
    model,
    scale,
    noise,
    tileSize: TILE_SIZES.some((option) => option.value === settings.tileSize)
      ? settings.tileSize!
      : DEFAULT_UPSCALE_SETTINGS.tileSize,
    format: FORMATS.some((option) => option.value === settings.format)
      ? settings.format!
      : DEFAULT_UPSCALE_SETTINGS.format,
    jpgQuality: normalizeQuality(
      settings.jpgQuality,
      DEFAULT_UPSCALE_SETTINGS.jpgQuality,
    ),
    webpQuality: normalizeQuality(
      settings.webpQuality,
      DEFAULT_UPSCALE_SETTINGS.webpQuality,
    ),
    ttaMode:
      typeof settings.ttaMode === "boolean"
        ? settings.ttaMode
        : DEFAULT_UPSCALE_SETTINGS.ttaMode,
    syncGap: SYNC_GAPS.some((option) => option.value === settings.syncGap)
      ? settings.syncGap!
      : DEFAULT_UPSCALE_SETTINGS.syncGap,
    limitGpuPerformance:
      typeof settings.limitGpuPerformance === "boolean"
        ? settings.limitGpuPerformance
        : DEFAULT_UPSCALE_SETTINGS.limitGpuPerformance,
    useGpu:
      typeof settings.useGpu === "boolean"
        ? settings.useGpu
        : DEFAULT_UPSCALE_SETTINGS.useGpu,
    cpuThreads:
      typeof settings.cpuThreads === "number" &&
      Number.isFinite(settings.cpuThreads)
        ? Math.max(0, Math.min(1024, Math.floor(settings.cpuThreads)))
        : 0,
    cpuPolicy:
      settings.cpuPolicy === 1 || settings.cpuPolicy === 2
        ? settings.cpuPolicy
        : 0,
    keepOriginalFilename:
      typeof settings.keepOriginalFilename === "boolean"
        ? settings.keepOriginalFilename
        : false,
    albumName: normalizeUpscaleAlbumName(settings.albumName),
  };
}

export function cpuPolicyOptions(info: UpscaleCpuInfo) {
  return [
    { value: 0 as const, label: "전체", count: info.all },
    { value: 1 as const, label: "리틀", count: info.little },
    { value: 2 as const, label: "빅", count: info.big },
  ].filter((option) => option.count > 0);
}

export function cpuThreadLimit(
  info: UpscaleCpuInfo,
  policy: UpscaleSettings["cpuPolicy"],
) {
  const selected =
    policy === 1 ? info.little : policy === 2 ? info.big : info.all;
  return Math.max(1, selected || info.all);
}

function normalizeQuality(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(100, Math.max(1, Math.round(value)))
    : fallback;
}

export function upscaleSettingsSummary(settings: UpscaleSettings) {
  const model = MODELS.find((option) => option.value === settings.model)!;
  const format = FORMATS.find((option) => option.value === settings.format)!;
  return `${model.label} · ${settings.scale}x · ${format.label}`;
}
