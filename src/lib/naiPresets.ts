// 공식 웹 클라이언트(2026-09-24 번들)의 모델별 품질 태그 / UC 프리셋과 결합 규칙을 옮겼다.
export type UcPresetIndex = 0 | 1 | 2 | 3 | 4;
export type SelectableUcPresetIndex = 0 | 1 | 3 | 4;

const DEFAULT_PRESET_MODEL = "nai-diffusion-4-5-full";
const SEPARATOR = ", ";

const QUALITY_SUFFIXES: Record<string, string> = {
  "nai-diffusion-4-5-full": "very aesthetic, masterpiece, no text",
  "nai-diffusion-4-5-curated":
    "very aesthetic, masterpiece, no text, -0.8::feet::, rating:general",
  "nai-diffusion-4-curated-preview":
    "rating:general, best quality, very aesthetic, absurdres",
  "nai-diffusion-3": "best quality, amazing quality, very aesthetic, absurdres",
  "nai-diffusion-furry-3": "{best quality}, {amazing quality}",
};

// 인덱스: 0 heavy, 1 light, 2 furryFocus, 3 humanFocus, 4 none. 없는 인덱스는 none으로 처리.
const V45_FULL_HEAVY =
  "lowres, artistic error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, dithering, halftone, screentone, multiple views, logo, too many watermarks, negative space, blank page";
const V3_HEAVY =
  "lowres, {bad}, error, fewer, extra, missing, worst quality, jpeg artifacts, bad quality, watermark, unfinished, displeasing, chromatic aberration, signature, extra digits, artistic error, username, scan, [abstract]";

const UC_PRESETS: Record<string, Partial<Record<UcPresetIndex, string>>> = {
  "nai-diffusion-4-5-full": {
    0: V45_FULL_HEAVY,
    1: "lowres, artistic error, scan artifacts, worst quality, bad quality, jpeg artifacts, multiple views, very displeasing, too many watermarks, negative space, blank page",
    2: "{worst quality}, distracting watermark, unfinished, bad quality, {widescreen}, upscale, {sequence}, {{grandfathered content}}, blurred foreground, chromatic aberration, sketch, everyone, [sketch background], simple, [flat colors], ych (character), outline, multiple scenes, [[horror (theme)]], comic",
    3: `${V45_FULL_HEAVY}, @_@, mismatched pupils, glowing eyes, bad anatomy`,
    4: "",
  },
  "nai-diffusion-4-5-curated": {
    0: "blurry, lowres, upscaled, artistic error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, halftone, multiple views, logo, too many watermarks, negative space, blank page",
    1: "blurry, lowres, upscaled, artistic error, scan artifacts, jpeg artifacts, logo, too many watermarks, negative space, blank page",
    3: "blurry, lowres, upscaled, artistic error, film grain, scan artifacts, bad anatomy, bad hands, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, halftone, multiple views, logo, too many watermarks, @_@, mismatched pupils, glowing eyes, negative space, blank page",
    4: "",
  },
  "nai-diffusion-4-curated-preview": {
    0: "blurry, lowres, error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, logo, dated, signature, multiple views, gigantic breasts, white blank page, blank page",
    1: "blurry, lowres, error, worst quality, bad quality, jpeg artifacts, very displeasing, logo, dated, signature, white blank page, blank page",
    4: "",
  },
  "nai-diffusion-3": {
    0: V3_HEAVY,
    1: "lowres, jpeg artifacts, worst quality, watermark, blurry, very displeasing",
    3: `${V3_HEAVY}, bad anatomy, bad hands, @_@, mismatched pupils, heart-shaped pupils, glowing eyes`,
    4: "lowres",
  },
  "nai-diffusion-furry-3": {
    0: "{{worst quality}}, [displeasing], {unusual pupils}, guide lines, {{unfinished}}, {bad}, url, artist name, {{tall image}}, mosaic, {sketch page}, comic panel, impact (font), [dated], {logo}, ych, {what}, {where is your god now}, {distorted text}, repeated text, {floating head}, {1994}, {widescreen}, absolutely everyone, sequence, {compression artifacts}, hard translated, {cropped}, {commissioner name}, unknown text, high contrast",
    1: "{worst quality}, guide lines, unfinished, bad, url, tall image, widescreen, compression artifacts, unknown text",
    4: "lowres",
  },
};

// Curated 계열은 UC에 nsfw를 자동으로 붙이지 않는다.
const CURATED_MODELS = new Set([
  "nai-diffusion-4-5-curated",
  "nai-diffusion-4-curated-preview",
]);

// V4+ 프롬프트의 "Text:" 블록 경계 (웹 클라이언트 정규식 그대로).
const TEXT_BLOCK_PATTERN = /(?:^|\s|[,.:[\]{}、。])text:(?!:)/i;

export const UC_PRESET_OPTIONS: ReadonlyArray<{
  value: SelectableUcPresetIndex;
  label: string;
}> = [
  { value: 0, label: "Heavy" },
  { value: 1, label: "Light" },
  { value: 3, label: "Human Focus" },
  { value: 4, label: "None" },
];

