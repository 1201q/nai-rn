import { getModelCapabilities } from "../constants/models";

// 공식 웹 클라이언트(2026-09-24 번들)의 모델별 품질 태그 / UC 프리셋과 결합 규칙을 옮겼다.
export type UcPresetIndex = 0 | 1 | 2 | 3 | 4;
export type QualityPreset = "standard" | "light" | "none";

const DEFAULT_PRESET_MODEL = "nai-diffusion-4-5-full";
const SEPARATOR = ", ";

const QUALITY_SUFFIXES: Record<string, string> = {
  "nai-diffusion-5-full": "very aesthetic, masterpiece, no text",
  "nai-diffusion-5-full-medium": "very aesthetic, masterpiece, no text",
  "nai-diffusion-5-curated": "very aesthetic, masterpiece, no text",
  "nai-diffusion-4-5-full": "very aesthetic, masterpiece, no text",
  "nai-diffusion-4-5-curated":
    "very aesthetic, masterpiece, no text, -0.8::feet::, rating:general",
  "nai-diffusion-4-curated-preview":
    "rating:general, best quality, very aesthetic, absurdres",
  "nai-diffusion-3": "best quality, amazing quality, very aesthetic, absurdres",
  "nai-diffusion-furry-3": "{best quality}, {amazing quality}",
};

// Light Quality는 V5에만 있다 (공식 문서 2026-10-02).
const LIGHT_QUALITY_SUFFIXES: Record<string, string> = {
  "nai-diffusion-5-full": "very aesthetic, amazing quality, no text",
  "nai-diffusion-5-full-medium": "very aesthetic, amazing quality, no text",
  "nai-diffusion-5-curated": "very aesthetic, amazing quality, no text",
};

// 인덱스: 0 heavy, 1 light, 2 furryFocus, 3 humanFocus, 4 none. 없는 인덱스는 none으로 처리.
const V45_FULL_HEAVY =
  "lowres, artistic error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, dithering, halftone, screentone, multiple views, logo, too many watermarks, negative space, blank page";
const V3_HEAVY =
  "lowres, {bad}, error, fewer, extra, missing, worst quality, jpeg artifacts, bad quality, watermark, unfinished, displeasing, chromatic aberration, signature, extra digits, artistic error, username, scan, [abstract]";

const V45_FULL_UC_PRESETS: Partial<Record<UcPresetIndex, string>> = {
  0: V45_FULL_HEAVY,
  1: "lowres, artistic error, scan artifacts, worst quality, bad quality, jpeg artifacts, multiple views, very displeasing, too many watermarks, negative space, blank page",
  2: "{worst quality}, distracting watermark, unfinished, bad quality, {widescreen}, upscale, {sequence}, {{grandfathered content}}, blurred foreground, chromatic aberration, sketch, everyone, [sketch background], simple, [flat colors], ych (character), outline, multiple scenes, [[horror (theme)]], comic",
  3: `${V45_FULL_HEAVY}, @_@, mismatched pupils, glowing eyes, bad anatomy`,
  4: "",
};
// V5 Full/Curated는 같은 프리셋을 쓰고, V4.5 Full과는 Light만 다르다 (공식 문서 2026-10-02).
const V5_UC_PRESETS: Partial<Record<UcPresetIndex, string>> = {
  ...V45_FULL_UC_PRESETS,
  1: "lowres, bad hands, bad anatomy, artistic error, sepia, white haze, worst quality, very displeasing, jpeg artifacts, 0::ai-generated::",
};

const UC_PRESETS: Record<string, Partial<Record<UcPresetIndex, string>>> = {
  "nai-diffusion-5-full": V5_UC_PRESETS,
  "nai-diffusion-5-full-medium": V5_UC_PRESETS,
  "nai-diffusion-5-curated": V5_UC_PRESETS,
  "nai-diffusion-4-5-full": V45_FULL_UC_PRESETS,
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

// V4+ 프롬프트의 "Text:" 블록 경계 (웹 클라이언트 정규식 그대로).
const TEXT_BLOCK_PATTERN = /(?:^|\s|[,.:[\]{}、。])text:(?!:)/i;

// V5 자동 Text 블록 (웹 요청 캡처 2026-10-02).
// 프롬프트의 따옴표 문자열을 모아 맨 끝에 ", teXt: a\n\nb"로 붙인다. 원래 따옴표는 그대로 둔다.
// 웹은 좌표 순 정렬과 작은따옴표도 처리하는 것으로 보이지만 확인하지 못해 넣지 않았다.
const AUTO_TEXT_MARKER = ", teXt: ";
const QUOTED_TEXT_PATTERN = /"([^"]+)"|“([^”]+)”|「([^」]+)」/g;

// sources: 기본 프롬프트와 전송되는 캐릭터 프롬프트 (이 순서로 모은다).
export function appendAutoTextBlock(caption: string, sources: string[]) {
  // 직접 쓴 Text: 블록이 있으면 자동 처리를 하지 않는다.
  if (sources.some((source) => TEXT_BLOCK_PATTERN.test(source))) {
    return caption;
  }
  const texts = sources.flatMap((source) =>
    Array.from(
      source.matchAll(QUOTED_TEXT_PATTERN),
      (match) => match[1] ?? match[2] ?? match[3],
    ),
  );
  return texts.length === 0
    ? caption
    : `${caption}${AUTO_TEXT_MARKER}${texts.join("\n\n")}`;
}

// 대소문자가 섞인 teXt:는 자동 블록에만 쓰이므로 그것만 잘라낸다.
export function stripAutoTextBlock(prompt: string) {
  const index = prompt.lastIndexOf(AUTO_TEXT_MARKER);
  return index === -1 ? prompt : prompt.slice(0, index);
}

