jest.mock("@expensify/react-native-live-markdown", () => ({
  MarkdownTextInput: () => null,
}));
jest.mock("@gorhom/bottom-sheet", () => ({
  useBottomSheetInternal: () => null,
}));

jest.mock("../../../lib/storage", () => ({
  storage: { getString: jest.fn(() => undefined), set: jest.fn() },
}));

import {
  createPromptMarkdownParser,
  promptMarkdownParser,
} from "../PromptHighlightTextInput";

describe("promptMarkdownParser", () => {
  it("uses the effective weight to vary the background opacity", () => {
    expect(promptMarkdownParser("0.9::tag::")[0]).toEqual({
      type: "mention-here",
      start: 0,
      length: 8,
      backgroundColor: { red: 4, green: 102, blue: 206, alpha: 0.25 },
    });
  });

  it("uses red for strengthened text and leaves neutral text unstyled", () => {
    expect(promptMarkdownParser("1.5::tag:: plain")).toEqual([
      {
        type: "mention-user",
        start: 0,
        length: 8,
        backgroundColor: { red: 184, green: 55, blue: 0, alpha: 0.4 },
      },
      {
        type: "mention-report",
        start: 8,
        length: 2,
        backgroundColor: { red: 0, green: 151, blue: 7, alpha: 0.5 },
      },
    ]);
  });

  it("puts bar colors after the emphasis they sit in", () => {
    expect(promptMarkdownParser("2::a|b").map((range) => range.type)).toEqual([
      "mention-user",
      "syntax",
    ]);
  });

  it("styles randomizer markers without using the underlined link type", () => {
    expect(promptMarkdownParser("||a|b||")).toEqual([
      {
        type: "syntax",
        start: 0,
        length: 2,
        foregroundColor: { red: 245, green: 243, blue: 194, alpha: 1 },
        fontFamily: "Pretendard-Medium",
      },
      {
        type: "syntax",
        start: 3,
        length: 1,
        foregroundColor: { red: 245, green: 243, blue: 194, alpha: 1 },
        fontFamily: "Pretendard-Medium",
      },
      {
        type: "syntax",
        start: 5,
        length: 2,
        foregroundColor: { red: 245, green: 243, blue: 194, alpha: 1 },
        fontFamily: "Pretendard-Medium",
      },
    ]);
  });

  it("uses the same style for a standalone separator", () => {
    expect(promptMarkdownParser("a|b")).toEqual([
      {
        type: "syntax",
        start: 1,
        length: 1,
        foregroundColor: { red: 245, green: 243, blue: 194, alpha: 1 },
        fontFamily: "Pretendard-Medium",
      },
    ]);
  });
});

describe("prompt chunk references", () => {
  const color = { red: 239, green: 68, blue: 68, alpha: 0.3 };
  const parser = createPromptMarkdownParser({ Style: color });

  it("draws a stored chunk as a chip and hides the syntax around its name", () => {
    expect(parser("a, !macro:Style!")).toEqual([
      {
        type: "mention-user",
        start: 3,
        length: 13,
        backgroundColor: color,
        atomic: true,
        borderColor: { ...color, alpha: 1 },
        borderRadius: 5,
        verticalOutset: 2,
      },
      {
        type: "syntax",
        start: 3,
        length: 7,
        spacer: 5,
      },
      {
        type: "syntax",
        start: 15,
        length: 1,
        spacer: 5,
      },
    ]);
  });

  it("keeps emphasis off the chip and ignores syntax in its name", () => {
    const named = createPromptMarkdownParser({ "a{b": color });

    expect(
      named("2::x !macro:a{b! y").filter((range) => range.type !== "syntax"),
    ).toEqual([
      {
        type: "mention-user",
        start: 0,
        length: 5,
        backgroundColor: { red: 184, green: 55, blue: 0, alpha: 0.6 },
      },
      {
        type: "mention-user",
        start: 16,
        length: 2,
        backgroundColor: { red: 184, green: 55, blue: 0, alpha: 0.6 },
      },
      {
        type: "mention-user",
        start: 5,
        length: 11,
        backgroundColor: color,
        atomic: true,
        borderColor: { ...color, alpha: 1 },
        borderRadius: 5,
        verticalOutset: 2,
      },
    ]);
  });

  it("marks an unknown chunk without hiding its text", () => {
    expect(parser("!macro:Gone!")).toEqual([
      {
        type: "mention-user",
        start: 0,
        length: 12,
        backgroundColor: { red: 239, green: 110, blue: 110, alpha: 0.3 },
        borderRadius: 5,
      },
    ]);
  });
});
