import {
  clearPromptInsertTarget,
  rememberPromptInsertTarget,
} from "../../lib/promptInsertTarget";
import { storage } from "../../lib/storage";
import { useGenerationStore } from "../generationStore";
import {
  deleteAllPromptChunks,
  deletePromptChunk,
  deletePromptChunkCategory,
  insertPromptChunkReference,
  movePromptChunk,
  savePromptChunk,
  savePromptChunkCategory,
  togglePromptChunkCategory,
} from "../promptChunkActions";
import { usePromptChunkStore } from "../promptChunkStore";

jest.mock("../../lib/storage", () => ({
  storage: {
    getString: jest.fn(() => undefined),
    set: jest.fn(),
  },
}));

jest.mock("../generationStore", () => {
  const { create } = jest.requireActual("zustand");
  return {
    useGenerationStore: create(() => ({
      prompt: "",
      negativePrompt: "",
      characterPrompts: [],
    })),
  };
});

const color = "#6B7280";

function add(name: string, content: string, categoryId: string | null = null) {
  expect(savePromptChunk({ name, content, color, categoryId })).toBeNull();
  return usePromptChunkStore
    .getState()
    .chunks.find((chunk) => chunk.name === name.trim())!;
}

function names() {
  return usePromptChunkStore.getState().chunks.map((chunk) => chunk.name);
}

beforeEach(() => {
  usePromptChunkStore.setState({ chunks: [], categories: [] });
  useGenerationStore.setState({
    prompt: "",
    negativePrompt: "",
    characterPrompts: [],
  });
  jest.mocked(storage.set).mockClear();
  clearPromptInsertTarget();
});

it("trims, stores and persists a new chunk", () => {
  const chunk = add(" Style ", " oil painting, ");
  expect(chunk).toMatchObject({
    name: "Style",
    content: "oil painting,",
    categoryId: null,
  });
  expect(
    JSON.parse(jest.mocked(storage.set).mock.calls[0][1] as string),
  ).toEqual({
    version: 1,
    chunks: [chunk],
    categories: [],
  });
});

it("returns the validation error without saving", () => {
  add("Style", "x");
  expect(
    savePromptChunk({ name: "Style", content: "y", color, categoryId: null }),
  ).not.toBeNull();
  expect(names()).toEqual(["Style"]);
});

it("renames references in prompts and other chunks", () => {
  const style = add("Style", "x");
  add("Scene", "!macro:Style!, night");
  useGenerationStore.setState({
    prompt: "1girl, !macro:Style!",
    negativePrompt: "!macro:Style!",
    characterPrompts: [
      {
        id: "c1",
        prompt: "!macro:Style!",
        negativePrompt: "!macro:Scene!",
        enabled: true,
        position: { x: 0.5, y: 0.5 },
      },
    ],
  });

  expect(
    savePromptChunk({
      id: style.id,
      name: "Look",
      content: "x",
      color,
      categoryId: null,
    }),
  ).toBeNull();

  const generation = useGenerationStore.getState();
  expect(generation.prompt).toBe("1girl, !macro:Look!");
  expect(generation.negativePrompt).toBe("!macro:Look!");
  expect(generation.characterPrompts[0]).toMatchObject({
    prompt: "!macro:Look!",
    negativePrompt: "!macro:Scene!",
  });
  expect(
    usePromptChunkStore.getState().chunks.find((c) => c.name === "Scene")
      ?.content,
  ).toBe("!macro:Look!, night");
});

it("moves an edited chunk to the end of its new category", () => {
  expect(savePromptChunkCategory({ name: "Cat", color })).toBeNull();
  const categoryId = usePromptChunkStore.getState().categories[0].id;
  const a = add("A", "a");
  add("B", "b", categoryId);
  savePromptChunk({ id: a.id, name: "A", content: "a", color, categoryId });
  expect(names()).toEqual(["B", "A"]);
  expect(usePromptChunkStore.getState().chunks[1].categoryId).toBe(categoryId);
});

