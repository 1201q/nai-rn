import {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

const PRESS_SPRING = { mass: 0.5, damping: 18, stiffness: 280 };

// 칩/행 공통 누름 애니메이션. progress 0(평상)→1(누름)을 UI 스레드에서 구동.
// scale 은 scaleStyle 로 바로 적용하고, backgroundColor 등 컴포넌트별로 다른
// 부분은 호출측이 progress 로 interpolateColor 해 직접 구성한다.
export function useScalePress({ scaleTo = 0.93 }: { scaleTo?: number } = {}) {
  const progress = useSharedValue(0);

  const onPressIn = () => {
    progress.value = withSpring(1, PRESS_SPRING);
  };

  const onPressOut = () => {
    progress.value = withSpring(0, PRESS_SPRING);
  };

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + progress.value * (scaleTo - 1) }],
  }));

  return { progress, onPressIn, onPressOut, scaleStyle };
}
