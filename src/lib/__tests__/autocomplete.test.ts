import { insertTag } from "../autocomplete";

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
      cursor: "simple background".length,
    });
  });

  it("preserves preceding tags and weight syntax", () => {
    const before = "1girl, 1.2::";
    const result = insertTag(`${before}simple foreground::, smile`, before.length + 6, "simple background");
    expect(result.text).toBe(`${before}simple background::, smile`);
    expect(result.text.slice(0, result.cursor)).toBe(`${before}simple background`);
  });
});
