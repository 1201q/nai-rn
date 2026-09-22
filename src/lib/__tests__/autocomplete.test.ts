import { getAutocompleteEdit, getCurrentWord, insertTag, parseQuery } from "../autocomplete";

describe("insertTag", () => {
  it.each([
    ["simple", 6, "simple background, "],
    ["simple, smile", 6, "simple background, smile"],
    ["simple foreground, smile", 6, "simple background, smile"],
    ["simple\nsmile", 6, "simple background\nsmile"],
    ["simple::, smile", 6, "simple background::, smile"],
    ["simple|smile", 6, "simple background|smile"],
    ["simple]", 6, "simple background]"],
  ])("completes %j without leaving a suffix or duplicating a delimiter", (text, caret, expected) => {
    expect(insertTag(text, caret, "simple background")).toEqual({
      text: expected,
      cursor: text === "simple" ? "simple background, ".length : "simple background".length,
    });
  });

  it("preserves preceding tags and weight syntax", () => {
    const before = "1girl, 1.2::";
    const result = insertTag(`${before}simple foreground::, smile`, before.length + 6, "simple background");
    expect(result.text).toBe(`${before}simple background::, smile`);
    expect(result.text.slice(0, result.cursor)).toBe(`${before}simple background`);
  });

  it.each([
    ["{blue eyes}", 5, "{blue hair}"],
    ["[blue eyes]", 5, "[blue hair]"],
    ["||red|blue eyes||", 10, "||red|blue hair||"],
    ["red|blue eyes", 8, "red|blue hair, "],
    ["-1::blue eyes::", 8, "-1::blue hair::"],
    ["1.5::{blue eyes}::", 10, "1.5::{blue hair}::"],
    ["blue-1::sky::", 4, "blue hair, -1::sky::"],
  ])("preserves syntax in %j", (text, caret, expected) => {
    expect(insertTag(text, caret, "blue hair").text).toBe(expected);
  });

  it.each(["depth of field, smile", "-1::sky::", "1.5::sky::", ".5::sky::", "{sky}", "[sky]", "1.5::sky, -1::clouds::::"])(
    "preserves the whole existing suffix %j when given an insertion range", (suffix) => {
      expect(insertTag(`gir${suffix}`, 3, "1girl", { start: 0, end: 3 })).toEqual({
        text: `1girl, ${suffix}`, cursor: 7,
      });
    },
  );

  it("finds namespaces inside brackets and ignores the interior of weight markers", () => {
    expect(parseQuery(getCurrentWord("{artist:wl}", 10).word)).toEqual({ type: "artist", query: "wl" });
    expect(getCurrentWord("-1.5::sky::", 3).word).toBe("");
  });

  it("uses the selection to disambiguate insertion before repeated characters", () => {
    expect(getAutocompleteEdit("girl", "ggirl", { start: 0, end: 0 })).toEqual({
      start: 0, previousEnd: 0, end: 1,
    });
  });
});
