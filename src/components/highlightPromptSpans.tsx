import { Text, type TextStyle } from "react-native";

import {
  parsePromptHighlights,
  type PromptHighlightKind,
} from "../lib/promptHighlight";

const BLUE = [32, 65, 132] as const;
const RED = [110, 44, 28] as const;

// 문법 자체를 표시하는 보조 스타일. weighted span 은 아래에서 배경색을 계산한다.
const TOKEN_STYLE: Partial<Record<PromptHighlightKind, TextStyle>> = {
  bracket: { color: "#adb5bd" }, // {} [] 기호 (뮤트)
  numericMark: { backgroundColor: "#285125" }, // 닫는 :: 마커 (그린)
  randomizer: { color: "#2f9e44" }, // ||...|| 및 내부 | (그린)
  separator: { color: "#868e96" }, // 외부 단일 | (그레이)
};

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

function rgba(rgb: readonly [number, number, number], alpha: number) {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha.toFixed(2)})`;
}

function weightedBackground(weight: number | undefined) {
  if (weight === undefined || Math.abs(weight - 1) <= 0.0001) return undefined;
  const strength = clamp(Math.abs(weight - 1));
  const alpha = 0.28 + 0.72 * strength;
  return rgba(weight < 1 ? BLUE : RED, alpha);
}

// 프롬프트 문자열을 색칠된 <Text> 자식 노드로 변환한다.
// TextInput 의 children 으로 넣어 인라인 하이라이트를 구현한다.
// 빈 문자열이면 null 을 반환해 placeholder 가 정상 노출되게 한다.
export function renderPromptHighlights(text: string) {
  if (!text) return null;
  const spans = parsePromptHighlights(text);
  return spans.map((span, i) => {
    const backgroundColor = weightedBackground(span.weight);
    const style = backgroundColor
      ? { backgroundColor }
      : TOKEN_STYLE[span.kind];
    return (
      <Text key={i} style={style}>
        {span.text}
      </Text>
    );
  });
}
