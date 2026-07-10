import { useLayoutEffect, useState } from "react";
import { View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Reanimated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from "react-native-reanimated";

import { light } from "./styles";
import { hapticTick } from "./primitives";

const SPRING = { damping: 15, stiffness: 220, mass: 0.5 };

export function CustomSlider({
  value,
  min,
  max,
  step,
  precision,
  onSlidingComplete,
  display,
  trackHeight = 6,
  thumbSize = 22,
  pill = false,
  trackBg = light.surfaceAlt,
  style,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  precision: number;
  onSlidingComplete: (v: number) => void;
  // 드래그 중 표시값을 UI 스레드에서 직접 구동(재렌더 없음). 없으면 커밋 시에만 갱신.
  display?: SharedValue<number>;
  trackHeight?: number;
  thumbSize?: number;
  pill?: boolean;
  trackBg?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const [width, setWidth] = useState(0);
  // thumbSize = 높이. pill이면 폭을 좁혀 세로 캡슐. 이동/정렬은 폭 기준.
  const thumbH = thumbSize;
  const thumbW = pill ? Math.round(thumbSize * 0.6) : thumbSize;
  const half = thumbW / 2;
  const usable = Math.max(1, width - thumbW);

  const active = useSharedValue(false);
  // thumb 중심 x. 드래그 중엔 손가락, 정지 땐 value에서 동기화.
  const posX = useSharedValue(0);
  const pressed = useSharedValue(0);
  const lastSnap = useSharedValue(value);

  const frac = Math.min(1, Math.max(0, (value - min) / (max - min)));
  const restX = half + frac * usable;

  // 정지 상태에서만 외부 값(±버튼·입력·초기값·커밋)을 thumb 위치로 반영.
  // 드래그 중엔 손가락이 우선이라 덮어쓰지 않음 → 릴리즈 점프 방지.
  useLayoutEffect(() => {
    if (!active.value) posX.value = restX;
  }, [restX, active, posX]);

  const snap = (v: number) => {
    "worklet";
    const idx = Math.round((v - min) / step);
    const stepped = min + idx * step;
    return Number(Math.min(max, Math.max(min, stepped)).toFixed(precision));
  };

  const valAtX = (x: number) => {
    "worklet";
    return min + ((x - half) / usable) * (max - min);
  };
  const xAtVal = (v: number) => {
    "worklet";
    return half + ((v - min) / (max - min)) * usable;
  };

  const handle = (x: number) => {
    "worklet";
    posX.value = x;
    const snapped = snap(valAtX(x));
    if (snapped !== lastSnap.value) {
      lastSnap.value = snapped;
      if (display) display.value = snapped;
      runOnJS(hapticTick)();
    }
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-6, 6])
    .failOffsetY([-12, 12])
    .onStart((e) => {
      active.value = true;
      pressed.value = withSpring(1, SPRING);
      handle(Math.min(width - half, Math.max(half, e.x)));
    })
    .onUpdate((e) => {
      handle(Math.min(width - half, Math.max(half, e.x)));
    })
    .onFinalize(() => {
      if (!active.value) return;
      active.value = false;
      pressed.value = withSpring(0, SPRING);
      const snapped = snap(valAtX(posX.value));
      posX.value = xAtVal(snapped); // step 위치로 스냅 (릴리즈 시 정렬)
      runOnJS(onSlidingComplete)(snapped);
    });

  const fillStyle = useAnimatedStyle(() => ({
    width: Math.max(0, posX.value),
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: posX.value - half },
      { scale: 1 + pressed.value * 0.15 },
    ],
  }));

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <GestureDetector gesture={pan}>
      <View
        onLayout={onLayout}
        style={[{ height: Math.max(thumbSize, 30), justifyContent: "center" }, style]}
      >
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            height: trackHeight,
            borderRadius: trackHeight / 2,
            backgroundColor: trackBg,
          }}
        />
        <Reanimated.View
          style={[
            {
              position: "absolute",
              left: 0,
              height: trackHeight,
              borderRadius: trackHeight / 2,
              backgroundColor: light.accent,
            },
            fillStyle,
          ]}
        />
        <Reanimated.View
          style={[
            {
              position: "absolute",
              left: 0,
              width: thumbW,
              height: thumbH,
              borderRadius: thumbW / 2,
              backgroundColor: light.accent,
              borderWidth: pill ? 2 : 3,
              borderColor: light.surface,
            },
            thumbStyle,
          ]}
        />
      </View>
    </GestureDetector>
  );
}