it("inlines references before deleting a chunk", () => {
  const style = add("Style", "oil, !macro:Tone!");
  add("Tone", "warm");
  add("Scene", "!macro:Style!, night");
  useGenerationStore.setState({ prompt: "1girl, !macro:Style!" });

  deletePromptChunk(style.id);

  expect(names()).toEqual(["Tone", "Scene"]);
  expect(useGenerationStore.getState().prompt).toBe("1girl, oil, !macro:Tone!");
  expect(usePromptChunkStore.getState().chunks[1].content).toBe(
    "oil, !macro:Tone!, night",
  );
});

it("reorders only within the same category", () => {
  savePromptChunkCategory({ name: "Cat", color });
  const categoryId = usePromptChunkStore.getState().categories[0].id;
  const a = add("A", "a");
  add("X", "x", categoryId);
  add("B", "b");
  movePromptChunk(a.id, 1);
  expect(names()).toEqual(["B", "X", "A"]);
});

it("keeps chunks when their category is deleted", () => {
  savePromptChunkCategory({ name: "Cat", color });
  const categoryId = usePromptChunkStore.getState().categories[0].id;
  add("X", "x", categoryId);
  add("A", "a");
  togglePromptChunkCategory(categoryId);
  expect(usePromptChunkStore.getState().categories[0].collapsed).toBe(true);

  deletePromptChunkCategory(categoryId);

  expect(usePromptChunkStore.getState().categories).toEqual([]);
  expect(names()).toEqual(["A", "X"]);
  expect(usePromptChunkStore.getState().chunks[1].categoryId).toBeNull();
});

it("fully expands prompts before deleting everything", () => {
  add("Tone", "warm");
  add("Style", "oil, !macro:Tone!");
  useGenerationStore.setState({ prompt: "!macro:Style!, !macro:Gone!" });

  deleteAllPromptChunks();

  expect(useGenerationStore.getState().prompt).toBe("oil, warm, !macro:Gone!");
  expect(usePromptChunkStore.getState()).toMatchObject({
    chunks: [],
    categories: [],
  });
});

describe("insertPromptChunkReference", () => {
  it("does nothing until a prompt field was focused", () => {
    useGenerationStore.setState({ prompt: "1girl" });
    expect(insertPromptChunkReference("Style")).toBe(false);
    expect(useGenerationStore.getState().prompt).toBe("1girl");
  });

  it("inserts at the remembered caret and continues after it", () => {
    useGenerationStore.setState({ prompt: "1girl, smile" });
    rememberPromptInsertTarget({ scope: "base", channel: "positive" }, 7);

    expect(insertPromptChunkReference("A")).toBe(true);
    expect(insertPromptChunkReference("B")).toBe(true);

    expect(useGenerationStore.getState().prompt).toBe(
      "1girl, !macro:A!!macro:B!smile",
    );
  });

  it("clamps a stale caret to the end of the text", () => {
    useGenerationStore.setState({ negativePrompt: "bad" });
    rememberPromptInsertTarget({ scope: "base", channel: "negative" }, 99);

    insertPromptChunkReference("A");

    expect(useGenerationStore.getState().negativePrompt).toBe("bad!macro:A!");
  });

  it("targets a character field and fails once the character is gone", () => {
    const character = {
      id: "c1",
      prompt: "girl",
      negativePrompt: "",
      enabled: true,
      position: { x: 0.5, y: 0.5 },
    };
    useGenerationStore.setState({ characterPrompts: [character] });
    rememberPromptInsertTarget(
      { scope: "character", characterId: "c1", channel: "negative" },
      0,
    );

    expect(insertPromptChunkReference("A")).toBe(true);
    expect(
      useGenerationStore.getState().characterPrompts[0].negativePrompt,
    ).toBe("!macro:A!");

    useGenerationStore.setState({ characterPrompts: [] });
    expect(insertPromptChunkReference("A")).toBe(false);
  });
});
