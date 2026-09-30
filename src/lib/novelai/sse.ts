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

// NovelAI 스트림은 LF만 사용(실측 확인). regex 대신 indexOf로 경계 탐색하고,
// scanOffset으로 이전 청크까지 스캔한 위치를 기억해 매 청크 전체 재스캔(O(n²))을 막는다.
export function parseSseEvents(
  buffer: string,
  scanOffset: number,
  onEvent: (eventName: string, data: unknown) => void,
): { rest: string; scanOffset: number } {
  let nextBuffer = buffer;
  let from = scanOffset;
  let separatorIndex = nextBuffer.indexOf("\n\n", from);

  while (separatorIndex !== -1) {
    const rawEvent = nextBuffer.slice(0, separatorIndex);
    nextBuffer = nextBuffer.slice(separatorIndex + 2);
    from = 0;

    const lines = rawEvent.split("\n");
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

    separatorIndex = nextBuffer.indexOf("\n\n", from);
  }

  // 경계 "\n\n"가 청크 사이에 걸칠 수 있어 1글자 겹쳐 다음 스캔 시작점을 잡는다.
  return { rest: nextBuffer, scanOffset: Math.max(0, nextBuffer.length - 1) };
}

export function getStreamErrorMessage(data: unknown): string {
  if (typeof data === "string") {
    return data;
  }

  if (data && typeof data === "object") {
    const event = data as NovelAiImageStreamRawEvent;
    return event.message ?? event.error ?? JSON.stringify(data);
  }

  return "NovelAI image stream failed.";
}

export function toNovelAiImageStreamEvent(
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
