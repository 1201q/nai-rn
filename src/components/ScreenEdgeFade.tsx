import { StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { light } from "../screens/home/styles";

// 스크롤 콘텐츠가 상/하단 바 밑으로 자연스럽게 사라지게 하는 화이트 페이드.
// scroll content 위, 헤더/바텀바 아래에 렌더 (pointerEvents none).
export function ScreenEdgeFade({
  topHeight = 0,
  bottomHeight = 0,
}: {
  topHeight?: number;
  bottomHeight?: number;
}) {
  return (
    <>
      {topHeight > 0 ? (
        <LinearGradient
          pointerEvents="none"
          colors={[light.bg, "rgba(19,20,44,0)"]}
          style={[styles.top, { height: topHeight }]}
        />
      ) : null}
      {bottomHeight > 0 ? (
        <LinearGradient
          pointerEvents="none"
          colors={["rgba(19,20,44,0)", light.bg]}
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
