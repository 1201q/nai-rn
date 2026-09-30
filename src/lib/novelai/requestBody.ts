import {
  generateRandomSeed,
  type NoiseSchedule,
} from "../../constants/generation";
import { getModelCapabilities } from "../../constants/models";
import { prepareImagePromptCaptions } from "../imagePromptCaptions";
import { type UcPresetIndex } from "../naiPresets";

type NovelAiPreciseReferenceType = "character" | "style" | "character&style";

export type GenerateNovelAiImageInput = {
  token: string;
  prompt: string;
  negativePrompt: string;
  characterPrompts?: GenerateNovelAiCharacterPrompt[];
  characterPositionEnabled?: boolean;
  model: string;
  width: number;
  height: number;
  steps: number;
  promptGuidance: number;
  promptGuidanceRescale: number;
  noiseSchedule: NoiseSchedule;
  sampler: string;
  seed?: number;
  varietyPlus?: boolean;
  qualityToggle?: boolean;
  ucPreset?: UcPresetIndex;
  i2iImageBase64?: string;
  i2iStrength?: number;
  i2iNoise?: number;
  vibeEncodedImages?: string[];
  vibeInformationExtracted?: number[];
  vibeStrengths?: number[];
  normalizeVibeStrengths?: boolean;
  preciseReferenceImages?: string[];
  preciseReferenceStrengths?: number[];
  preciseReferenceFidelities?: number[];
  preciseReferenceTypes?: NovelAiPreciseReferenceType[];
};

export type GenerateNovelAiCharacterPrompt = {
  prompt: string;
  negativePrompt: string;
  position: { x: number; y: number };
};

// 공식 웹과 동일: 스케줄을 쓰지 않는 샘플러는 noise_schedule을 보내지 않고,
// V4 이상은 native를 지원하지 않아 샘플러 기본 스케줄로 대체한다.
const SAMPLERS_WITHOUT_NOISE_SCHEDULE = new Set([
  "ddim",
  "plms",
  "k_lms",
  "nai_smea",
  "nai_smea_dyn",
  "ddim_v3",
]);

export function resolveNoiseSchedule(
  model: string,
  sampler: string,
  noiseSchedule: NoiseSchedule,
): NoiseSchedule | undefined {
  if (SAMPLERS_WITHOUT_NOISE_SCHEDULE.has(sampler)) return undefined;
  if (
    !getModelCapabilities(model).nativeNoiseSchedule &&
    noiseSchedule === "native"
  ) {
    return sampler === "k_dpmpp_2m" || sampler === "k_dpm_2"
      ? "exponential"
      : "karras";
  }
  return noiseSchedule;
}

// 공식 웹과 동일: V3는 픽셀 수가 기준 이상이면 SMEA를 자동으로 켠다 (i2i와 일부 샘플러 제외).
const V3_AUTO_SMEA_MIN_PIXELS = 2_166_785;
const SAMPLERS_WITHOUT_SMEA = new Set(["k_dpmpp_2s_ancestral", "k_dpmpp_sde"]);

export function shouldUseAutoSmea(
  model: string,
  width: number,
  height: number,
  sampler: string,
  isI2I: boolean,
): boolean {
  return (
    getModelCapabilities(model).autoSmea &&
    !isI2I &&
    width * height >= V3_AUTO_SMEA_MIN_PIXELS &&
    !SAMPLERS_WITHOUT_SMEA.has(sampler)
  );
}

// 공식 웹과 동일: 모델별 기준 sigma를 832x1216 latent 대비 크기로 보정한다.
export function getVarietyPlusSigma(
  model: string,
  width: number,
  height: number,
): number {
  const baseSigma = getModelCapabilities(model).varietyPlusBaseSigma;
  const latentArea = Math.floor(width / 8) * Math.floor(height / 8);
  return baseSigma * Math.sqrt(latentArea / (104 * 152));
}

type V4CharacterCaption = {
  char_caption: string;
  centers: [{ x: number; y: number }];
};

function createV4CharacterCaption(
  prompt: string,
  position: { x: number; y: number },
): V4CharacterCaption {
  return {
    char_caption: prompt,
    centers: [{ x: position.x, y: position.y }],
  };
}

function createV4Prompt(
  prompt: string,
  useOrder: boolean,
  useCoords: boolean,
  characterCaptions: V4CharacterCaption[] = [],
) {
  return {
    caption: {
      base_caption: prompt,
      char_captions: characterCaptions,
    },
    use_coords: useCoords,
    use_order: useOrder,
    legacy_uc: false,
  };
}

export function stripBase64Header(value: string): string {
  const commaIndex = value.indexOf(",");
  return commaIndex === -1 ? value : value.slice(commaIndex + 1);
}

