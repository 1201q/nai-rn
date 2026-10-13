import { Asset } from "expo-asset";
import { File } from "expo-file-system";
import { NovelAiClipTokenizer, NovelAiT5Tokenizer } from "../tokenizers";

jest.mock("expo-asset", () => ({ Asset: { fromModule: jest.fn() } }));
jest.mock("expo-file-system", () => ({ File: jest.fn() }));
jest.mock("../../../../assets/tokenizers/clip_tokenizer.def", () => 1);
jest.mock("../../../../assets/tokenizers/t5_tokenizer.def", () => 2);
jest.mock("../tokenizers", () => ({
  NovelAiClipTokenizer: jest.fn(),
  NovelAiT5Tokenizer: { create: jest.fn() },
}));

function loadModule(): typeof import("../loader") {
  let loaded!: typeof import("../loader");
  jest.isolateModules(() => {
    loaded = require("../loader");
  });
  return loaded;
}

beforeEach(() => {
  jest.resetAllMocks();
});

test.each(["download", "read", "parse"])(
  "retries CLIP after a temporary %s failure",
  async (failure) => {
    const download = jest.fn().mockResolvedValue(undefined);
    const read = jest
      .fn()
      .mockResolvedValue(JSON.stringify({ text: "definition" }));
    if (failure === "download")
      download.mockRejectedValueOnce(new Error("download failed"));
    else if (failure === "read")
      read.mockRejectedValueOnce(new Error("read failed"));
    else read.mockResolvedValueOnce("invalid json");
    jest.mocked(Asset.fromModule).mockReturnValue({
      localUri: "file:///definition",
      downloadAsync: download,
    } as unknown as Asset);
    jest
      .mocked(File)
      .mockImplementation(() => ({ text: read }) as unknown as File);
    const tokenizer = { countTokens: () => 1 };
    jest
      .mocked(NovelAiClipTokenizer)
      .mockReturnValue(tokenizer as unknown as NovelAiClipTokenizer);
    const { getPromptTokenizer } = loadModule();
    const first = getPromptTokenizer("clip");
    expect(getPromptTokenizer("clip")).toBe(first);
    await expect(first).rejects.toThrow();
    const retry = getPromptTokenizer("clip");
    expect(retry).not.toBe(first);
    await expect(retry).resolves.toBe(tokenizer);
    expect(getPromptTokenizer("clip")).toBe(retry);
    expect(download).toHaveBeenCalledTimes(2);
  },
);

test("retries an asynchronous tokenizer creation failure", async () => {
  jest.mocked(Asset.fromModule).mockReturnValue({
    localUri: "file:///definition",
    downloadAsync: jest.fn().mockResolvedValue(undefined),
  } as unknown as Asset);
  jest
    .mocked(File)
    .mockImplementation(() => ({ text: async () => "{}" }) as unknown as File);
  const tokenizer = { countTokens: () => 1 } as unknown as NovelAiT5Tokenizer;
  jest
    .mocked(NovelAiT5Tokenizer.create)
    .mockRejectedValueOnce(new Error("initialization failed"))
    .mockResolvedValueOnce(tokenizer);
  const { getPromptTokenizer } = loadModule();
  await expect(getPromptTokenizer("t5")).rejects.toThrow(
    "initialization failed",
  );
  await expect(getPromptTokenizer("t5")).resolves.toBe(tokenizer);
  expect(NovelAiT5Tokenizer.create).toHaveBeenCalledTimes(2);
});
