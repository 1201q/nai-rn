import { AppState, Platform } from "react-native";
import { generationImagePipeline, type NativeImageEvent } from "../../modules/generation-image-pipeline";
import {
  createImageGenerationBody, generateNovelAiImageStream, normalizeBearerToken,
  NovelAiRequestError, type GenerateNovelAiImageInput,
} from "./novelai";
import {
  discardNativeGenerationFiles, prepareNativeGenerationFiles, saveGenerationImageBase64,
  savePreparedGeneration,
} from "./generationHistory";
import { measureGenerationAsync, measureGenerationSync } from "./generationPerformance";

export type GenerationImageEvent = Omit<NativeImageEvent, "requestId">;

export async function generateAndSaveImage(
  input: GenerateNovelAiImageInput,
  onEvent: (event: GenerationImageEvent) => void,
  signal: AbortSignal,
) {
  const recordInput = {
    prompt: input.prompt, negativePrompt: input.negativePrompt, model: input.model,
    width: input.width, height: input.height, steps: input.steps,
    scale: input.promptGuidance, cfgRescale: input.promptGuidanceRescale,
    noiseSchedule: input.noiseSchedule, sampler: input.sampler,
  };
  if (Platform.OS !== "android") {
    const result = await generateNovelAiImageStream(input, (event) => {
      if (event.type === "error") return;
      onEvent({
        type: event.type, step: event.type === "intermediate" ? event.step : null,
        generationId: event.generationId,
        imageUri: `data:image/${event.type === "final" ? "png" : "jpeg"};base64,${event.imageBase64}`,
      });
    }, signal);
    return measureGenerationAsync("save.elapsed", () => saveGenerationImageBase64({
      ...recordInput, imageBase64: result.imageBase64, seed: result.seed,
    }));
  }
  const native = generationImagePipeline;
  if (!native) throw new Error("Android 이미지 처리 모듈이 없습니다. 새 APK를 빌드해 설치해 주세요.");
  if (signal.aborted) throw cancelled();
  const files = await prepareNativeGenerationFiles();
  const { token, ...requestInput } = input;
  const { seed, body } = measureGenerationSync("request.build", () => createImageGenerationBody(requestInput));
  const json = measureGenerationSync("request.serialize", () => JSON.stringify({
    ...body, parameters: { ...body.parameters, stream: "sse" },
  }));
  native.prepare(files.id, AppState.currentState === "active");
  let listening = true;
  const subscription = native.addListener("image", (event) => {
    if (listening && event.requestId === files.id) onEvent(event);
  });
  const appState = AppState.addEventListener("change", (state) => {
    native.setPreviewEnabled(files.id, state === "active");
  });
  const abort = () => native.cancel(files.id);
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) abort();
  try {
    const result = await measureGenerationAsync("native.response_and_save", () => native.generate(
      files.id, normalizeBearerToken(token), json, files.originalUri, files.thumbnailUri,
    ));
    return await measureGenerationAsync("save.elapsed", () => savePreparedGeneration(
      files, { ...recordInput, seed, metadata: result.metadata }, result.thumbnailUri !== null,
    ));
  } catch (error) {
    discardNativeGenerationFiles(files);
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("NAI_CANCELLED")) throw cancelled();
    const status = message.match(/NAI_HTTP_(\d+)/)?.[1];
    if (status) throw new NovelAiRequestError(Number(status),
      status === "401" || status === "403"
        ? "NovelAI 토큰이 유효하지 않습니다. 설정에서 토큰을 확인해 주세요."
        : `HTTP ${status}`);
    throw error instanceof Error ? error : new Error(message);
  } finally {
    listening = false;
    subscription.remove();
    appState.remove();
    signal.removeEventListener("abort", abort);
  }
}

function cancelled() {
  const error = new Error("NovelAI image generation was cancelled.");
  error.name = "AbortError";
  return error;
}
