import {
  describeNovelAiHttpError,
  extractNovelAiServerMessage,
} from "../novelai";

describe("NovelAI HTTP error messages", () => {
  it("extracts the message from a JSON error body", () => {
    expect(
      extractNovelAiServerMessage('{"statusCode":402,"message":"Not enough Anlas"}'),
    ).toBe("Not enough Anlas");
    expect(extractNovelAiServerMessage("  plain text  ")).toBe("plain text");
    expect(extractNovelAiServerMessage("   ")).toBeUndefined();
  });

  it("explains common statuses in Korean with the server detail", () => {
    expect(describeNovelAiHttpError(401, "x")).toBe(
      "NovelAI 토큰이 유효하지 않습니다. 설정에서 토큰을 확인해 주세요.",
    );
    expect(describeNovelAiHttpError(402, "Not enough Anlas")).toBe(
      "Anlas가 부족합니다.\nNot enough Anlas",
    );
    expect(describeNovelAiHttpError(429)).toContain("다른 곳에서 진행 중인 생성");
    expect(describeNovelAiHttpError(503)).toBe(
      "NovelAI 서버 오류가 발생했습니다 (HTTP 503).",
    );
    expect(describeNovelAiHttpError(400, "Invalid params")).toBe(
      "HTTP 400\nInvalid params",
    );
  });
});
