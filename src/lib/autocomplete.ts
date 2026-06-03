// 태그 자동완성의 순수, 플랫폼 무관 로직. React Native / DOM 의존 없음 -> 테스트 쉬움.

import type { TagType } from "./tagDb";

export const MIN_TRIGGER = 2;

const NAMESPACES: TagType[] = ["artist", "character", "copyright", "general"];

export interface CurrentWord {
  /** 지금 입력 중인 단어(앞쪽 공백 제거됨). */
  word: string;
  /** `text`에서 `word`가 시작하는 인덱스. */
  start: number;
}

/**
 * 커서 위치의 토큰: 커서 왼쪽에서 직전 콤마,줄바꿈,weight 구분자(`::`)까지.
 * 단일 콜론은 경계가 아님 -> `artist:wlop` 같은 네임스페이스는 유지되고,
 * `1.2::tag`의 `tag` 부분은 자동완성됨.
 */
export function getCurrentWord(text: string, position: number): CurrentWord {
  const left = text.slice(0, position);
  const afterLine = left.slice(
    Math.max(left.lastIndexOf(","), left.lastIndexOf("\n")) + 1,
  );
  const weightAt = afterLine.lastIndexOf("::");
  const raw = weightAt === -1 ? afterLine : afterLine.slice(weightAt + 2);
  const word = raw.replace(/^\s+/, "");
  return { word, start: position - word.length };
}

export interface ParsedQuery {
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

export interface InsertResult {
  text: string;
  /** 삽입 후 커서가 위치할 곳. */
  cursor: number;
}

/**
 * 커서 위치의 단어를 `value`로 교체하고 뒤에 `, `를 붙여 다음 태그를 이어
 * 입력하게 함. 앞 문자가 공백,콤마가 아닐 때만 구분 공백 추가.
 */
export function insertTag(
  text: string,
  position: number,
  value: string,
): InsertResult {
  const { start } = getCurrentWord(text, position);
  const before = text.slice(0, start);
  const after = text.slice(position);

  const needsSpace = before.length > 0 && !/[\s,:]$/.test(before);
  const insertion = `${needsSpace ? " " : ""}${value}, `;

  return {
    text: before + insertion + after,
    cursor: before.length + insertion.length,
  };
}
