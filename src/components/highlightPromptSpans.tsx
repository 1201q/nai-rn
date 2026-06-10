import { Text } from "react-native";

import {
  parsePromptHighlights,
  type PromptHighlightKind,
} from "../lib/promptHighlight";

// effective weight / 문법 종류별 전경색. plain 은 색을 주지 않아 TextInput 의
// 기본 텍스트 색(light.textPrimary)을 그대로 상속한다.
const COLOR: Partial<Record<PromptHighlightKind, string>> = {
  strengthen: "#d6336c", // 강화 (핑크/레드)
  weaken: "#1c7ed6", // 약화 (블루)
  negative: "#7048e8", // 음수 강조 (퍼플)
  bracket: "#adb5bd", // {} [] 기호 (뮤트)
  numericMark: "#e8590c", // 숫자:: / :: 마커 (오렌지)
  randomizer: "#2f9e44", // ||...|| 및 내부 | (그린)
  separator: "#868e96", // 외부 단일 | (그레이)
};

// 프롬프트 문자열을 색칠된 <Text> 자식 노드로 변환한다.
// TextInput 의 children 으로 넣어 인라인 하이라이트를 구현한다.
// 빈 문자열이면 null 을 반환해 placeholder 가 정상 노출되게 한다.
export function renderPromptHighlights(text: string) {
  if (!text) return null;
  const spans = parsePromptHighlights(text);
  return spans.map((span, i) => {
    const color = COLOR[span.kind];
    return (
      <Text key={i} style={color ? { color } : undefined}>
        {span.text}
      </Text>
    );
  });
}
