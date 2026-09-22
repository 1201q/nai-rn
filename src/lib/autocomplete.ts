// 태그 자동완성의 순수, 플랫폼 무관 로직. React Native / DOM 의존 없음 -> 테스트 쉬움.

import type { TagType } from "./tagDb";

export const MIN_TRIGGER = 2;

const NAMESPACES: TagType[] = ["artist", "character", "copyright", "general"];

interface CurrentWord {
  /** 지금 입력 중인 단어(앞쪽 공백 제거됨). */
  word: string;
  /** `text`에서 `word`가 시작하는 인덱스. */
  start: number;
}

export interface AutocompleteRange {
  start: number;
  end: number;
}

/** Numeric opening markers are indivisible boundaries, including their weight. */
export function getAutocompleteRange(text: string, position: number): AutocompleteRange {
  const boundaries = /-?(?:\d+\.?\d*|\.\d+)::|::|[,\r\n|{}\[\]]/g;
  let start = 0;
  let end = text.length;
  for (const match of text.matchAll(boundaries)) {
    const boundaryStart = match.index;
    const boundaryEnd = boundaryStart + match[0].length;
    if (boundaryEnd <= position) start = boundaryEnd;
    else if (boundaryStart < position) return { start: position, end: position };
    else {
      end = boundaryStart;
      break;
    }
  }
  while (start < position && /\s/.test(text[start])) start += 1;
  return { start, end };
}

/** Prefer the known selection when repeated characters make a text diff ambiguous. */
export function getAutocompleteEdit(
  previous: string,
  text: string,
  selection: AutocompleteRange,
): { start: number; previousEnd: number; end: number } {
  const addedLength = text.length - previous.length + selection.end - selection.start;
  if (
    addedLength >= 0 &&
    text.slice(0, selection.start) === previous.slice(0, selection.start) &&
    text.slice(selection.start + addedLength) === previous.slice(selection.end)
  ) {
    return { start: selection.start, previousEnd: selection.end, end: selection.start + addedLength };
  }
  let start = 0;
  while (start < previous.length && start < text.length && previous[start] === text[start]) start += 1;
  let previousEnd = previous.length;
  let end = text.length;
  while (previousEnd > start && end > start && previous[previousEnd - 1] === text[end - 1]) {
    previousEnd -= 1;
    end -= 1;
  }
  return { start, previousEnd, end };
}

/**
 * 커서 위치의 토큰: 콤마, 줄바꿈, 가중치, 괄호, 파이프 구분자 사이.
 * 단일 콜론은 경계가 아님 -> `artist:wlop` 같은 네임스페이스는 유지되고,
 * `1.2::tag`의 `tag` 부분은 자동완성됨.
 */
export function getCurrentWord(text: string, position: number): CurrentWord {
  const { start } = getAutocompleteRange(text, position);
  return { word: text.slice(start, position), start };
}

interface ParsedQuery {
  /** 이 타입으로 결과 제한, null이면 전체 타입. */
  type: TagType | null;
  /** 검색에 쓸 텍스트(`namespace:` 뒤 부분). */
  query: string;
}

/**
 * `namespace:query` 토큰(예: `artist:wlop`)을 타입 필터와 검색어로 분리.
 * 그냥 단어면 필터 없음.
 */
export function parseQuery(word: string): ParsedQuery {
  const colon = word.indexOf(":");
  if (colon > 0) {
    const ns = word.slice(0, colon).toLowerCase() as TagType;
    if (NAMESPACES.includes(ns)) {
      return { type: ns, query: word.slice(colon + 1) };
    }
  }
  return { type: null, query: word };
}

interface InsertResult {
  text: string;
  /** 삽입 후 커서가 위치할 곳. */
  cursor: number;
}

/**
 * Replace the active range, preserving surrounding prompt syntax.
 * Move past a newly inserted separator so typing starts a new tag.
 */
export function insertTag(
  text: string,
  position: number,
  value: string,
  range = getAutocompleteRange(text, position),
): InsertResult {
  const before = text.slice(0, range.start);
  const after = text.slice(range.end);
  const separator = !after || !/^\s*(?:,|\r?\n|::|[|}\]])/.test(after) ? ", " : "";
  const insertion = value + separator;

  return {
    text: before + insertion + after,
    cursor: before.length + insertion.length,
  };
}
