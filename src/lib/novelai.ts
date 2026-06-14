import type { NoiseSchedule } from "../constants/generation";

const NOVELAI_IMAGE_STREAM_API_URL =
  "https://image.novelai.net/ai/generate-image-stream";
const NOVELAI_VIBE_ENCODE_API_URL =
  "https://image.novelai.net/ai/encode-vibe";
const NOVELAI_SUBSCRIPTION_API_URL =
  "https://api.novelai.net/user/subscription";

export type NovelAiAnlasBalance = {
  fixed: number;
  purchased: number;
  total: number;
};

export type NovelAiPreciseReferenceType =
  | "character"
  | "style"
  | "character&style";

export async function getNovelAiAnlasBalance(
  token: string,
): Promise<NovelAiAnlasBalance> {
  const cleanToken = normalizeBearerToken(token);
  const response = await fetch(NOVELAI_SUBSCRIPTION_API_URL, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${cleanToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as {
    trainingStepsLeft?: {
      fixedTrainingStepsLeft?: number;
      purchasedTrainingSteps?: number;
    };
  };

  const fixed = data.trainingStepsLeft?.fixedTrainingStepsLeft ?? 0;
  const purchased = data.trainingStepsLeft?.purchasedTrainingSteps ?? 0;
  return { fixed, purchased, total: fixed + purchased };
}
export type GenerateNovelAiImageInput = {
  token: string;
  prompt: string;
  negativePrompt: string;
  characterPrompts?: GenerateNovelAiCharacterPrompt[];
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
};

export type GenerateNovelAiImageStreamResult = {
  imageBase64: string;
  seed: number;
};

export type NovelAiImageStreamEvent =
  | {
      type: "intermediate";
      imageBase64: string;
      step: number | null;
      generationId: number | null;
    }
  | {
      type: "final";
      imageBase64: string;
      generationId: number | null;
    }
  | {
      type: "error";
      message: string;
    };

type NovelAiImageStreamRawEvent = {
  event_type?: string;
  samp_ix?: number;
  step_ix?: number;
  gen_id?: number;
  image?: string;
  message?: string;
  error?: string;
};

function readUInt32BE(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] * 0x1000000 +
    ((bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3])
  );
}

function decodeBytes(bytes: Uint8Array): string {
  if (typeof TextDecoder !== "undefined") {
    return new TextDecoder("utf-8").decode(bytes);
  }

  let text = "";
  for (let index = 0; index < bytes.length; index += 1) {
    text += String.fromCharCode(bytes[index]);
  }
  return text;
}

function decodeAscii(bytes: Uint8Array): string {
  let text = "";
  for (let index = 0; index < bytes.length; index += 1) {
    text += String.fromCharCode(bytes[index]);
  }
  return text;
}

function findNullByte(bytes: Uint8Array, start = 0): number {
  for (let index = start; index < bytes.length; index += 1) {
    if (bytes[index] === 0) {
      return index;
    }
  }
  return -1;
}

function addMetadataEntry(
  metadata: Record<string, string>,
  key: string,
  value: string,
) {
  if (!metadata[key]) {
    metadata[key] = value;
    return;
  }

  let duplicateIndex = 2;
  while (metadata[`${key}#${duplicateIndex}`]) {
    duplicateIndex += 1;
  }
  metadata[`${key}#${duplicateIndex}`] = value;
}

export function extractPngTextMetadata(bytes: Uint8Array): Record<string, string> {
  const metadata: Record<string, string> = {};
  const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];

  if (!pngSignature.every((value, index) => bytes[index] === value)) {
    return metadata;
  }

  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = readUInt32BE(bytes, offset);
    const type = decodeAscii(bytes.subarray(offset + 4, offset + 8));
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;

    if (dataEnd + 4 > bytes.length) {
      break;
    }

    const data = bytes.subarray(dataStart, dataEnd);

    if (type === "tEXt") {
      const separatorIndex = findNullByte(data);
      if (separatorIndex > 0) {
        const key = decodeBytes(data.subarray(0, separatorIndex));
        const value = decodeBytes(data.subarray(separatorIndex + 1));
        addMetadataEntry(metadata, key, value);
      }
    }

    if (type === "iTXt") {
      const keywordEnd = findNullByte(data);
      if (keywordEnd > 0 && data[keywordEnd + 1] === 0) {
        const languageEnd = findNullByte(data, keywordEnd + 3);
        const translatedKeywordEnd = findNullByte(data, languageEnd + 1);

        if (languageEnd !== -1 && translatedKeywordEnd !== -1) {
          const key = decodeBytes(data.subarray(0, keywordEnd));
          const value = decodeBytes(data.subarray(translatedKeywordEnd + 1));
          addMetadataEntry(metadata, key, value);
        }
      }
    }

    offset = dataEnd + 4;
  }

  return metadata;
}

