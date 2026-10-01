// 요청 body 전체 형태를 고정한다. novelai 모듈 분리 전후로 결과가 같아야 한다.
import {
  createImageGenerationBody,
  generateNovelAiImageStream,
} from "../novelai";

const BASE = {
  prompt: "1girl",
  negativePrompt: "lowres",
  width: 832,
  height: 1216,
  steps: 28,
  promptGuidance: 5,
  promptGuidanceRescale: 0,
  noiseSchedule: "karras" as const,
  sampler: "k_euler",
  seed: 1234,
};

test("V4.5 body with characters, Vibe and Precise references", () => {
  const { seed, body } = createImageGenerationBody({
    ...BASE,
    model: "nai-diffusion-4-5-full",
    characterPrompts: [
      {
        prompt: "girl, red hair",
        negativePrompt: "bad hands",
        position: { x: 0.3, y: 0.7 },
      },
      {
        prompt: "boy, black hair",
        negativePrompt: "",
        position: { x: 0.7, y: 0.5 },
      },
    ],
    characterPositionEnabled: true,
    varietyPlus: true,
    vibeEncodedImages: ["data:image/png;base64,VIBE"],
    vibeInformationExtracted: [0.8],
    vibeStrengths: [0.5],
    normalizeVibeStrengths: false,
    preciseReferenceImages: ["PRECISE"],
    preciseReferenceStrengths: [0.9],
    preciseReferenceFidelities: [0.25],
    preciseReferenceTypes: ["style"],
  });

  expect(seed).toBe(1234);
  expect(body).toMatchSnapshot();
});

test("ignores custom positions for a single character", () => {
  const { body } = createImageGenerationBody({
    ...BASE,
    model: "nai-diffusion-4-5-full",
    characterPrompts: [
      { prompt: "girl", negativePrompt: "", position: { x: 0.3, y: 0.7 } },
    ],
    characterPositionEnabled: true,
  });
  const parameters = body.parameters as {
    use_coords: boolean;
    v4_prompt: {
      use_coords: boolean;
      caption: { char_captions: { centers: { x: number; y: number }[] }[] };
    };
  };

  expect(parameters.use_coords).toBe(false);
  expect(parameters.v4_prompt.use_coords).toBe(false);
  expect(parameters.v4_prompt.caption.char_captions[0].centers).toEqual([
    { x: 0.5, y: 0.5 },
  ]);
});

test("fills Precise Reference defaults when per-image arrays mismatch", () => {
  const { body } = createImageGenerationBody({
    ...BASE,
    model: "nai-diffusion-4-5-full",
    preciseReferenceImages: ["A", "B"],
    preciseReferenceStrengths: [0.1],
  });

  expect(body.parameters).toMatchObject({
    director_reference_images: ["A", "B"],
    director_reference_information_extracted: [1, 1],
    director_reference_strength_values: [0.6, 0.6],
    director_reference_secondary_strength_values: [0.4, 0.4],
  });
  expect(
    (
      body.parameters as {
        director_reference_descriptions: {
          caption: { base_caption: string };
        }[];
      }
    ).director_reference_descriptions.map((d) => d.caption.base_caption),
  ).toEqual(["character&style", "character&style"]);
});

test("V3 body", () => {
  const { body } = createImageGenerationBody({
    ...BASE,
    model: "nai-diffusion-3",
    characterPrompts: [
      { prompt: "ignored", negativePrompt: "", position: { x: 0.5, y: 0.5 } },
    ],
  });

  expect(body).toMatchSnapshot();
});

test("stream request sends the body with stream: sse", () => {
  const sent: string[] = [];
  const headers: Record<string, string> = {};
  const originalXhr = globalThis.XMLHttpRequest;
  class FakeXhr {
    responseText = "";
    open() {}
    setRequestHeader(name: string, value: string) {
      headers[name] = value;
    }
    abort() {}
    send(data: string) {
      sent.push(data);
    }
  }
  globalThis.XMLHttpRequest = FakeXhr as unknown as typeof XMLHttpRequest;
  try {
    void generateNovelAiImageStream({
      ...BASE,
      token: "Bearer  abc ",
      model: "nai-diffusion-4-5-full",
    }).catch(() => {});
  } finally {
    globalThis.XMLHttpRequest = originalXhr;
  }

  const { body } = createImageGenerationBody({
    ...BASE,
    model: "nai-diffusion-4-5-full",
  });
  expect(JSON.parse(sent[0])).toEqual({
    ...body,
    parameters: { ...body.parameters, stream: "sse" },
  });
  expect(headers).toEqual({
    Authorization: "Bearer abc",
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  });
});
