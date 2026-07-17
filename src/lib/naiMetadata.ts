import {
  MAX_CHARACTER_PROMPTS,
  NAI_RESOLUTIONS,
  NOISE_SCHEDULES,
  SAMPLERS,
  type NaiResolution,
  type NoiseSchedule,
} from "../constants/generation";
import type { CharacterPrompt } from "../store/generationStore";
import { isBoolean, isNonEmptyString, isNumber } from "./guards";
import {
  inferUcPreset,
  isUcPresetIndex,
  QUALITY_TAGS_SUFFIX,
  stripQualityTags,
  stripUcPreset,
  type UcPresetIndex,
} from "./naiPresets";

export type ParsedNaiMetadata = {
  raw: Record<string, string>;
  prompt?: string;
  negativePrompt?: string;
  qualityToggle?: boolean;
  ucPreset?: UcPresetIndex;
  characters?: CharacterPrompt[];
  model?: string;
  resolution?: NaiResolution;
  steps?: number;
  promptGuidance?: number;
  promptGuidanceRescale?: number;
  noiseSchedule?: NoiseSchedule;
  sampler?: string;
  varietyPlus?: boolean;
  seed?: number;
  hasSettings: boolean;
};

function isNoiseSchedule(value: unknown): value is NoiseSchedule {
  return NOISE_SCHEDULES.some((item) => item.value === value);
}

function isSampler(value: unknown): value is string {
  return SAMPLERS.some((item) => item.value === value);
}

function findResolutionPreset(width: number, height: number): NaiResolution {
  for (const group of NAI_RESOLUTIONS) {
    const preset = group.options.find(
      (item) => item.width === width && item.height === height,
    );
    if (preset) {
      return preset;
    }
  }
  return { label: "Custom Resolution", width, height };
}

// 메타데이터엔 API model id 가 없어 'Source'/'Software' 서명으로 best-effort 추정.
function mapSourceToModel(
  source: string | undefined,
  software: string | undefined,
): string | undefined {
  const text = `${source ?? ""} ${software ?? ""}`;
  if (/furry/i.test(text)) return "nai-diffusion-furry-3";
  if (/v4\.5/i.test(text)) {
    return /curated/i.test(text)
      ? "nai-diffusion-4-5-curated"
      : "nai-diffusion-4-5-full";
  }
  if (/v4/i.test(text)) return "nai-diffusion-4-curated-preview";
  if (/v3/i.test(text) || /stable diffusion xl/i.test(text)) {
    return "nai-diffusion-3";
  }
  return undefined;
}

type CaptionEntry = {
  char_caption?: unknown;
  centers?: unknown;
};

function normalizeCenter(value: unknown): { x: number; y: number } {
  const center = value as { x?: unknown; y?: unknown };
  return {
    x: isNumber(center.x) ? Math.max(0, Math.min(1, center.x)) : 0.5,
    y: isNumber(center.y) ? Math.max(0, Math.min(1, center.y)) : 0.5,
  };
}

function extractCenters(value: unknown): Array<{ x: number; y: number }> {
  if (!Array.isArray(value) || value.length === 0) {
    return [{ x: 0.5, y: 0.5 }];
  }

  return value.map(normalizeCenter);
}

function extractCharCaptions(
  value: unknown,
): Array<{ prompt: string; centers: Array<{ x: number; y: number }> }> {
  const captions = (value as { caption?: { char_captions?: unknown } })?.caption
    ?.char_captions;
  if (!Array.isArray(captions)) return [];
  return captions.map((item: CaptionEntry) => ({
    prompt: isNonEmptyString(item?.char_caption) ? item.char_caption : "",
    centers: extractCenters(item?.centers),
  }));
}

function buildCharacters(comment: Record<string, unknown>): CharacterPrompt[] {
  const prompts = extractCharCaptions(comment.v4_prompt);
  const negatives = extractCharCaptions(comment.v4_negative_prompt);
  const count = Math.min(
    Math.max(prompts.length, negatives.length),
    MAX_CHARACTER_PROMPTS,
  );

  const characters: CharacterPrompt[] = [];
  for (
    let index = 0;
    index < count && characters.length < MAX_CHARACTER_PROMPTS;
    index += 1
  ) {
    const prompt = prompts[index]?.prompt ?? "";
    const negativePrompt = negatives[index]?.prompt ?? "";
    if (!prompt && !negativePrompt) continue;
    const centers = prompts[index]?.centers ?? negatives[index]?.centers ?? [
      { x: 0.5, y: 0.5 },
    ];
    for (let centerIndex = 0; centerIndex < centers.length; centerIndex += 1) {
      if (characters.length >= MAX_CHARACTER_PROMPTS) break;
      characters.push({
        id: `import-${Date.now()}-${index}-${centerIndex}`,
        prompt,
        negativePrompt,
        enabled: true,
        position: centers[centerIndex],
      });
    }
  }
  return characters;
}