function isV4Model(model: string): boolean {
  return model.startsWith("nai-diffusion-4");
}

function normalizeBearerToken(token: string): string {
  const trimmed = token.trim();
  return trimmed.toLowerCase().startsWith("bearer ")
    ? trimmed.slice(7).trim()
    : trimmed;
}

type V4CharacterCaption = {
  char_caption: string;
  centers: [{ x: number; y: number }];
};

function createV4CharacterCaption(prompt: string): V4CharacterCaption {
  return {
    char_caption: prompt,
    centers: [{ x: 0.5, y: 0.5 }],
  };
}

function createV4Prompt(
  prompt: string,
  useOrder: boolean,
  characterCaptions: V4CharacterCaption[] = [],
) {
  return {
    caption: {
      base_caption: prompt,
      char_captions: characterCaptions,
    },
    use_coords: false,
    use_order: useOrder,
    legacy_uc: false,
  };
}

function stripBase64Header(value: string): string {
  const commaIndex = value.indexOf(",");
  return commaIndex === -1 ? value : value.slice(commaIndex + 1);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read vibe encoding."));
    reader.onloadend = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Unexpected vibe encoding response."));
        return;
      }
      resolve(stripBase64Header(reader.result));
    };
    reader.readAsDataURL(blob);
  });
}

export async function encodeNovelAiVibe(
  token: string,
  imageBase64: string,
  informationExtracted: number,
): Promise<string> {
  const cleanToken = normalizeBearerToken(token);
  const response = await fetch(NOVELAI_VIBE_ENCODE_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cleanToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      image: stripBase64Header(imageBase64),
      model: "nai-diffusion-4-5-full",
      information_extracted: informationExtracted,
    }),
  });

  if (!response.ok) {
    throw new Error(`Vibe encode failed: HTTP ${response.status}`);
  }

  return blobToBase64(await response.blob());
}

function createImageGenerationBody({
  prompt,
  negativePrompt,
  characterPrompts = [],
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
  const seed = inputSeed ?? Math.floor(Math.random() * 4_294_967_296);
  const shouldUseV4Prompt = isV4Model(model);
  const isI2I = Boolean(i2iImageBase64);
  const hasVibes = vibeEncodedImages.length > 0;
  const hasPreciseReferences = preciseReferenceImages.length > 0;
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
  const v4PromptCharacterCaptions = characterPrompts.map((item) =>
    createV4CharacterCaption(item.prompt),
  );
  const v4NegativePromptCharacterCaptions = characterPrompts.map((item) =>
    createV4CharacterCaption(item.negativePrompt),
  );
  const parameters = {
    width,
    height,
    scale: promptGuidance,
    cfg_rescale: promptGuidanceRescale,
    noise_schedule: noiseSchedule,
    sampler,
    steps,
    n_samples: 1,
    seed,
    negative_prompt: negativePrompt,
    uc: negativePrompt,
    qualityToggle: true,
    params_version: 3,
    legacy: false,
    legacy_uc: false,
    add_original_image: true,
    prefer_brownian: true,
    ucPreset: 0,
    image_format: "png",
    skip_cfg_above_sigma: varietyPlus ? 58 : null,
    ...(i2iImageBase64
      ? {
          image: stripBase64Header(i2iImageBase64),
          strength: i2iStrength,
          noise: i2iNoise,
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
          director_reference_information_extracted:
            preciseReferenceImages.map(() => 1),
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
          v4_prompt: createV4Prompt(prompt, true, v4PromptCharacterCaptions),
          v4_negative_prompt: createV4Prompt(
            negativePrompt,
            false,
            v4NegativePromptCharacterCaptions,
          ),
        }
      : {}),
  };

  return {
    seed,
    body: {
      input: prompt,
      model,
      action: isI2I ? "img2img" : "generate",
      parameters,
    },
  };
}

function parseSseEvents(
  buffer: string,
  onEvent: (eventName: string, data: unknown) => void,
) {
  let nextBuffer = buffer;
  let separatorIndex = nextBuffer.search(/\r?\n\r?\n/);

  while (separatorIndex !== -1) {
    const rawEvent = nextBuffer.slice(0, separatorIndex);
    nextBuffer = nextBuffer
      .slice(separatorIndex)
      .replace(/^\r?\n\r?\n/, "");

    const lines = rawEvent.split(/\r?\n/);
    const eventName =
      lines
        .find((line) => line.startsWith("event:"))
        ?.slice("event:".length)
        .trim() || "message";
    const dataText = lines
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice("data:".length).trimStart())
      .join("\n");

    let data: unknown = dataText;
    if (dataText) {
      try {
        data = JSON.parse(dataText);
      } catch {
        data = dataText;
      }
    }

    onEvent(eventName, data);

    separatorIndex = nextBuffer.search(/\r?\n\r?\n/);
  }

  return nextBuffer;
}

