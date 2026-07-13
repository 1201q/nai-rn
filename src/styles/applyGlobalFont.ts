import { StyleSheet, Text, TextInput, type TextStyle } from "react-native";
import { tokens } from "./tokens";

// Pretendard 앱 전역 적용.
//
// RN은 커스텀 fontFamily가 지정되면 fontWeight를 무시하고 지정된 face를 그린다.
// 따라서 전역 기본값을 "Pretendard-Regular" 하나로 박으면 기존 화면의 bold(700/800)
// 텍스트가 전부 얇아진다. 이를 막기 위해 렌더 시점에 각 텍스트의 fontWeight를 읽어
// 알맞은 Pretendard face(fontFamily)로 매핑한다. 기존 화면 코드는 손대지 않는다.
//
// 되돌리려면 _layout.tsx의 applyGlobalFont() 호출 한 줄만 제거하면 된다.

const WEIGHT_TO_FAMILY: Record<string, string> = {
  "100": tokens.font.regular,
  "200": tokens.font.regular,
  "300": tokens.font.regular,
  "400": tokens.font.regular,
  normal: tokens.font.regular,
  "500": tokens.font.medium,
  "600": tokens.font.semibold,
  "700": tokens.font.bold,
  bold: tokens.font.bold,
  "800": tokens.font.extrabold,
  "900": tokens.font.extrabold,
};

function familyForWeight(weight: unknown): string {
  if (weight == null) return tokens.font.regular;
  return WEIGHT_TO_FAMILY[String(weight)] ?? tokens.font.regular;
}

let patched = false;

export function applyGlobalFont() {
  if (patched) return;
  patched = true;

  for (const Component of [Text, TextInput] as unknown as {
    render?: (...args: unknown[]) => unknown;
  }[]) {
    const original = Component.render;
    if (typeof original !== "function") continue;

    Component.render = function patchedRender(...args: unknown[]) {
      const element = original.apply(this, args) as {
        props?: { style?: unknown };
      } | null;
      if (!element || !element.props) return element;

      const { style } = element.props;
      // StyleSheet.create 는 스타일을 불투명 숫자 ID 로 등록하므로 flatten 으로
      // 실제 객체를 얻어 fontWeight/fontFamily 를 읽는다.
      const flat = StyleSheet.flatten(style as TextStyle) ?? {};

      // 명시적 fontFamily가 있으면 그대로 둔다.
      if (flat.fontFamily) return element;

      const fontFamily = familyForWeight(flat.fontWeight);
      // 기본 폰트를 맨 앞에 두어 개별 스타일(fontSize 등)이 덮어쓰도록.
      const nextStyle = [{ fontFamily }, style];
      return {
        ...element,
        props: { ...element.props, style: nextStyle },
      };
    };
  }
}
