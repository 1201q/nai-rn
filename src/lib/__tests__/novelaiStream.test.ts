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

test("parses events split across progress chunks", async () => {
  const events: unknown[] = [];
  const request = generateNovelAiImageStream(input, (event) =>
    events.push(event),
  );
  const xhr = FakeXhr.current;
  xhr.responseText =
    'data: {"event_type":"intermediate","image":"i1","step_ix":3,"gen_id":7}\n';
  xhr.onprogress?.();
  xhr.responseText += '\ndata: {"event_type":"final","image":"f","gen_id":7}';
  xhr.onprogress?.();
  xhr.responseText += "\n\n";
  xhr.onload?.();

  await expect(request).resolves.toEqual({ imageBase64: "f", seed: 1 });
  expect(events).toEqual([
    { type: "intermediate", imageBase64: "i1", step: 3, generationId: 7 },
    { type: "final", imageBase64: "f", generationId: 7 },
  ]);
});

test("rejects HTTP errors with the server message", async () => {
  const request = generateNovelAiImageStream(input);
  const xhr = FakeXhr.current;
  xhr.status = 402;
  xhr.responseText = '{"statusCode":402,"message":"Not enough Anlas"}';
  xhr.onload?.();

  await expect(request).rejects.toMatchObject({
    name: "NovelAiRequestError",
    status: 402,
    message: "Anlas가 부족합니다.\nNot enough Anlas",
  });
});
