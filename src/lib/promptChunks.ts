// Prompt Chunks: 이름으로 재사용하는 프롬프트 조각. 프롬프트와 chunk 내용 안에서
// 공식 문법 `!macro:Name!`으로 참조하고, 생성/토큰 계산 직전에 내용으로 펼친다.

export type PromptChunk = {
  id: string;
  name: string;
  content: string;
  color: string;
  categoryId: string | null;
};

export type PromptChunkCategory = {
  id: string;
  name: string;
  color: string;
  collapsed: boolean;
};

// 순서는 배열 순서다. 같은 categoryId를 가진 chunk끼리의 상대 순서만 의미가 있다.
export type PromptChunkDocument = {
  version: 1;
  chunks: PromptChunk[];
  categories: PromptChunkCategory[];
};

export const DEFAULT_PROMPT_CHUNK_COLOR = "#6B7280";

export const EMPTY_PROMPT_CHUNK_DOCUMENT: PromptChunkDocument = {
  version: 1,
  chunks: [],
  categories: [],
};

const REFERENCE_PATTERN = /!macro:([^!]+)!/g;
const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export type PromptChunkResolution = {
  text: string;
  missing: string[];
  circular: string[];
};

// 없는 이름과 순환 참조는 빈 문자열로 바꾸고 이름을 따로 모은다. 다른 프롬프트
// 문법(강조, 랜덤라이저, 쉼표)은 건드리지 않는다.
export function resolvePromptChunks(
  source: string,
  chunks: readonly PromptChunk[],
): PromptChunkResolution {
  const byName = new Map(chunks.map((chunk) => [chunk.name, chunk]));
  const missing = new Set<string>();
  const circular = new Set<string>();

  const expand = (text: string, path: ReadonlySet<string>): string =>
    text.replace(REFERENCE_PATTERN, (_match, rawName: string) => {
      const name = rawName.trim();
      if (path.has(name)) {
        circular.add(name);
        return "";
      }
      const chunk = byName.get(name);
      if (!chunk) {
        missing.add(name);
        return "";
      }
      return expand(chunk.content, new Set(path).add(name));
    });

  const text = expand(source, new Set());
  return { text, missing: [...missing], circular: [...circular] };
}

export function describePromptChunkErrors(
  resolution: PromptChunkResolution,
): string | null {
  const parts: string[] = [];
  if (resolution.missing.length > 0) {
    parts.push(`없는 chunk: ${resolution.missing.join(", ")}`);
  }
  if (resolution.circular.length > 0) {
    parts.push(`순환 참조: ${resolution.circular.join(", ")}`);
  }
  return parts.length > 0 ? parts.join(" / ") : null;
}

// 해당 이름의 참조만 chunk 내용으로 한 단계 펼친다(삭제 전 정리용).
export function inlinePromptChunkReferences(
  text: string,
  chunks: readonly PromptChunk[],
): string {
  const byName = new Map(chunks.map((chunk) => [chunk.name, chunk]));
  return text.replace(REFERENCE_PATTERN, (match, rawName: string) => {
    const chunk = byName.get(rawName.trim());
    return chunk ? chunk.content : match;
  });
}

export function renamePromptChunkReferences(
  text: string,
  from: string,
  to: string,
): string {
  return text.replace(REFERENCE_PATTERN, (match, rawName: string) =>
    rawName.trim() === from ? `!macro:${to}!` : match,
  );
}

export function isPromptChunkColor(color: string): boolean {
  return COLOR_PATTERN.test(color);
}

// 저장 전 검증. 문제가 없으면 null.
export function validatePromptChunk(
  input: { id?: string; name: string; content: string; color: string },
  chunks: readonly PromptChunk[],
): string | null {
  const name = input.name.trim();
  const content = input.content.trim();
  if (!name) return "이름을 입력하세요.";
  if (name.includes("!")) return "이름에 !는 쓸 수 없습니다.";
  if (!content) return "내용을 입력하세요.";
  if (!isPromptChunkColor(input.color)) return "색상은 #RRGGBB 형식입니다.";
  if (chunks.some((chunk) => chunk.id !== input.id && chunk.name === name)) {
    return "같은 이름의 chunk가 이미 있습니다.";
  }

  const others = chunks.filter((chunk) => chunk.id !== input.id);
  const candidate: PromptChunk = {
    id: input.id ?? "",
    name,
    content,
    color: input.color,
    categoryId: null,
  };
  const { circular } = resolvePromptChunks(`!macro:${name}!`, [
    ...others,
    candidate,
  ]);
  if (circular.length > 0) {
    return `순환 참조가 생깁니다: ${circular.join(", ")}`;
  }
  return null;
}

export function validatePromptChunkCategory(input: {
  name: string;
  color: string;
}): string | null {
  if (!input.name.trim()) return "이름을 입력하세요.";
  if (!isPromptChunkColor(input.color)) return "색상은 #RRGGBB 형식입니다.";
  return null;
}

// 같은 그룹(chunk는 같은 category) 안에서 한 칸 앞/뒤로 옮긴다.
export function moveWithinGroup<T extends { id: string }>(
  items: readonly T[],
  id: string,
  direction: -1 | 1,
  sameGroup: (a: T, b: T) => boolean,
): T[] {
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) return [...items];
  let target = index + direction;
  while (
    target >= 0 &&
    target < items.length &&
    !sameGroup(items[index], items[target])
  ) {
    target += direction;
  }
  if (target < 0 || target >= items.length) return [...items];
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function parsePromptChunkDocument(
  json: string | undefined,
): PromptChunkDocument {
  if (!json) return EMPTY_PROMPT_CHUNK_DOCUMENT;
  try {
    const parsed = JSON.parse(json) as PromptChunkDocument;
    if (
      parsed.version === 1 &&
      Array.isArray(parsed.chunks) &&
      Array.isArray(parsed.categories)
    ) {
      return parsed;
    }
  } catch {
    // 아래 기본값으로 떨어진다.
  }
  return EMPTY_PROMPT_CHUNK_DOCUMENT;
}

