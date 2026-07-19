import { StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { tokens } from "../../styles/tokens";

// 스크롤 콘텐츠가 상/하단 바 밑으로 자연스럽게 사라지게 하는 배경 페이드.
// scroll content 위, 헤더/바텀바 아래에 렌더 (pointerEvents none).
export function ScreenEdgeFade({
  topHeight = 0,
  bottomHeight = 0,
  color = tokens.color.app,
  transparentColor = "rgba(10,10,11,0)",
}: {
  topHeight?: number;
  bottomHeight?: number;
  color?: string;
  transparentColor?: string;
}) {
  return (
    <>
      {topHeight > 0 ? (
        <LinearGradient
          pointerEvents="none"
          colors={[color, transparentColor]}
          style={[styles.top, { height: topHeight }]}
        />
      ) : null}
      {bottomHeight > 0 ? (
        <LinearGradient
          pointerEvents="none"
          colors={[transparentColor, color]}
          style={[styles.bottom, { height: bottomHeight }]}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  top: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 5,
  },
  bottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 5,
  },
});
