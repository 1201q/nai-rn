import { generateNovelAiImageStream } from "../novelai";

class FakeXhr {
  static current: FakeXhr;
  status = 200;
  statusText = "OK";
  responseText = "";
  onprogress: (() => void) | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  constructor() {
    FakeXhr.current = this;
  }
  open() {}
  setRequestHeader() {}
  abort() {}
  send() {}
}

const input = {
  token: "token",
  prompt: "test",
  negativePrompt: "",
  model: "nai-diffusion-4-5-full",
  width: 832,
  height: 1216,
  steps: 28,
  promptGuidance: 5,
  promptGuidanceRescale: 0,
  noiseSchedule: "karras" as const,
  sampler: "k_euler_ancestral",
  seed: 1,
};

const originalXhr = globalThis.XMLHttpRequest;
beforeEach(() => {
  globalThis.XMLHttpRequest = FakeXhr as unknown as typeof XMLHttpRequest;
});
afterEach(() => {
  globalThis.XMLHttpRequest = originalXhr;
});

test("rejects with the server message from a non-JSON error event", async () => {
  const request = generateNovelAiImageStream(input);
  const xhr = FakeXhr.current;
  xhr.responseText = "event: error\ndata: Concurrent generation is locked\n\n";
  xhr.onprogress?.();

  await expect(request).rejects.toThrow(
    "NovelAI 생성 오류: Concurrent generation is locked",
  );
});

test("still ignores non-JSON data outside error events", async () => {
  const request = generateNovelAiImageStream(input);
  const xhr = FakeXhr.current;
  xhr.responseText =
    'data: [DONE]\n\ndata: {"event_type":"final","image":"abc"}\n\n';
  xhr.onload?.();

  await expect(request).resolves.toEqual({ imageBase64: "abc", seed: 1 });
});
