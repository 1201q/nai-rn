import { useRef } from "react";
import { Animated } from "react-native";

// 칩/행 공통 누름 애니메이션. anim 0→1(누름)로 진행하고 scale 을 반환한다.
// backgroundColor·onPress 등 컴포넌트별로 다른 부분은 호출측이 반환된 anim 으로 직접 구성.
export function useScalePress({
  scaleTo = 0.93,
  useNativeDriver = false,
}: { scaleTo?: number; useNativeDriver?: boolean } = {}) {
  const anim = useRef(new Animated.Value(0)).current;

  const onPressIn = () =>
    Animated.spring(anim, {
      toValue: 1,
      useNativeDriver,
      speed: 60,
      bounciness: 0,
    }).start();

  const onPressOut = () =>
    Animated.spring(anim, {
      toValue: 0,
      useNativeDriver,
      speed: 30,
      bounciness: 0,
    }).start();

  const scale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, scaleTo],
  });

  return { anim, onPressIn, onPressOut, scale };
}