export function isUcPresetIndex(value: unknown): value is UcPresetIndex {
  return value === 0 || value === 1 || value === 2 || value === 3 || value === 4;
}

export function getUcPresetLabel(value: UcPresetIndex): string {
  return (
    UC_PRESET_OPTIONS.find((option) => option.value === value)?.label ?? "None"
  );
}

function isV4PlusModel(model: string) {
  return model.startsWith("nai-diffusion-4");
}

function getQualitySuffix(model: string) {
  return QUALITY_SUFFIXES[model] ?? QUALITY_SUFFIXES[DEFAULT_PRESET_MODEL];
}

function getUcPresets(model: string) {
  return UC_PRESETS[model] ?? UC_PRESETS[DEFAULT_PRESET_MODEL];
}

function appendSuffix(text: string, suffix: string) {
  return text ? `${text}${SEPARATOR}${suffix}` : suffix;
}

function splitFirstSegment(text: string) {
  const index = text.indexOf("|");
  return index === -1
    ? { head: text, tail: "" }
    : { head: text.slice(0, index), tail: text.slice(index) };
}

export function mergeQualityTags(
  prompt: string,
  qualityToggle: boolean,
  model: string,
): string {
  if (!qualityToggle) return prompt;
  const suffix = getQualitySuffix(model);

  if (isV4PlusModel(model)) {
    // 첫 세그먼트의 "Text:" 블록 앞부분에만 붙인다.
    const { head, tail } = splitFirstSegment(prompt);
    const parts = head.split(TEXT_BLOCK_PATTERN);
    const delimiter = head.match(TEXT_BLOCK_PATTERN)?.[0] ?? "";
    parts[0] = appendSuffix(parts[0], suffix);
    return parts.join(delimiter) + tail;
  }

  // V3: "|" 세그먼트마다 붙이고 끝의 ":가중치"는 유지한다.
  return prompt
    .split("|")
    .map((segment) => {
      const weight = segment.match(/(:[\d.]+$)/)?.[0] ?? "";
      const body = weight ? segment.slice(0, -weight.length) : segment;
      return appendSuffix(body, suffix) + weight;
    })
    .join("|");
}

export function mergeUcPreset(
  negativePrompt: string,
  ucPreset: UcPresetIndex,
  model: string,
  positivePrompt: string,
): string {
  const presets = getUcPresets(model);
  const isNone = ucPreset === 4 || presets[ucPreset] === undefined;
  const prefix = (isNone ? presets[4] : presets[ucPreset]) ?? "";
  const addNsfw =
    !CURATED_MODELS.has(model) &&
    !isNone &&
    prefix !== "" &&
    !positivePrompt.toLowerCase().includes("nsfw");

  if (isV4PlusModel(model)) {
    const { head, tail } = splitFirstSegment(negativePrompt);
    const merged =
      prefix === ""
        ? negativePrompt
        : (head === "" ? prefix : `${prefix}${SEPARATOR}${head}`) + tail;
    return addNsfw ? `nsfw${SEPARATOR}${merged}` : merged;
  }

  let merged: string;
  if (negativePrompt) {
    const base = isNone ? "" : prefix;
    merged = base === "" ? negativePrompt : `${base}${SEPARATOR}${negativePrompt}`;
  } else {
    merged = prefix;
  }
  if (addNsfw) merged = merged === "" ? "nsfw" : `nsfw${SEPARATOR}${merged}`;
  return merged;
}

export function hasQualityTags(prompt: string, model: string): boolean {
  const suffix = getQualitySuffix(model);
  return prompt === suffix || prompt.endsWith(`${SEPARATOR}${suffix}`);
}

export function stripQualityTags(prompt: string, model: string): string {
  const suffix = getQualitySuffix(model);
  if (prompt === suffix) return "";
  return prompt.endsWith(`${SEPARATOR}${suffix}`)
    ? prompt.slice(0, -(suffix.length + SEPARATOR.length))
    : prompt;
}

function presetCandidates(prefix: string) {
  return [`nsfw${SEPARATOR}${prefix}`, prefix];
}

export function inferUcPreset(
  negativePrompt: string,
  model: string,
): UcPresetIndex | undefined {
  const presets = getUcPresets(model);
  return ([3, 0, 1, 2] as const).find((preset) => {
    const prefix = presets[preset];
    if (!prefix) return false;
    return presetCandidates(prefix).some(
      (value) =>
        negativePrompt === value ||
        negativePrompt.startsWith(`${value}${SEPARATOR}`),
    );
  });
}

export function stripUcPreset(
  negativePrompt: string,
  ucPreset: UcPresetIndex | undefined,
  model: string,
): string {
  if (ucPreset === undefined) return negativePrompt;
  const prefix = getUcPresets(model)[ucPreset];
  if (!prefix) return negativePrompt;
  for (const value of presetCandidates(prefix)) {
    if (negativePrompt === value) return "";
    if (negativePrompt.startsWith(`${value}${SEPARATOR}`)) {
      return negativePrompt.slice(value.length + SEPARATOR.length);
    }
  }
  return negativePrompt;
}