export const QUALITY_PRESET_OPTIONS: readonly {
  value: QualityPreset;
  label: string;
}[] = [
  { value: "standard", label: "Standard" },
  { value: "light", label: "Light" },
  { value: "none", label: "None" },
];

export function isQualityPreset(value: unknown): value is QualityPreset {
  return value === "standard" || value === "light" || value === "none";
}

export function getQualityPresetLabel(value: QualityPreset): string {
  return (
    QUALITY_PRESET_OPTIONS.find((option) => option.value === value)?.label ??
    "None"
  );
}

// 선택한 모델이 지원하는 Quality 프리셋만 선택지로 보여준다.
export function getQualityPresetOptions(model: string) {
  return QUALITY_PRESET_OPTIONS.filter(
    (option) =>
      option.value !== "light" || LIGHT_QUALITY_SUFFIXES[model] !== undefined,
  );
}

// Light가 없는 모델은 Standard로 처리한다 (요청과 표시 모두).
export function resolveQualityPresetForModel(
  preset: QualityPreset,
  model: string,
): QualityPreset {
  return preset === "light" && LIGHT_QUALITY_SUFFIXES[model] === undefined
    ? "standard"
    : preset;
}

export const UC_PRESET_OPTIONS: ReadonlyArray<{
  value: UcPresetIndex;
  label: string;
}> = [
  { value: 0, label: "Heavy" },
  { value: 1, label: "Light" },
  { value: 2, label: "Furry Focus" },
  { value: 3, label: "Human Focus" },
  { value: 4, label: "None" },
];

export function isUcPresetIndex(value: unknown): value is UcPresetIndex {
  return (
    value === 0 || value === 1 || value === 2 || value === 3 || value === 4
  );
}

export function getUcPresetLabel(value: UcPresetIndex): string {
  return (
    UC_PRESET_OPTIONS.find((option) => option.value === value)?.label ?? "None"
  );
}

function getQualitySuffix(model: string, preset: QualityPreset = "standard") {
  if (preset === "light" && LIGHT_QUALITY_SUFFIXES[model] !== undefined) {
    return LIGHT_QUALITY_SUFFIXES[model];
  }
  return QUALITY_SUFFIXES[model] ?? QUALITY_SUFFIXES[DEFAULT_PRESET_MODEL];
}

function getUcPresets(model: string) {
  return UC_PRESETS[model] ?? UC_PRESETS[DEFAULT_PRESET_MODEL];
}

// 선택한 모델이 지원하는 UC 프리셋만 선택지로 보여준다.
export function getUcPresetOptions(model: string) {
  const presets = getUcPresets(model);
  return UC_PRESET_OPTIONS.filter(
    (option) => presets[option.value] !== undefined,
  );
}

// 모델에 없는 프리셋은 요청에서 None으로 처리되므로 표시도 같게 맞춘다.
export function resolveUcPresetForModel(
  ucPreset: UcPresetIndex,
  model: string,
): UcPresetIndex {
  return getUcPresets(model)[ucPreset] === undefined ? 4 : ucPreset;
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

// V5 투명 배경 옵션 (웹 요청 캡처 2026-10-03): Quality 태그 앞에 붙는다.
// 예: "solo, cat, transparent background, very aesthetic, masterpiece, no text"
const TRANSPARENT_BACKGROUND_TAG = "transparent background";

export function mergeQualityTags(
  prompt: string,
  qualityPreset: QualityPreset,
  model: string,
  transparentBackground = false,
): string {
  const suffix = [
    transparentBackground && getModelCapabilities(model).v5Request
      ? TRANSPARENT_BACKGROUND_TAG
      : "",
    qualityPreset === "none" ? "" : getQualitySuffix(model, qualityPreset),
  ]
    .filter(Boolean)
    .join(SEPARATOR);
  if (!suffix) return prompt;

  if (getModelCapabilities(model).v4Prompt) {
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
    !getModelCapabilities(model).curated &&
    !isNone &&
    prefix !== "" &&
    !positivePrompt.toLowerCase().includes("nsfw");

  if (getModelCapabilities(model).v4Prompt) {
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
    merged =
      base === "" ? negativePrompt : `${base}${SEPARATOR}${negativePrompt}`;
  } else {
    merged = prefix;
  }
  if (addNsfw) merged = merged === "" ? "nsfw" : `nsfw${SEPARATOR}${merged}`;
  return merged;
}

function hasQualitySuffix(prompt: string, suffix: string) {
  return prompt === suffix || prompt.endsWith(`${SEPARATOR}${suffix}`);
}

// 투명 배경 옵션이 붙인 태그를 떼어낸다 (메타데이터 가져오기용, Quality 태그를 뗀 뒤에 호출).
export function stripTransparentBackgroundTag(prompt: string): string {
  if (prompt === TRANSPARENT_BACKGROUND_TAG) return "";
  const suffix = `${SEPARATOR}${TRANSPARENT_BACKGROUND_TAG}`;
  return prompt.endsWith(suffix) ? prompt.slice(0, -suffix.length) : prompt;
}

// 프롬프트 끝의 Quality 태그로 프리셋을 추정한다. 없으면 None.
export function inferQualityPreset(
  prompt: string,
  model: string,
): QualityPreset {
  const light = LIGHT_QUALITY_SUFFIXES[model];
  if (light !== undefined && hasQualitySuffix(prompt, light)) return "light";
  return hasQualitySuffix(prompt, getQualitySuffix(model))
    ? "standard"
    : "none";
}

export function stripQualityTags(
  prompt: string,
  qualityPreset: QualityPreset,
  model: string,
): string {
  if (qualityPreset === "none") return prompt;
  const suffix = getQualitySuffix(model, qualityPreset);
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
