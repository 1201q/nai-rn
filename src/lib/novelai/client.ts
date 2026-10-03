import {
  createNovelAiRequestError,
  describeNovelAiHttpError,
  extractNovelAiServerMessage,
  NovelAiRequestError,
} from "./errors";
import {
  createImageGenerationBody,
  type GenerateNovelAiImageInput,
  stripBase64Header,
} from "./requestBody";
import {
  getStreamErrorMessage,
  type NovelAiImageStreamEvent,
  parseSseEvents,
  toNovelAiImageStreamEvent,
} from "./sse";

const NOVELAI_IMAGE_STREAM_API_URL =
  "https://image.novelai.net/ai/generate-image-stream";
const NOVELAI_VIBE_ENCODE_API_URL = "https://image.novelai.net/ai/encode-vibe";
const NOVELAI_SUBSCRIPTION_API_URL =
  "https://image.novelai.net/user/subscription";

export type NovelAiAnlasBalance = {
  fixed: number;
  purchased: number;
  total: number;
  // 0 paper, 1 tablet, 2 scroll, 3 opus
  tier: number;
  // 구독 만료 시각 (Unix 초)
  expiresAt: number;
  // Opus 사용량 한도 소진 여부 (V5 전용). 응답에 usage가 없으면 undefined
  usageNegative?: boolean;
  // Opus 사용량 한도의 남은 비율 (0~100). 응답에 usage가 없으면 undefined
  usagePercent?: number;
  // 다음 1% 회복 시각 (epoch ms). 응답의 timeUntilNextPercent(초)를 받은 시각 기준으로 바꾼 값
  usageNextPercentAt?: number;
};

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
    throw createNovelAiRequestError(
      response.status,
      `HTTP ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as {
    tier?: number;
    expiresAt?: number;
    trainingStepsLeft?: {
      fixedTrainingStepsLeft?: number;
      purchasedTrainingSteps?: number;
    };
    usage?: {
      percent?: number;
      isNegative?: boolean;
      timeUntilNextPercent?: number;
    };
  };

  const fixed = data.trainingStepsLeft?.fixedTrainingStepsLeft ?? 0;
  const purchased = data.trainingStepsLeft?.purchasedTrainingSteps ?? 0;
  return {
    fixed,
    purchased,
    total: fixed + purchased,
    tier: data.tier ?? 0,
    expiresAt: data.expiresAt ?? 0,
    usageNegative: data.usage?.isNegative,
    usagePercent: data.usage?.percent,
    usageNextPercentAt:
      data.usage?.timeUntilNextPercent === undefined
        ? undefined
        : Date.now() + data.usage.timeUntilNextPercent * 1000,
  };
}

type GenerateNovelAiImageStreamResult = {
  imageBase64: string;
  seed: number;
};

export function normalizeBearerToken(token: string): string {
  const trimmed = token.trim();
  return trimmed.toLowerCase().startsWith("bearer ")
    ? trimmed.slice(7).trim()
    : trimmed;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export async function encodeNovelAiVibe(
  token: string,
  imageBase64: string,
  informationExtracted: number,
  model: string,
): Promise<string> {
  const cleanToken = normalizeBearerToken(token);
  const requestBody = JSON.stringify({
    image: stripBase64Header(imageBase64),
    model,
    information_extracted: informationExtracted,
  });

  // RN에서 fetch().blob() 은 바이너리 응답에서 resolve되지 않아(hang) 생성이 멈춘다.
  // 스트림과 동일하게 XHR arraybuffer로 바이너리를 받아 base64 변환한다.
  const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", NOVELAI_VIBE_ENCODE_API_URL, true);
    xhr.responseType = "arraybuffer";
    xhr.setRequestHeader("Authorization", `Bearer ${cleanToken}`);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(
          new NovelAiRequestError(
            xhr.status,
            `Vibe 인코딩 실패: ${describeNovelAiHttpError(xhr.status)}`,
          ),
        );
        return;
      }
      resolve(xhr.response as ArrayBuffer);
    };
    xhr.onerror = () => reject(new Error("Vibe encode network error."));
    xhr.send(requestBody);
  });

  return arrayBufferToBase64(buffer);
}

function createAbortError() {
  const error = new Error("NovelAI image generation was cancelled.");
  error.name = "AbortError";
  return error;
}

export async function generateNovelAiImageStream(
  input: GenerateNovelAiImageInput,
  onEvent?: (event: NovelAiImageStreamEvent) => void,
  signal?: AbortSignal,
): Promise<GenerateNovelAiImageStreamResult> {
  const { token, ...requestInput } = input;
  const { seed, body } = createImageGenerationBody(requestInput);
  const cleanToken = normalizeBearerToken(token);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let responseOffset = 0;
    let buffer = "";
    let scanOffset = 0;
    let finalImageBase64: string | null = null;
    let isSettled = false;

    function cleanup() {
      signal?.removeEventListener("abort", handleAbort);
    }

    function settleError(error: unknown) {
      if (isSettled) return;
      isSettled = true;
      cleanup();
      reject(error);
    }

    function settleSuccess(result: GenerateNovelAiImageStreamResult) {
      if (isSettled) return;
      isSettled = true;
      cleanup();
      resolve(result);
    }

    function handleAbort() {
      settleError(createAbortError());
      xhr.abort();
    }

    function handleStreamText(text: string) {
      const result = parseSseEvents(
        buffer + text,
        scanOffset,
        (eventName, data) => {
          // `event: error`는 본문이 JSON이 아니어도 오류로 처리한다.
          const streamEvent: NovelAiImageStreamEvent | null =
            eventName === "error"
              ? {
                  type: "error",
                  message: `NovelAI 생성 오류: ${getStreamErrorMessage(data)}`,
                }
              : toNovelAiImageStreamEvent(data);
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
        },
      );
      buffer = result.rest;
      scanOffset = result.scanOffset;
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
      settleError(createAbortError());
    };

    xhr.onload = () => {
      if (isSettled) return;

      const nextText = xhr.responseText.slice(responseOffset);
      responseOffset = xhr.responseText.length;
      if (nextText) {
        handleStreamText(nextText);
      }
      if (isSettled) return;

      if (xhr.status < 200 || xhr.status >= 300) {
        settleError(
          new NovelAiRequestError(
            xhr.status,
            describeNovelAiHttpError(
              xhr.status,
              extractNovelAiServerMessage(xhr.responseText),
            ),
          ),
        );
        return;
      }

      if (!finalImageBase64) {
        settleError(
          new Error("NovelAI image stream finished without a final image."),
        );
        return;
      }

      settleSuccess({
        imageBase64: finalImageBase64,
        seed,
      });
    };

    signal?.addEventListener("abort", handleAbort, { once: true });
    if (signal?.aborted) {
      handleAbort();
      return;
    }

    try {
      xhr.send(
        JSON.stringify({
          ...body,
          parameters: {
            ...body.parameters,
            stream: "sse",
          },
        }),
      );
    } catch (error: unknown) {
      settleError(error);
    }
  });
}
