import { generateNovelAiImageStream } from "../novelai";
import { startGenerationPerformance, stopGenerationPerformance } from "../generationPerformance";

const originalXhrDescriptor = Object.getOwnPropertyDescriptor(globalThis, "XMLHttpRequest");

const input = {
  token: "private-token",
  prompt: "private-prompt",
  negativePrompt: "",
  model: "nai-diffusion-4-5-full",
  width: 1024,
  height: 1024,
  steps: 28,
  promptGuidance: 5,
  promptGuidanceRescale: 0,
  noiseSchedule: "karras" as const,
  sampler: "k_euler_ancestral",
  seed: 123,
};

function createXhr() {
  const xhr = {
    open: jest.fn(),
    setRequestHeader: jest.fn(),
    send: jest.fn(),
    abort: jest.fn(),
    responseText: "",
    status: 200,
    onprogress: null as (() => void) | null,
    onload: null as (() => void) | null,
    onabort: null as (() => void) | null,
  };
  xhr.abort.mockImplementation(() => xhr.onabort?.());
  Object.defineProperty(globalThis, "XMLHttpRequest", {
    configurable: true,
    writable: true,
    value: jest.fn(() => xhr),
  });
  return xhr;
}

afterEach(() => {
  stopGenerationPerformance();
  jest.restoreAllMocks();
  if (originalXhrDescriptor) {
    Object.defineProperty(globalThis, "XMLHttpRequest", originalXhrDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, "XMLHttpRequest");
  }
});

test("preserves a chunked stream and records only sizes, counts and durations", async () => {
  const xhr = createXhr();
  startGenerationPerformance();
  const onEvent = jest.fn();
  const request = generateNovelAiImageStream(input, onEvent);
  const preview = 'data: {"event_type":"intermediate","image":"cHJldmlldw==","step_ix":1}\n\n';
  const final = 'data: {"event_type":"final","image":"ZmluYWw="}\n\n';
  xhr.responseText = preview.slice(0, 20);
  xhr.onprogress?.();
  xhr.responseText = preview;
  xhr.onprogress?.();
  xhr.responseText += final;
  xhr.onload?.();

  await expect(request).resolves.toEqual({ imageBase64: "ZmluYWw=", seed: 123 });
  expect(onEvent).toHaveBeenCalledTimes(2);
  expect(xhr.send).toHaveBeenCalledTimes(1);
  expect(JSON.parse(xhr.send.mock.calls[0][0])).toMatchObject({ parameters: { seed: 123, stream: "sse" } });
  const report = stopGenerationPerformance()!;
  expect(report.counters).toMatchObject({
    "stream.chunks": 3,
    "stream.response_chars": preview.length + final.length,
    "stream.intermediate_events": 1,
    "stream.final_events": 1,
    "stream.final_base64_chars": 8,
  });
  const json = JSON.stringify(report);
  for (const privateValue of [input.token, input.prompt, "cHJldmlldw==", "ZmluYWw="]) {
    expect(json).not.toContain(privateValue);
  }
});

test("cancels once without retransmission and records the settled request once", async () => {
  const xhr = createXhr();
  startGenerationPerformance();
  const controller = new AbortController();
  const request = generateNovelAiImageStream(input, undefined, controller.signal);
  controller.abort();
  await expect(request).rejects.toMatchObject({ name: "AbortError" });
  expect(xhr.abort).toHaveBeenCalledTimes(1);
  expect(xhr.send).toHaveBeenCalledTimes(1);
  const report = stopGenerationPerformance()!;
  const requestStats = Object.entries(report.stages).filter(([name]) => name.endsWith("/request.elapsed"));
  expect(requestStats).toHaveLength(1);
  expect(requestStats[0][1].count).toBe(1);
});
