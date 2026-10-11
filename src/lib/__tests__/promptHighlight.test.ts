import { parsePromptHighlights } from "../promptHighlight";

// 공식 웹 하이라이트 함수의 실행 결과와 같은 입력을 쓴다.
// docs/2026-10-09-novelai-official-prompt-highlighting-rules.md 12절
const high = (start: number, end: number, alpha: number) => ({
  start,
  end,
  kind: "high",
  alpha,
});
const low = (start: number, end: number, alpha: number) => ({
  start,
  end,
  kind: "low",
  alpha,
});
const mid = (start: number, end: number) => ({
  start,
  end,
  kind: "mid",
  alpha: 0.5,
});

describe("parsePromptHighlights", () => {
  it("leaves plain text alone", () => {
    expect(parsePromptHighlights("plain, text")).toEqual([]);
  });

  it("colors from the bracket that changes the weight", () => {
    expect(parsePromptHighlights("{a} b")).toEqual([high(0, 2, 0.225)]);
    expect(parsePromptHighlights("[a] b")).toEqual([low(0, 2, 0.225)]);
    expect(parsePromptHighlights("{{a}} b")).toEqual([
      high(0, 1, 0.225),
      high(1, 3, 0.25),
      high(3, 4, 0.225),
    ]);
  });

  it("keeps an unclosed bracket across commas and line breaks", () => {
    expect(parsePromptHighlights("{a,\nb")).toEqual([high(0, 5, 0.225)]);
  });

  it("overwrites the weight with a number instead of stacking", () => {
    expect(parsePromptHighlights("{a 2::b::c}d")).toEqual([
      high(0, 3, 0.225),
      high(3, 7, 0.6),
      mid(7, 9),
      low(10, 12, 0.225),
    ]);
    expect(parsePromptHighlights("2::a 3::b::c::d")).toEqual([
      high(0, 5, 0.6),
      high(5, 9, 0.6),
      mid(9, 11),
      mid(12, 14),
    ]);
  });

  it("ends a weight where the next one starts", () => {
    expect(parsePromptHighlights("2::a -2::b ::, tag")).toEqual([
      high(0, 5, 0.6),
      low(5, 11, 0.6),
      mid(11, 13),
    ]);
  });

  it("scales the opacity like the official editor", () => {
    expect(parsePromptHighlights("1.5::a")).toEqual([high(0, 6, 0.4)]);
    expect(parsePromptHighlights("0.5::a")).toEqual([low(0, 6, 0.4)]);
    expect(parsePromptHighlights("0::a")).toEqual([low(0, 4, 0.6)]);
    expect(parsePromptHighlights("-1::a")).toEqual([low(0, 5, 0.6)]);
  });

  it("marks only the symbol when the result is exactly 1", () => {
    expect(parsePromptHighlights("1::a::b")).toEqual([mid(0, 3), mid(4, 6)]);
    expect(parsePromptHighlights("a::b")).toEqual([mid(1, 3)]);
    expect(parsePromptHighlights("1.005::a::")).toEqual([mid(8, 10)]);
  });

  it("reads the number backwards from the marker", () => {
    expect(parsePromptHighlights("1.5 ::a")).toEqual([mid(4, 6)]);
    expect(parsePromptHighlights(".5::a")).toEqual([low(0, 5, 0.4)]);
    expect(parsePromptHighlights("abc123::x")).toEqual([high(3, 9, 0.6)]);
    expect(parsePromptHighlights("1e3::x")).toEqual([high(2, 6, 0.6)]);
    expect(parsePromptHighlights("+2::a")).toEqual([high(1, 5, 0.6)]);
    expect(parsePromptHighlights("-::a")).toEqual([low(0, 4, 0.6)]);
    expect(parsePromptHighlights(".::a")).toEqual([low(0, 4, 0.6)]);
  });

  it("marks bars without changing the weight", () => {
    expect(parsePromptHighlights("||2::a|0.5::b|| c")).toEqual([
      { start: 0, end: 2, kind: "bar" },
      { start: 6, end: 7, kind: "bar" },
      high(2, 7, 0.6),
      { start: 13, end: 15, kind: "bar" },
      low(7, 17, 0.4),
    ]);
    expect(
      parsePromptHighlights("|||").map((range) => [range.start, range.end]),
    ).toEqual([
      [0, 2],
      [2, 3],
    ]);
  });

  it("skips excluded ranges but carries the weight across them", () => {
    const text = "2::a, !macro:{x! b::";
    const start = text.indexOf("!macro:");
    const end = text.lastIndexOf("!") + 1;

    expect(parsePromptHighlights(text, [{ start, end }])).toEqual([
      high(0, start, 0.6),
      high(end, end + 2, 0.6),
      mid(end + 2, end + 4),
    ]);
  });
});
