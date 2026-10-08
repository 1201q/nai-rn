import {
  describePromptChunkErrors,
  expandDeletionOverPromptChunks,
  findPromptChunkReferences,
  getPromptChunkTrigger,
  inlinePromptChunkReferences,
  moveWithinGroup,
  parsePromptChunkDocument,
  renamePromptChunkReferences,
  resolvePromptChunks,
  searchPromptChunks,
  snapCaretToPromptChunk,
  validatePromptChunk,
  type PromptChunk,
} from "../promptChunks";

function chunk(name: string, content: string, id = name): PromptChunk {
  return { id, name, content, color: "#6B7280", categoryId: null };
}

describe("resolvePromptChunks", () => {
  it("returns text without references unchanged", () => {
    expect(resolvePromptChunks("1girl, {smile}", [])).toEqual({
      text: "1girl, {smile}",
      missing: [],
      circular: [],
    });
  });

  it("expands direct, repeated and nested references", () => {
    const chunks = [
      chunk("Hair", "long hair, !macro:Color!"),
      chunk("Color", "red"),
    ];
    expect(
      resolvePromptChunks("!macro:Hair!, !macro:Color! eyes", chunks).text,
    ).toBe("long hair, red, red eyes");
  });

  it("allows the same chunk on separate branches", () => {
    const chunks = [
      chunk("A", "!macro:C!"),
      chunk("B", "!macro:C!"),
      chunk("C", "x"),
    ];
    expect(resolvePromptChunks("!macro:A!|!macro:B!", chunks)).toEqual({
      text: "x|x",
      missing: [],
      circular: [],
    });
  });

  it("reports missing names and is case-sensitive", () => {
    const result = resolvePromptChunks("a, !macro:style!, b", [
      chunk("Style", "x"),
    ]);
    expect(result).toEqual({
      text: "a, , b",
      missing: ["style"],
      circular: [],
    });
    expect(describePromptChunkErrors(result)).toBe("없는 chunk: style");
  });

  it("trims the referenced name", () => {
    expect(
      resolvePromptChunks("!macro: Style !", [chunk("Style", "x")]),
    ).toEqual({ text: "x", missing: [], circular: [] });
  });

  it("reports direct and indirect cycles", () => {
    expect(
      resolvePromptChunks("!macro:A!", [chunk("A", "a !macro:A!")]).circular,
    ).toEqual(["A"]);
    expect(
      resolvePromptChunks("!macro:A!", [
        chunk("A", "!macro:B!"),
        chunk("B", "!macro:A!"),
      ]).circular,
    ).toEqual(["A"]);
  });

  it("keeps other prompt syntax and incomplete markers", () => {
    const chunks = [chunk("R", "||a|b||, 1.5::x::, c|d\nline")];
    expect(resolvePromptChunks("{!macro:R!} !macro:R", chunks).text).toBe(
      "{||a|b||, 1.5::x::, c|d\nline} !macro:R",
    );
  });
});

describe("reference rewriting", () => {
  it("inlines only the given chunks one level", () => {
    expect(
      inlinePromptChunkReferences("!macro:A!, !macro:B!", [
        chunk("A", "x, !macro:B!"),
      ]),
    ).toBe("x, !macro:B!, !macro:B!");
  });

  it("renames exact references only", () => {
    expect(
      renamePromptChunkReferences(
        "!macro:Style!, !macro:Style 2!, Style",
        "Style",
        "Look",
      ),
    ).toBe("!macro:Look!, !macro:Style 2!, Style");
  });
});

describe("validatePromptChunk", () => {
  const chunks = [chunk("A", "!macro:B!", "1"), chunk("B", "x", "2")];
  const input = { name: "C", content: "y", color: "#6B7280" };

  it("accepts a valid chunk and an unchanged edit", () => {
    expect(validatePromptChunk(input, chunks)).toBeNull();
    expect(
      validatePromptChunk({ ...input, id: "2", name: "B" }, chunks),
    ).toBeNull();
  });

  it("rejects empty fields, !, bad colors and duplicate names", () => {
    expect(validatePromptChunk({ ...input, name: " " }, chunks)).not.toBeNull();
    expect(
      validatePromptChunk({ ...input, content: " " }, chunks),
    ).not.toBeNull();
    expect(
      validatePromptChunk({ ...input, name: "a!b" }, chunks),
    ).not.toBeNull();
    expect(
      validatePromptChunk({ ...input, color: "red" }, chunks),
    ).not.toBeNull();
    expect(validatePromptChunk({ ...input, name: "A" }, chunks)).not.toBeNull();
  });

  it("rejects content that creates a cycle", () => {
    expect(
      validatePromptChunk(
        { id: "2", name: "B", content: "!macro:A!", color: "#6B7280" },
        chunks,
      ),
    ).toContain("순환");
  });
});

