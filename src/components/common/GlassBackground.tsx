import type { RefObject } from "react";
import { StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";

import { tokens } from "../../styles/tokens";

// 부모를 채우는 블러 배경. 부모는 overflow: "hidden"과 borderRadius를 가져야 한다.
// Android는 blurTarget(BlurTargetView)이 있어야 실제로 블러가 걸린다. BlurView는 마운트
// 시점의 blurTarget.current만 읽으므로, 대상이 JSX에서 이 컴포넌트보다 앞에 있어야 한다.
export function GlassBackground({
  blurTarget,
}: {
  blurTarget: RefObject<View | null>;
}) {
  return (
    <>
      <BlurView
        blurTarget={blurTarget}
        blurMethod="dimezisBlurView"
        tint="dark"
        intensity={40}
        style={StyleSheet.absoluteFill}
      />
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.tint]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  tint: {
    // 빈 앱 배경 위에서 캔버스 도구 바(tokens.color.overlay)와 같은 색이 나오도록 맞춘 값.
    backgroundColor: "rgba(55,53,69,0.2)",
    // 빈 배경 위에서도 윤곽이 보이도록 테두리를 두른다.
    // borderWidth: 1,
    // borderColor: tokens.color.borderSubtle,
    borderRadius: tokens.radius.pill,
  },
});
