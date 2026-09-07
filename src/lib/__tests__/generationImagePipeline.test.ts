import { AppState, Platform, type AppStateStatus } from "react-native";
import { generationImagePipeline, type NativeImageEvent } from "../../../modules/generation-image-pipeline";
import { generateAndSaveImage } from "../generationImagePipeline";
import { discardNativeGenerationFiles, prepareNativeGenerationFiles, savePreparedGeneration } from "../generationHistory";
import { generateNovelAiImageStream, type GenerateNovelAiImageInput } from "../novelai";

jest.mock("../../../modules/generation-image-pipeline", () => ({ generationImagePipeline: {
  prepare: jest.fn(), generate: jest.fn(), cancel: jest.fn(), setPreviewEnabled: jest.fn(), addListener: jest.fn(),
} }));
jest.mock("../generationHistory", () => ({
  prepareNativeGenerationFiles: jest.fn(), discardNativeGenerationFiles: jest.fn(), savePreparedGeneration: jest.fn(),
}));
jest.mock("../novelai", () => ({ ...jest.requireActual("../novelai"), generateNovelAiImageStream: jest.fn() }));

const native = jest.mocked(generationImagePipeline!);
const input: GenerateNovelAiImageInput = {
  token: "Bearer private-token", prompt: "test", negativePrompt: "", model: "nai-diffusion-4-5-full",
  width: 832, height: 1216, steps: 28, promptGuidance: 5, promptGuidanceRescale: 0,
  noiseSchedule: "karras", sampler: "k_euler_ancestral", seed: 42,
};
const files = { id: "gen_test", createdAt: 1, imagePath: "originals/test.png", thumbnailPath: "thumbnails/test.jpg", originalUri: "file:///original.png", thumbnailUri: "file:///thumb.jpg" };
const result = { originalUri: files.originalUri, thumbnailUri: files.thumbnailUri, metadata: { Comment: "{}" } };
const remove = jest.fn();
let listener: (event: NativeImageEvent) => void;
let changeState: (state: AppStateStatus) => void;
const originalOS = Platform.OS;

beforeEach(() => {
  jest.clearAllMocks();
  Platform.OS = "android";
  jest.mocked(prepareNativeGenerationFiles).mockResolvedValue(files);
  jest.spyOn(AppState, "addEventListener").mockImplementation((_name, fn) => {
    changeState = fn; return { remove };
  });
  native.addListener.mockImplementation((_name, fn) => { listener = fn; return { remove }; });
  native.generate.mockResolvedValue(result);
});
afterEach(() => { Platform.OS = originalOS; jest.restoreAllMocks(); });

test("uses native files and common request options without JS response decoding", async () => {
  const onEvent = jest.fn();
  native.generate.mockImplementation(async () => {
    listener({ requestId: "other", type: "final", imageUri: "file:///wrong", step: null, generationId: 1 });
    listener({ requestId: files.id, type: "intermediate", imageUri: "file:///preview.jpg", step: 1, generationId: 2 });
    changeState("background");
    return result;
  });
  await generateAndSaveImage(input, onEvent, new AbortController().signal);
  expect(generateNovelAiImageStream).not.toHaveBeenCalled();
  expect(native.generate).toHaveBeenCalledWith(files.id, "private-token", expect.any(String), files.originalUri, files.thumbnailUri);
  const body = JSON.parse(native.generate.mock.calls[0][2]);
  expect(body.parameters).toMatchObject({ stream: "sse", seed: 42, width: 832, height: 1216 });
  expect(onEvent).toHaveBeenCalledTimes(1);
  expect(native.setPreviewEnabled).toHaveBeenCalledWith(files.id, false);
  expect(savePreparedGeneration).toHaveBeenCalledWith(files, expect.objectContaining({ seed: 42, metadata: result.metadata }), true);
  expect(remove).toHaveBeenCalledTimes(2);
  listener({ requestId: files.id, type: "final", imageUri: files.originalUri, step: null, generationId: 2 });
  expect(onEvent).toHaveBeenCalledTimes(1);
});

test("bridges cancellation and normalizes native cancellation without retry", async () => {
  const controller = new AbortController();
  native.generate.mockImplementation(async () => { controller.abort(); throw new Error("NAI_CANCELLED"); });
  await expect(generateAndSaveImage(input, jest.fn(), controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  expect(native.cancel).toHaveBeenCalledWith(files.id);
  expect(savePreparedGeneration).not.toHaveBeenCalled();
  expect(generateNovelAiImageStream).not.toHaveBeenCalled();
  expect(discardNativeGenerationFiles).toHaveBeenCalledWith(files);
});

test("finishes DB registration when cancellation occurs after native response completion", async () => {
  const controller = new AbortController();
  native.generate.mockImplementation(async () => { controller.abort(); return result; });
  await generateAndSaveImage(input, jest.fn(), controller.signal);
  expect(savePreparedGeneration).toHaveBeenCalledTimes(1);
});

test.each([401, 403, 500])("preserves HTTP %i error without resending", async (status) => {
  native.generate.mockRejectedValue(new Error(`NAI_HTTP_${status}`));
  await expect(generateAndSaveImage(input, jest.fn(), new AbortController().signal)).rejects.toMatchObject({ name: "NovelAiRequestError", status });
  expect(native.generate).toHaveBeenCalledTimes(1);
  expect(generateNovelAiImageStream).not.toHaveBeenCalled();
});

test("does not prepare a request for an already aborted signal", async () => {
  const controller = new AbortController(); controller.abort();
  await expect(generateAndSaveImage(input, jest.fn(), controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  expect(native.prepare).not.toHaveBeenCalled();
});

test("cleans up prepared files when DB registration fails", async () => {
  jest.mocked(savePreparedGeneration).mockRejectedValueOnce(new Error("database failed"));
  await expect(generateAndSaveImage(input, jest.fn(), new AbortController().signal)).rejects.toThrow("database failed");
  expect(discardNativeGenerationFiles).toHaveBeenCalledWith(files);
});