function getStreamErrorMessage(data: unknown): string {
  if (typeof data === "string") {
    return data;
  }

  if (data && typeof data === "object") {
    const event = data as NovelAiImageStreamRawEvent;
    return event.message ?? event.error ?? JSON.stringify(data);
  }

  return "NovelAI image stream failed.";
}

function toNovelAiImageStreamEvent(
  data: unknown,
): NovelAiImageStreamEvent | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const event = data as NovelAiImageStreamRawEvent;
  if (event.samp_ix !== undefined && event.samp_ix !== 0) {
    return null;
  }

  if (event.event_type === "intermediate" && event.image) {
    return {
      type: "intermediate",
      imageBase64: event.image,
      step: event.step_ix ?? null,
      generationId: event.gen_id ?? null,
    };
  }

  if (event.event_type === "final" && event.image) {
    return {
      type: "final",
      imageBase64: event.image,
      generationId: event.gen_id ?? null,
    };
  }

  if (event.event_type === "error") {
    return {
      type: "error",
      message: getStreamErrorMessage(data),
    };
  }

  return null;
}

export async function generateNovelAiImageStream(
  input: GenerateNovelAiImageInput,
  onEvent?: (event: NovelAiImageStreamEvent) => void,
): Promise<GenerateNovelAiImageStreamResult> {
  const { token, ...requestInput } = input;
  const { seed, body } = createImageGenerationBody(requestInput);
  const cleanToken = normalizeBearerToken(token);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let responseOffset = 0;
    let buffer = "";
    let finalImageBase64: string | null = null;
    let isSettled = false;

    function settleError(error: unknown) {
      if (isSettled) return;
      isSettled = true;
      reject(error);
    }

    function handleStreamText(text: string) {
      buffer = parseSseEvents(buffer + text, (_eventName, data) => {
        const streamEvent = toNovelAiImageStreamEvent(data);
        if (!streamEvent) return;

        try {
          onEvent?.(streamEvent);
        } catch (error: unknown) {
          settleError(error);
          xhr.abort();
          return;
        }

        if (streamEvent.type === "final") {
          finalImageBase64 = streamEvent.imageBase64;
        }

        if (streamEvent.type === "error") {
          settleError(new Error(streamEvent.message));
          xhr.abort();
        }
      });
    }

    xhr.open("POST", NOVELAI_IMAGE_STREAM_API_URL, true);
    xhr.setRequestHeader("Authorization", `Bearer ${cleanToken}`);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.setRequestHeader("Accept", "text/event-stream");

    xhr.onprogress = () => {
      const nextText = xhr.responseText.slice(responseOffset);
      responseOffset = xhr.responseText.length;
      if (nextText) {
        handleStreamText(nextText);
      }
    };

    xhr.onerror = () => {
      settleError(new Error("NovelAI image stream network error."));
    };

    xhr.onabort = () => {
      settleError(new Error("NovelAI image stream was aborted."));
    };

    xhr.onload = () => {
      if (isSettled) return;

      const nextText = xhr.responseText.slice(responseOffset);
      responseOffset = xhr.responseText.length;
      if (nextText) {
        handleStreamText(nextText);
      }

      if (xhr.status < 200 || xhr.status >= 300) {
        settleError(
          new Error(`HTTP ${xhr.status} ${xhr.statusText}\n${xhr.responseText}`),
        );
        return;
      }

      if (!finalImageBase64) {
        settleError(
          new Error("NovelAI image stream finished without a final image."),
        );
        return;
      }

      isSettled = true;
      resolve({
        imageBase64: finalImageBase64,
        seed,
      });
    };

    xhr.send(
      JSON.stringify({
        ...body,
        parameters: {
          ...body.parameters,
          stream: "sse",
        },
      }),
    );
  });
}