function getBaseCaption(value: unknown): string | undefined {
  const caption = (value as { caption?: { base_caption?: unknown } })?.caption
    ?.base_caption;
  return isNonEmptyString(caption) ? caption : undefined;
}

export function parseNaiMetadata(
  raw: Record<string, string>,
): ParsedNaiMetadata {
  const result: ParsedNaiMetadata = { raw, hasSettings: false };

  let comment: Record<string, unknown> | null = null;
  if (isNonEmptyString(raw.Comment)) {
    try {
      const parsed = JSON.parse(raw.Comment);
      if (parsed && typeof parsed === "object") {
        comment = parsed as Record<string, unknown>;
      }
    } catch {
      comment = null;
    }
  }

  // Prompt / Undesired (Comment 우선, v4 base_caption, Description 순)
  const mergedPrompt =
    (comment && isNonEmptyString(comment.prompt)
      ? comment.prompt
      : undefined) ??
    (comment ? getBaseCaption(comment.v4_prompt) : undefined) ??
    (isNonEmptyString(raw.Description) ? raw.Description : undefined);

  const mergedNegativePrompt =
    (comment && isNonEmptyString(comment.uc) ? comment.uc : undefined) ??
    (comment ? getBaseCaption(comment.v4_negative_prompt) : undefined);

  const qualityToggle =
    comment && isBoolean(comment.qualityToggle)
      ? comment.qualityToggle
      : mergedPrompt?.endsWith(QUALITY_TAGS_SUFFIX);
  const ucPreset =
    comment && isUcPresetIndex(comment.ucPreset)
      ? comment.ucPreset
      : mergedNegativePrompt
        ? inferUcPreset(mergedNegativePrompt)
        : undefined;

  if (mergedPrompt !== undefined) {
    result.prompt = qualityToggle
      ? stripQualityTags(mergedPrompt)
      : mergedPrompt;
  }
  if (mergedNegativePrompt !== undefined) {
    result.negativePrompt = stripUcPreset(mergedNegativePrompt, ucPreset);
  }
  if (qualityToggle !== undefined) result.qualityToggle = qualityToggle;
  if (ucPreset !== undefined) result.ucPreset = ucPreset;

  // Characters
  if (comment) {
    const characters = buildCharacters(comment);
    if (characters.length > 0) result.characters = characters;
  }

  // Settings
  if (comment) {
    if (isNumber(comment.width) && isNumber(comment.height)) {
      result.resolution = findResolutionPreset(comment.width, comment.height);
    }
    if (isNumber(comment.steps)) result.steps = comment.steps;
    if (isNumber(comment.scale)) result.promptGuidance = comment.scale;
    if (isNumber(comment.cfg_rescale)) {
      result.promptGuidanceRescale = comment.cfg_rescale;
    }
    if (isNoiseSchedule(comment.noise_schedule)) {
      result.noiseSchedule = comment.noise_schedule;
    }
    if (isSampler(comment.sampler)) result.sampler = comment.sampler;
    // variety+ = skip_cfg_above_sigma (켜짐: number, 꺼짐: null)
    if (comment.skip_cfg_above_sigma !== undefined) {
      result.varietyPlus = isNumber(comment.skip_cfg_above_sigma);
    }
  }
  result.model = mapSourceToModel(raw.Source, raw.Software);

  result.hasSettings =
    result.resolution !== undefined ||
    result.steps !== undefined ||
    result.promptGuidance !== undefined ||
    result.promptGuidanceRescale !== undefined ||
    result.noiseSchedule !== undefined ||
    result.sampler !== undefined ||
    result.varietyPlus !== undefined ||
    result.qualityToggle !== undefined ||
    result.ucPreset !== undefined ||
    result.model !== undefined;

  // Seed
  if (comment && isNumber(comment.seed)) result.seed = comment.seed;

  return result;
}
