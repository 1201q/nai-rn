import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import {
  AppState,
  View,
  type AccessibilityActionEvent,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Reanimated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from "react-native-reanimated";
import { toast } from "sonner-native";

import { tokens } from "../../styles/tokens";

const SPRING = { damping: 15, stiffness: 220, mass: 0.5 };
const HAPTIC_INTERVAL_MS = 50;

function hapticTick() {
  Haptics.selectionAsync().catch(() => {});
}

function showDragHint() {
  toast("동그란 핸들을 잡고 이동해 주세요. ");
}

export function Slider({
  accessibilityLabel,
  value,
  min,
  max,
  step,
  precision,
  onSlidingComplete,
  onSlidingStart,
  onValueChange,
  display,
  trackHeight = 6,
  thumbSize = 22,
  pill = false,
  trackBg = tokens.color.raised,
  trackFill = tokens.color.accent,
  thumbColor = tokens.color.accent,
  thumbBorderColor = tokens.color.card,
  thumbBorderWidth,
  jumpOnTap = false,
  style,
}: {
  accessibilityLabel: string;
  value: number;
  min: number;
  max: number;
  step: number;
  precision: number;
  onSlidingComplete: (v: number) => void;
  onSlidingStart?: () => void;
  onValueChange?: (v: number) => void;
  // 드래그 중 표시값을 UI 스레드에서 직접 구동(재렌더 없음). 없으면 커밋 시에만 갱신.
  display?: SharedValue<number>;
  trackHeight?: number;
  thumbSize?: number;
  pill?: boolean;
  trackBg?: string;
  trackFill?: string;
  thumbColor?: string;
  thumbBorderColor?: string;
  thumbBorderWidth?: number;
  jumpOnTap?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const [width, setWidth] = useState(0);
  // thumbSize = 높이. pill이면 폭을 좁혀 세로 캡슐. 이동/정렬은 폭 기준.
  const thumbH = thumbSize;
  const thumbW = pill ? Math.round(thumbSize * 0.6) : thumbSize;
  const half = thumbW / 2;
  const usable = Math.max(1, width - thumbW);
  const resolvedThumbBorderWidth = thumbBorderWidth ?? (pill ? 2 : 3);

  const active = useSharedValue(false);
  // thumb 중심 x. 드래그 중엔 손가락, 정지 땐 value에서 동기화.
  const posX = useSharedValue(0);
  const pressed = useSharedValue(0);
  const lastSnap = useSharedValue(value);
  const lastHapticAt = useSharedValue(-Infinity);

  const frac = Math.min(1, Math.max(0, (value - min) / (max - min)));

  const syncPosition = useCallback(
    (measuredWidth: number, force = false) => {
      if (!force && active.value) return;

      if (force) {
        active.value = false;
        pressed.value = 0;
      }

      lastSnap.value = value;
      if (display) display.value = value;
      if (!Number.isFinite(measuredWidth) || measuredWidth <= 0) return;

      const measuredUsable = Math.max(1, measuredWidth - thumbW);
      posX.value = half + frac * measuredUsable;
    },
    [active, display, frac, half, lastSnap, posX, pressed, thumbW, value],
  );

  // 정지 상태에서만 외부 값(±버튼·입력·초기값·커밋)을 thumb 위치로 반영.
  // 드래그 중엔 손가락이 우선이라 덮어쓰지 않음 → 릴리즈 점프 방지.
  useLayoutEffect(() => {
    syncPosition(width);
  }, [syncPosition, width]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") syncPosition(width, true);
    });
    return () => subscription.remove();
  }, [syncPosition, width]);

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
      if (onValueChange) runOnJS(onValueChange)(snapped);
      const now = Date.now();
      if (now - lastHapticAt.value >= HAPTIC_INTERVAL_MS) {
        lastHapticAt.value = now;
        runOnJS(hapticTick)();
      }
    }
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-6, 6])
    .failOffsetY([-12, 12])
    .onStart((e) => {
      active.value = true;
      lastHapticAt.value = -Infinity;
      if (onSlidingStart) runOnJS(onSlidingStart)();
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

  const tap = Gesture.Tap().onEnd((event, success) => {
    if (!success) return;
    if (jumpOnTap) {
      lastHapticAt.value = -Infinity;
      if (onSlidingStart) runOnJS(onSlidingStart)();
      const x = Math.min(width - half, Math.max(half, event.x));
      handle(x);
      const snapped = snap(valAtX(x));
      posX.value = xAtVal(snapped);
      runOnJS(onSlidingComplete)(snapped);
      return;
    }
    const tappedThumb =
      event.x >= posX.value - half && event.x <= posX.value + half;
    if (!tappedThumb) runOnJS(showDragHint)();
  });

  const gesture = Gesture.Exclusive(pan, tap);

  const fillStyle = useAnimatedStyle(() => ({
    width: Math.max(0, posX.value),
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: posX.value - half },
      { scale: 1 + pressed.value * 0.15 },
    ],
  }));

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const nextWidth = e.nativeEvent.layout.width;
      setWidth(nextWidth);
      syncPosition(nextWidth);
    },
    [syncPosition],
  );

  const adjustValue = (event: AccessibilityActionEvent) => {
    const action = event.nativeEvent.actionName;
    if (action !== "increment" && action !== "decrement") return;
    const next = snap(lastSnap.value + (action === "increment" ? step : -step));
    if (next === lastSnap.value) return;

    lastSnap.value = next;
    posX.value = xAtVal(next);
    if (display) display.value = next;
    hapticTick();
    onSlidingStart?.();
    onValueChange?.(next);
    onSlidingComplete(next);
  };

  return (
    <GestureDetector gesture={gesture}>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ min, max, now: value, text: String(value) }}
        accessibilityActions={[
          { name: "increment", label: "값 증가" },
          { name: "decrement", label: "값 감소" },
        ]}
        onAccessibilityAction={adjustValue}
        onLayout={onLayout}
        style={[
          { height: Math.max(thumbSize, 30), justifyContent: "center" },
          style,
        ]}
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
              backgroundColor: trackFill,
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
              backgroundColor: thumbColor,
              borderWidth: resolvedThumbBorderWidth,
              borderColor: thumbBorderColor,
            },
            thumbStyle,
          ]}
        />
      </View>
    </GestureDetector>
  );
}
