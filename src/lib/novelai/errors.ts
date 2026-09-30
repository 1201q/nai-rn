export class NovelAiRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "NovelAiRequestError";
  }
}

// 서버 오류 본문({"statusCode", "message"}) 또는 일반 텍스트에서 메시지를 꺼낸다.
export function extractNovelAiServerMessage(text: string): string | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object") {
      const message = (parsed as { message?: unknown }).message;
      if (typeof message === "string" && message.trim()) return message.trim();
    }
  } catch {
    // JSON이 아니면 본문을 그대로 사용한다.
  }
  return trimmed.slice(0, 500);
}

export function describeNovelAiHttpError(
  status: number,
  serverMessage?: string,
): string {
  const detail = serverMessage ? `\n${serverMessage}` : "";
  if (status === 401 || status === 403) {
    return "NovelAI 토큰이 유효하지 않습니다. 설정에서 토큰을 확인해 주세요.";
  }
  if (status === 402) return `Anlas가 부족합니다.${detail}`;
  if (status === 429) {
    return `다른 곳에서 진행 중인 생성이 있어 요청이 거절되었습니다. 잠시 후 다시 시도해 주세요.${detail}`;
  }
  if (status >= 500) {
    return `NovelAI 서버 오류가 발생했습니다 (HTTP ${status}).${detail}`;
  }
  return `HTTP ${status}${detail}`;
}

export function createNovelAiRequestError(
  status: number,
  fallbackMessage: string,
) {
  return new NovelAiRequestError(
    status,
    status === 401 || status === 403
      ? "NovelAI 토큰이 유효하지 않습니다. 설정에서 토큰을 확인해 주세요."
      : fallbackMessage,
  );
}
