import {
  inlinePromptChunkReferences,
  moveWithinGroup,
  renamePromptChunkReferences,
  validatePromptChunk,
  validatePromptChunkCategory,
} from "../lib/promptChunks";
import {
  getPromptInsertTarget,
  rememberPromptInsertTarget,
} from "../lib/promptInsertTarget";
import { useGenerationStore } from "./generationStore";
import { usePromptChunkStore } from "./promptChunkStore";

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// 현재 편집 중인 모든 프롬프트 필드에 같은 변환을 적용한다.
function rewriteGenerationPrompts(rewrite: (text: string) => string) {
  useGenerationStore.setState((state) => ({
    prompt: rewrite(state.prompt),
    negativePrompt: rewrite(state.negativePrompt),
    characterPrompts: state.characterPrompts.map((item) => ({
      ...item,
      prompt: rewrite(item.prompt),
      negativePrompt: rewrite(item.negativePrompt),
    })),
  }));
}

// 실패하면 오류 문구를, 성공하면 null을 돌려준다.
export function savePromptChunk(input: {
  id?: string;
  name: string;
  content: string;
  color: string;
  categoryId: string | null;
}): string | null {
  const { chunks } = usePromptChunkStore.getState();
  const error = validatePromptChunk(input, chunks);
  if (error) return error;

  const name = input.name.trim();
  const content = input.content.trim();
  const previous = chunks.find((chunk) => chunk.id === input.id);
  if (!previous) {
    usePromptChunkStore.setState({
      chunks: [
        ...chunks,
        {
          id: createId("chunk"),
          name,
          content,
          color: input.color,
          categoryId: input.categoryId,
        },
      ],
    });
    return null;
  }

  const renamed = previous.name !== name;
  const rename = (text: string) =>
    renamed ? renamePromptChunkReferences(text, previous.name, name) : text;
  const updated = { ...previous, name, content, color: input.color };
  const next = chunks.map((chunk) =>
    chunk.id === previous.id
      ? updated
      : { ...chunk, content: rename(chunk.content) },
  );
  usePromptChunkStore.setState({
    // category가 바뀌면 새 category의 끝으로 보낸다.
    chunks:
      previous.categoryId === input.categoryId
        ? next
        : [
            ...next.filter((chunk) => chunk.id !== previous.id),
            { ...updated, categoryId: input.categoryId },
          ],
  });
  if (renamed) rewriteGenerationPrompts(rename);
  return null;
}

// 참조를 내용으로 펼친 뒤 지운다. 프롬프트와 다른 chunk 내용 모두 대상이다.
export function deletePromptChunk(id: string) {
  const { chunks } = usePromptChunkStore.getState();
  const target = chunks.find((chunk) => chunk.id === id);
  if (!target) return;
  const inline = (text: string) => inlinePromptChunkReferences(text, [target]);
  usePromptChunkStore.setState({
    chunks: chunks
      .filter((chunk) => chunk.id !== id)
      .map((chunk) => ({ ...chunk, content: inline(chunk.content) })),
  });
  rewriteGenerationPrompts(inline);
}

export function movePromptChunk(id: string, direction: -1 | 1) {
  usePromptChunkStore.setState(({ chunks }) => ({
    chunks: moveWithinGroup(
      chunks,
      id,
      direction,
      (a, b) => a.categoryId === b.categoryId,
    ),
  }));
}

export function savePromptChunkCategory(input: {
  id?: string;
  name: string;
  color: string;
}): string | null {
  const error = validatePromptChunkCategory(input);
  if (error) return error;
  const name = input.name.trim();
  usePromptChunkStore.setState(({ categories }) => ({
    categories: categories.some((category) => category.id === input.id)
      ? categories.map((category) =>
          category.id === input.id
            ? { ...category, name, color: input.color }
            : category,
        )
      : [
          ...categories,
          {
            id: createId("category"),
            name,
            color: input.color,
            collapsed: false,
          },
        ],
  }));
  return null;
}

// chunk는 지우지 않고 미분류의 끝으로 옮긴다.
export function deletePromptChunkCategory(id: string) {
  usePromptChunkStore.setState(({ chunks, categories }) => ({
    categories: categories.filter((category) => category.id !== id),
    chunks: [
      ...chunks.filter((chunk) => chunk.categoryId !== id),
      ...chunks
        .filter((chunk) => chunk.categoryId === id)
        .map((chunk) => ({ ...chunk, categoryId: null })),
    ],
  }));
}

export function movePromptChunkCategory(id: string, direction: -1 | 1) {
  usePromptChunkStore.setState(({ categories }) => ({
    categories: moveWithinGroup(categories, id, direction, () => true),
  }));
}

export function togglePromptChunkCategory(id: string) {
  usePromptChunkStore.setState(({ categories }) => ({
    categories: categories.map((category) =>
      category.id === id
        ? { ...category, collapsed: !category.collapsed }
        : category,
    ),
  }));
}

// 프롬프트의 참조를 끝까지 펼친 뒤 전부 지운다. 못 펼치는 참조는 그대로 남는다.
export function deleteAllPromptChunks() {
  const { chunks } = usePromptChunkStore.getState();
  rewriteGenerationPrompts((text) => {
    let current = text;
    // 순환이 있어도 chunk 수만큼만 반복한다.
    for (let depth = 0; depth <= chunks.length; depth += 1) {
      const next = inlinePromptChunkReferences(current, chunks);
      if (next === current) break;
      current = next;
    }
    return current;
  });
  usePromptChunkStore.setState({ chunks: [], categories: [] });
}

// 마지막으로 포커스했던 프롬프트 입력칸의 커서 위치에 참조를 넣는다.
// 넣을 곳이 없으면 false.
export function insertPromptChunkReference(name: string): boolean {
  const last = getPromptInsertTarget();
  if (!last) return false;
  const { target } = last;
  const reference = `!macro:${name}!`;
  const field = target.channel === "positive" ? "prompt" : "negativePrompt";
  const state = useGenerationStore.getState();
  const current =
    target.scope === "base"
      ? state[field]
      : state.characterPrompts.find((item) => item.id === target.characterId)?.[
          field
        ];
  if (current === undefined) return false;

  const offset = Math.min(last.offset, current.length);
  const next = current.slice(0, offset) + reference + current.slice(offset);
  useGenerationStore.setState(
    target.scope === "base"
      ? { [field]: next }
      : {
          characterPrompts: state.characterPrompts.map((item) =>
            item.id === target.characterId ? { ...item, [field]: next } : item,
          ),
        },
  );
  // 이어서 누르면 방금 넣은 참조 뒤에 붙는다.
  rememberPromptInsertTarget(target, offset + reference.length);
  return true;
}