describe("moveWithinGroup", () => {
  const items = [
    { id: "a", group: 1 },
    { id: "x", group: 2 },
    { id: "b", group: 1 },
  ];
  const sameGroup = (a: { group: number }, b: { group: number }) =>
    a.group === b.group;

  it("swaps with the next item of the same group", () => {
    expect(
      moveWithinGroup(items, "a", 1, sameGroup).map((item) => item.id),
    ).toEqual(["b", "x", "a"]);
  });

  it("does nothing at the edge", () => {
    expect(
      moveWithinGroup(items, "a", -1, sameGroup).map((item) => item.id),
    ).toEqual(["a", "x", "b"]);
  });
});

describe("parsePromptChunkDocument", () => {
  it("falls back to an empty document", () => {
    expect(parsePromptChunkDocument(undefined).chunks).toEqual([]);
    expect(parsePromptChunkDocument("{").chunks).toEqual([]);
    expect(parsePromptChunkDocument('{"version":2}').chunks).toEqual([]);
  });

  it("reads a stored document", () => {
    const doc = { version: 1, chunks: [chunk("A", "x")], categories: [] };
    expect(parsePromptChunkDocument(JSON.stringify(doc))).toEqual(doc);
  });
});

describe("getPromptChunkTrigger", () => {
  it("opens at the start, after whitespace and after a comma", () => {
    expect(getPromptChunkTrigger("@", 1)).toEqual({ start: 0, query: "" });
    expect(getPromptChunkTrigger("1girl, @sty", 11)).toEqual({
      start: 7,
      query: "sty",
    });
    expect(getPromptChunkTrigger("a,@배경 없", 7)).toEqual({
      start: 2,
      query: "배경 없",
    });
  });

  it("uses only the text before the caret", () => {
    expect(getPromptChunkTrigger("@style, smile", 3)).toEqual({
      start: 0,
      query: "st",
    });
  });

  it("stays closed inside a word, after a comma in the query or a line break", () => {
    expect(getPromptChunkTrigger("user@host", 9)).toBeNull();
    expect(getPromptChunkTrigger("{@sty", 5)).toBeNull();
    expect(getPromptChunkTrigger("@sty, sm", 8)).toBeNull();
    expect(getPromptChunkTrigger("@sty\nsm", 7)).toBeNull();
    expect(getPromptChunkTrigger("1girl", 5)).toBeNull();
  });
});

describe("searchPromptChunks", () => {
  const categories = [
    { id: "cat", name: "Scene", color: "#6B7280", collapsed: false },
  ];
  const chunks: PromptChunk[] = [
    { ...chunk("Night sky", "stars"), categoryId: "cat" },
    chunk("Sky", "blue sky"),
    chunk("Dusky", "x"),
    chunk("Soaky", "x"),
    chunk("Moon", "sky at night"),
  ];
  const search = (query: string) =>
    searchPromptChunks(chunks, categories, query).map((item) => item.name);

  it("returns everything for an empty query", () => {
    expect(search("")).toHaveLength(chunks.length);
  });

  it("ranks prefix, substring, subsequence, then content", () => {
    expect(search("sky")).toEqual([
      "Sky",
      "Night sky",
      "Dusky",
      "Soaky",
      "Moon",
    ]);
  });

  it("matches the category-qualified name", () => {
    expect(search("scene: n")).toEqual(["Night sky"]);
  });
});

describe("chip-like editing helpers", () => {
  // "a, !macro:Style!, b": 참조는 [3, 16), 보이는 이름은 [10, 15)
  const text = "a, !macro:Style!, b";
  const chunks = [chunk("Style", "x")];
  const references = findPromptChunkReferences(text, chunks);

  it("finds only references to stored chunks", () => {
    expect(references).toEqual([{ start: 3, end: 16, name: "Style" }]);
    expect(findPromptChunkReferences("!macro:Gone!", chunks)).toEqual([]);
    expect(findPromptChunkReferences("plain", chunks)).toEqual([]);
  });

  it("leaves a caret outside or on the edge alone", () => {
    expect(snapCaretToPromptChunk(references, 3, 0)).toBe(3);
    expect(snapCaretToPromptChunk(references, 16, 0)).toBe(16);
    expect(snapCaretToPromptChunk(references, 1, 0)).toBe(1);
  });

  it("steps over the reference when moving one character into it", () => {
    expect(snapCaretToPromptChunk(references, 4, 3)).toBe(16);
    expect(snapCaretToPromptChunk(references, 15, 16)).toBe(3);
  });

  it("snaps a tap to the nearer side of the visible name", () => {
    expect(snapCaretToPromptChunk(references, 11, 0)).toBe(3);
    expect(snapCaretToPromptChunk(references, 14, 0)).toBe(16);
  });

  it("widens a partial deletion to the whole reference", () => {
    expect(expandDeletionOverPromptChunks(text, 15, 16, references)).toEqual({
      text: "a, , b",
      caret: 3,
    });
    expect(expandDeletionOverPromptChunks(text, 1, 5, references)).toEqual({
      text: "a, b",
      caret: 1,
    });
  });

  it("does not touch deletions outside or covering the reference", () => {
    expect(expandDeletionOverPromptChunks(text, 0, 1, references)).toBeNull();
    expect(expandDeletionOverPromptChunks(text, 3, 16, references)).toBeNull();
    expect(expandDeletionOverPromptChunks(text, 16, 17, references)).toBeNull();
  });
});
