// NovelAI 프롬프트 강조 문법을 색칠하기 위한 순수 파서.
// 공식 웹의 표시 규칙을 따른다: docs/2026-10-09-novelai-official-prompt-highlighting-rules.md
//
// 규칙(왼쪽부터 읽으며 가중치 하나만 유지):
//  - `{` 또는 `]` : 가중치 x1.05
//  - `}` 또는 `[` : 가중치 /1.05
//  - `숫자::`      : 가중치를 그 숫자로 덮어쓴다(괄호 누적 포함, 스택 없음)
//  - bare `::`     : 가중치를 1로 되돌린다
//  - 기호부터 새 구간이 시작된다. 가중치가 1에서 0.01 미만으로 떨어져 있으면 칠하지 않는다.
//  - 결과가 정확히 1인 `::`(앞에 붙은 숫자 포함)는 그 기호만 mid로 칠한다.
//  - `|`, `||`    : 기호만 표시하고 가중치는 건드리지 않는다.
//
// React 비의존 순수 함수.

export type PromptHighlightKind = "high" | "low" | "mid" | "bar";

export interface PromptHighlightRange {
  start: number;
  end: number;
  kind: PromptHighlightKind;
  // high/low/mid 배경 농도. bar에는 없다.
  alpha?: number;
}

// 파서가 읽지 않는 구간(Prompt Chunk 참조). 시작 위치 순서로, 겹치지 않게 넘긴다.
export interface PromptHighlightExclusion {
  start: number;
  end: number;
}

const STEP = 1.05;
const NEUTRAL_TOLERANCE = 0.01;
const MID_ALPHA = 0.5;

// 공식 웹: 0.2~0.6, 1/40 단계. 2 이상과 0 이하에서 가장 진하다.
function emphasisAlpha(weight: number): number {
  "worklet";
  const denominator = weight > 0 ? 1 : 0.5;
  const distance = Math.min(1, Math.abs(weight - 1) / denominator);
  return Math.round(40 * (0.2 + 0.4 * distance)) / 40;
}

export function parsePromptHighlights(
  text: string,
  excluded: readonly PromptHighlightExclusion[] = [],
): PromptHighlightRange[] {
  "worklet";
  const trailingNumber = /-?\d*\.?\d*$/;
  const ranges: PromptHighlightRange[] = [];
  let weight = 1;

  const pushEmphasis = (start: number, end: number) => {
    if (end <= start || Math.abs(weight - 1) < NEUTRAL_TOLERANCE) return;
    ranges.push({
      start,
      end,
      kind: weight > 1 ? "high" : "low",
      alpha: emphasisAlpha(weight),
    });
  };

  // 제외 구간 사이의 조각 하나를 읽는다. 가중치는 조각을 넘어 이어지지만,
  // 숫자 찾기와 `::` 인식은 조각 안에서만 한다.
  const parsePiece = (pieceStart: number, pieceEnd: number) => {
    let segmentStart = pieceStart;
    let i = pieceStart;

    while (i < pieceEnd) {
      const ch = text[i];
      const next = i + 1 < pieceEnd ? text[i + 1] : "";

      if (ch === "|") {
        const length = next === "|" ? 2 : 1;
        ranges.push({ start: i, end: i + length, kind: "bar" });
        i += length;
        continue;
      }

      if (ch === ":" && next === ":") {
        // 숫자는 `::` 바로 앞에 붙은 것만, 뒤에서부터 찾는다.
        let tailStart = i;
        while (tailStart > segmentStart) {
          const code = text.charCodeAt(tailStart - 1);
          const isNumberChar =
            (code >= 48 && code <= 57) || code === 45 || code === 46;
          if (!isNumberChar) break;
          tailStart -= 1;
        }
        const match = trailingNumber.exec(text.slice(tailStart, i));
        const numberText = match ? match[0] : "";
        const markStart = i - numberText.length;

        pushEmphasis(segmentStart, markStart);
        if (numberText === "") {
          weight = 1;
        } else {
          // `-`, `.`처럼 덜 쓴 숫자는 0으로 본다.
          const parsed = parseFloat(numberText);
          weight = Number.isNaN(parsed) ? 0 : parsed;
        }

        i += 2;
        if (weight === 1) {
          ranges.push({
            start: markStart,
            end: i,
            kind: "mid",
            alpha: MID_ALPHA,
          });
          segmentStart = i;
        } else {
          segmentStart = markStart;
        }
        continue;
      }

      if (ch === "{" || ch === "]" || ch === "}" || ch === "[") {
        pushEmphasis(segmentStart, i);
        weight = ch === "{" || ch === "]" ? weight * STEP : weight / STEP;
        segmentStart = i;
      }
      i += 1;
    }

    pushEmphasis(segmentStart, pieceEnd);
  };

  let cursor = 0;
  for (const gap of excluded) {
    parsePiece(cursor, gap.start);
    cursor = gap.end;
  }
  parsePiece(cursor, text.length);

  return ranges;
}