export function createImageGenerationBody({
  prompt,
  negativePrompt,
  characterPrompts = [],
  characterPositionEnabled = false,
  model,
  width,
  height,
  steps,
  promptGuidance,
  promptGuidanceRescale,
  noiseSchedule,
  sampler,
  seed: inputSeed,
  varietyPlus = false,
  qualityToggle = true,
  ucPreset = 0,
  i2iImageBase64,
  i2iStrength = 0.7,
  i2iNoise = 0,
  vibeEncodedImages = [],
  vibeInformationExtracted = [],
  vibeStrengths = [],
  normalizeVibeStrengths = true,
  preciseReferenceImages = [],
  preciseReferenceStrengths = [],
  preciseReferenceFidelities = [],
  preciseReferenceTypes = [],
}: Omit<GenerateNovelAiImageInput, "token">) {
  const seed = inputSeed ?? generateRandomSeed();
  const captions = prepareImagePromptCaptions({
    model,
    prompt,
    negativePrompt,
    qualityToggle,
    ucPreset,
    characterPrompts,
  });
  const mergedPrompt = captions.positiveBaseCaption;
  const mergedNegativePrompt = captions.negativeBaseCaption;
  const shouldUseV4Prompt = getModelCapabilities(model).v4Prompt;
  const isI2I = Boolean(i2iImageBase64);
  const hasVibes = vibeEncodedImages.length > 0;
  const hasPreciseReferences = preciseReferenceImages.length > 0;
  const useCharacterCoords =
    shouldUseV4Prompt &&
    characterPositionEnabled &&
    characterPrompts.length > 0;
  const preciseStrengthValues =
    preciseReferenceStrengths.length === preciseReferenceImages.length
      ? preciseReferenceStrengths
      : preciseReferenceImages.map(() => 0.6);
  const preciseFidelityValues =
    preciseReferenceFidelities.length === preciseReferenceImages.length
      ? preciseReferenceFidelities
      : preciseReferenceImages.map(() => 0.6);
  const preciseTypes =
    preciseReferenceTypes.length === preciseReferenceImages.length
      ? preciseReferenceTypes
      : preciseReferenceImages.map(() => "character&style" as const);
  const v4PromptCharacterCaptions = captions.positiveCharacterCaptions.map(
    (caption, index) =>
      createV4CharacterCaption(
        caption,
        useCharacterCoords
          ? characterPrompts[index].position
          : { x: 0.5, y: 0.5 },
      ),
  );
  const v4NegativePromptCharacterCaptions =
    captions.negativeCharacterCaptions.map((caption, index) =>
      createV4CharacterCaption(
        caption,
        useCharacterCoords
          ? characterPrompts[index].position
          : { x: 0.5, y: 0.5 },
      ),
    );
  const resolvedNoiseSchedule = resolveNoiseSchedule(
    model,
    sampler,
    noiseSchedule,
  );
  const autoSmea = shouldUseAutoSmea(model, width, height, sampler, isI2I);
  const parameters = {
    width,
    height,
    scale: promptGuidance,
    cfg_rescale: promptGuidanceRescale,
    ...(resolvedNoiseSchedule ? { noise_schedule: resolvedNoiseSchedule } : {}),
    sampler,
    ...(shouldUseV4Prompt ? {} : { sm: autoSmea, sm_dyn: false }),
    steps,
    n_samples: 1,
    seed,
    negative_prompt: mergedNegativePrompt,
    uc: mergedNegativePrompt,
    qualityToggle,
    params_version: 3,
    legacy: false,
    legacy_uc: false,
    add_original_image: true,
    // 공식 웹과 동일: Euler Ancestral + non-native 스케줄일 때만 버그 모드를 끈다 (서버 기본값은 true).
    ...(sampler === "k_euler_ancestral" && resolvedNoiseSchedule !== "native"
      ? { deliberate_euler_ancestral_bug: false, prefer_brownian: true }
      : {}),
    ucPreset,
    image_format: "png",
    use_coords: useCharacterCoords,
    skip_cfg_above_sigma: varietyPlus
      ? getVarietyPlusSigma(model, width, height)
      : null,
    ...(i2iImageBase64
      ? {
          image: stripBase64Header(i2iImageBase64),
          strength: i2iStrength,
          noise: i2iNoise,
          // 공식 웹과 동일한 i2i 기본값.
          extra_noise_seed: seed - 1,
          color_correct: false,
        }
      : {}),
    ...(hasVibes
      ? {
          reference_image_multiple: vibeEncodedImages.map(stripBase64Header),
          reference_information_extracted_multiple: vibeInformationExtracted,
          reference_strength_multiple: vibeStrengths,
          normalize_reference_strength_multiple: normalizeVibeStrengths,
        }
      : {}),
    ...(hasPreciseReferences
      ? {
          director_reference_images:
            preciseReferenceImages.map(stripBase64Header),
          director_reference_information_extracted: preciseReferenceImages.map(
            () => 1,
          ),
          director_reference_strength_values: preciseStrengthValues,
          director_reference_secondary_strength_values:
            preciseFidelityValues.map((value) => 1 - value),
          director_reference_descriptions: preciseTypes.map((type) => ({
            caption: {
              base_caption: type,
              char_captions: [],
            },
            legacy_uc: false,
          })),
        }
      : {}),
    ...(shouldUseV4Prompt
      ? {
          legacy_v3_extend: false,
          v4_prompt: createV4Prompt(
            mergedPrompt,
            true,
            useCharacterCoords,
            v4PromptCharacterCaptions,
          ),
          v4_negative_prompt: createV4Prompt(
            mergedNegativePrompt,
            false,
            false,
            v4NegativePromptCharacterCaptions,
          ),
        }
      : {}),
  };

  return {
    seed,
    body: {
      input: mergedPrompt,
      model,
      action: isI2I ? "img2img" : "generate",
      parameters,
    },
  };
}
