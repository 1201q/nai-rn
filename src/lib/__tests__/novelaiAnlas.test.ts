import {
  getNovelAiAnlasBalance,
  NovelAiRequestError,
} from "../novelai";

describe("getNovelAiAnlasBalance", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("reads balance, tier and expiry from the subscription response", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        tier: 3,
        expiresAt: 1_800_000_000,
        trainingStepsLeft: {
          fixedTrainingStepsLeft: 10,
          purchasedTrainingSteps: 5,
        },
      }),
    } as Response);

    await expect(getNovelAiAnlasBalance("token")).resolves.toEqual({
      fixed: 10,
      purchased: 5,
      total: 15,
      tier: 3,
      expiresAt: 1_800_000_000,
    });
  });

  test.each([401, 403])(
    "preserves HTTP %s as an authentication error",
    async (status) => {
      jest.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: false,
        status,
        statusText: "Unauthorized",
      } as Response);

      const request = getNovelAiAnlasBalance("token");

      await expect(request).rejects.toEqual(
        expect.objectContaining<Partial<NovelAiRequestError>>({
          name: "NovelAiRequestError",
          status,
          message:
            "NovelAI 토큰이 유효하지 않습니다. 설정에서 토큰을 확인해 주세요.",
        }),
      );
    },
  );
});