export type PromptChunkTrigger = {
  /** `@`의 위치. */
  start: number;
  query: string;
};

// 커서 앞의 `@검색어`. `@`는 맨 앞이거나 공백/쉼표 뒤에 있어야 하고, 검색어에
// 쉼표나 줄바꿈이 들어가면 끝난다.
export function getPromptChunkTrigger(
  text: string,
  position: number,
): PromptChunkTrigger | null {
  const match = /(?:^|[\s,])@([^,\n@]*)$/.exec(text.slice(0, position));
  if (!match) return null;
  const query = match[1];
  return { start: position - query.length - 1, query };
}

function isSubsequence(text: string, query: string) {
  let matched = 0;
  for (const char of text) {
    if (char === query[matched]) matched += 1;
    if (matched === query.length) return true;
  }
  return query.length === 0;
}

// 공식 웹과 같은 순위: 이름 prefix > 이름 포함 > 이름 subsequence >
// "카테고리: 이름"의 같은 세 단계 > 내용 포함.
export function searchPromptChunks(
  chunks: readonly PromptChunk[],
  categories: readonly PromptChunkCategory[],
  query: string,
): PromptChunk[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...chunks];
  const categoryNames = new Map(
    categories.map((category) => [category.id, category.name]),
  );
  const name = (chunk: PromptChunk) => chunk.name.toLowerCase();
  const qualified = (chunk: PromptChunk) => {
    const category = categoryNames.get(chunk.categoryId ?? "");
    return category === undefined
      ? null
      : `${category}: ${chunk.name}`.toLowerCase();
  };
  const tiers: ((chunk: PromptChunk) => boolean)[] = [
    (chunk) => name(chunk).startsWith(q),
    (chunk) => name(chunk).includes(q),
    (chunk) => isSubsequence(name(chunk), q),
    (chunk) => qualified(chunk)?.startsWith(q) ?? false,
    (chunk) => qualified(chunk)?.includes(q) ?? false,
    (chunk) => isSubsequence(qualified(chunk) ?? "", q),
    (chunk) => chunk.content.toLowerCase().includes(q),
  ];
  const found = new Set<PromptChunk>();
  for (const matches of tiers) {
    for (const chunk of chunks) {
      if (!found.has(chunk) && matches(chunk)) found.add(chunk);
    }
  }
  return [...found];
}

export type PromptChunkReference = {
  start: number;
  end: number;
  name: string;
};

const REFERENCE_PREFIX_LENGTH = "!macro:".length;

// 저장된 chunk를 가리키는 완성된 참조만 찾는다. 입력창은 이 구간을 칩 하나처럼
// 다룬다. 없는 이름은 사용자가 고칠 수 있게 일반 텍스트로 둔다.
export function findPromptChunkReferences(
  text: string,
  chunks: readonly PromptChunk[],
): PromptChunkReference[] {
  if (!text.includes("!macro:")) return [];
  const names = new Set(chunks.map((chunk) => chunk.name));
  const references: PromptChunkReference[] = [];
  for (const match of text.matchAll(REFERENCE_PATTERN)) {
    const name = match[1].trim();
    if (names.has(name)) {
      references.push({
        start: match.index,
        end: match.index + match[0].length,
        name,
      });
    }
  }
  return references;
}

// 커서가 참조 안쪽이면 앞이나 뒤 경계로 옮긴다. 한 칸씩 움직여 들어온 경우는
// 반대편으로 건너가고, 그 밖에는 보이는 이름 기준으로 가까운 쪽을 고른다.
export function snapCaretToPromptChunk(
  references: readonly PromptChunkReference[],
  caret: number,
  previousCaret: number,
): number {
  const reference = references.find(
    (item) => item.start < caret && caret < item.end,
  );
  if (!reference) return caret;
  if (previousCaret === reference.start && caret === reference.start + 1) {
    return reference.end;
  }
  if (previousCaret === reference.end && caret === reference.end - 1) {
    return reference.start;
  }
  const labelStart = reference.start + REFERENCE_PREFIX_LENGTH;
  const labelLength = reference.end - 1 - labelStart;
  const offset = Math.min(Math.max(caret - labelStart, 0), labelLength);
  return offset * 2 <= labelLength ? reference.start : reference.end;
}

// 삭제 범위가 참조의 일부만 지우면 참조 전체를 지우도록 넓힌다. 넓힐 필요가
// 없으면 null.
export function expandDeletionOverPromptChunks(
  previous: string,
  deleteStart: number,
  deleteEnd: number,
  references: readonly PromptChunkReference[],
): { text: string; caret: number } | null {
  let start = deleteStart;
  let end = deleteEnd;
  for (const reference of references) {
    if (deleteStart < reference.end && deleteEnd > reference.start) {
      start = Math.min(start, reference.start);
      end = Math.max(end, reference.end);
    }
  }
  if (start === deleteStart && end === deleteEnd) return null;
  return { text: previous.slice(0, start) + previous.slice(end), caret: start };
}
