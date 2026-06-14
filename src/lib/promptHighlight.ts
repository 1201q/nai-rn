// NovelAI 프롬프트 강조 문법을 색칠하기 위한 순수 파서.
// 참고: docs/2026-06-10-novelai-prompt-highlight-analysis.md
//
// 규칙(스트림 기반):
//  - `{` 또는 `]` : 오른쪽 텍스트 가중치 ×1.05 (강화)
//  - `}` 또는 `[` : 오른쪽 텍스트 가중치 ÷1.05 (약화)
//  - `숫자::`      : 수치 가중치 구간 열기(×숫자), bare `::` 가 닫음
//  - bare `::`     : 최근 수치 구간을 닫고, 괄호 누적 상태를 기준값(1.0)으로 되돌림
//  - `||...||`     : Prompt Randomizer 구간
//  - randomizer 내부 단일 `|` : 옵션 구분자
//  - randomizer 외부 단일 `|` : 모델 문맥별 구분자(멀티캐릭터/프롬프트믹싱)
//
// React 비의존 순수 함수. 색 분류는 effective weight 로 결정한다.

export type PromptHighlightKind =
  | "plain"
  | "strengthen"
  | "weaken"
  | "negative"
  | "bracket"
  | "numericMark"
  | "randomizer"
  | "separator";

export interface PromptHighlightSpan {
  text: string;
  kind: PromptHighlightKind;
  weight?: number;
}

export interface ParsePromptHighlightsOptions {
  // 외부(randomizer 밖) 단일 `|` 분류용. 지금은 모두 separator 로 처리하므로
  // 미사용이지만, 추후 캐릭터/믹싱 구분 라벨링 확장 지점으로 남겨둔다.
  modelFamily?: "v4" | "v3-or-lower";
}

const STEP = 1.05;

function weightKind(weight: number): PromptHighlightKind {
  if (weight < 0) return "negative";
  if (weight > 1.0001) return "strengthen";
  if (weight < 0.9999) return "weaken";
  return "plain";
}

// 선행 `숫자::` 매칭 (음수/소수 허용). 예: `1.5::`, `-2::`, `.5::`
const NUMERIC_OPEN = /^(-?(?:\d+\.?\d*|\.\d+))::/;

export function parsePromptHighlights(
  text: string,
  _options: ParsePromptHighlightsOptions = {},
): PromptHighlightSpan[] {
  const spans: PromptHighlightSpan[] = [];

  let bracketWeight = 1; // `{}[]` 누적 배율
  const numericStack: number[] = []; // 활성 `숫자::` 가중치들
  let inRandomizer = false;

  let buf = "";

  const effectiveWeight = () =>
    numericStack.reduce((acc, n) => acc * n, bracketWeight);

  const pushWeighted = (value: string) => {
    const weight = effectiveWeight();
    spans.push({ text: value, kind: weightKind(weight), weight });
  };

  // 현재까지 모은 일반 텍스트를 현재 effective weight 기준으로 방출
  const flush = () => {
    if (!buf) return;
    pushWeighted(buf);
    buf = "";
  };

  let i = 0;
  const n = text.length;

  while (i < n) {
    const ch = text[i];

    // `||` (randomizer 토글) — 단일 `|` 보다 먼저 검사
    if (ch === "|" && text[i + 1] === "|") {
      flush();
      spans.push({ text: "||", kind: "randomizer" });
      inRandomizer = !inRandomizer;
      i += 2;
      continue;
    }

    if (ch === "|") {
      flush();
      spans.push({ text: "|", kind: inRandomizer ? "randomizer" : "separator" });
      i += 1;
      continue;
    }

    // `숫자::` 수치 가중치 열기
    const m = NUMERIC_OPEN.exec(text.slice(i));
    if (m) {
      flush();
      const num = parseFloat(m[1]);
      numericStack.push(num);
      pushWeighted(m[0]);
      i += m[0].length;
      continue;
    }

    // bare `::` — 수치 구간 닫고 괄호 누적 초기화
    if (ch === ":" && text[i + 1] === ":") {
      flush();
      if (numericStack.length > 0) numericStack.pop();
      bracketWeight = 1;
      spans.push({ text: "::", kind: "numericMark" });
      i += 2;
      continue;
    }

    // `{` / `]` → ×1.05
    if (ch === "{" || ch === "]") {
      flush();
      bracketWeight *= STEP;
      spans.push({ text: ch, kind: "bracket" });
      i += 1;
      continue;
    }

    // `}` / `[` → ÷1.05
    if (ch === "}" || ch === "[") {
      flush();
      bracketWeight /= STEP;
      spans.push({ text: ch, kind: "bracket" });
      i += 1;
      continue;
    }

    buf += ch;
    i += 1;
  }

  flush();
  return spans;
}
