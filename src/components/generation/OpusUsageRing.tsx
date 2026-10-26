import { memo, useEffect, type RefObject } from "react";
import { Pressable, StyleSheet, Text, type View } from "react-native";
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { toast } from "sonner-native";

import { GlassBackground } from "../common/GlassBackground";
import { formatUsageMessage } from "../../lib/opusUsage";
import { tokens } from "../../styles/tokens";

const BADGE_SIZE = 40;
const RING_SIZE = 28;
const RING_STROKE_WIDTH = 2.5;
const RING_RADIUS = (RING_SIZE - RING_STROKE_WIDTH) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const SLIDE_DURATION_MS = 220;

// Opus 사용량 한도의 남은 비율을 링으로 표시한다.
// 숨길 때는 왼쪽(Anlas 표시 뒤)으로 밀려 들어간다. slideDistance는 Anlas 표시와의 간격을 포함한다.
export const OpusUsageRing = memo(function OpusUsageRing({
  percent,
  purchasedPercent = 0,
  exhausted,
  nextPercentAt,
  visible,
  slideDistance,
  blurTarget,
}: {
  percent: number;
  purchasedPercent?: number;
  exhausted: boolean;
  nextPercentAt?: number;
  visible: boolean;
  slideDistance: number;
  blurTarget: RefObject<View | null>;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const extra = Math.max(0, Math.min(400, Math.round(purchasedPercent)));
  const total = clamped + extra;
  // 100% 초과 시 같은 링 안에서 기본/추가 잔량의 비율로 나눈다.
  const capacity = Math.max(100, total);
  const basicArc = (RING_CIRCUMFERENCE * clamped) / capacity;
  const extraArc = (RING_CIRCUMFERENCE * extra) / capacity;
  const color =
    extra > 0 && clamped === 0
      ? tokens.color.badge3
      : exhausted && extra === 0
        ? tokens.color.negative
        : tokens.color.accent;
  const extraLabel = extra > 0 ? ` · Extra Usage ${extra}% 남음` : "";
  const shown = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    shown.value = withTiming(visible ? 1 : 0, { duration: SLIDE_DURATION_MS });
  }, [shown, visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: shown.value > 0 ? 1 : 0,
    transform: [{ translateX: (shown.value - 1) * slideDistance }],
  }));

  return (
    <Reanimated.View
      pointerEvents={visible ? "auto" : "none"}
      style={animatedStyle}
    >
      <Pressable
        testID="generation-opus-usage"
        accessibilityRole="button"
        accessibilityLabel={`Opus 사용량 ${clamped}% 남음${extraLabel}`}
        accessibilityElementsHidden={!visible}
        importantForAccessibility={visible ? "auto" : "no-hide-descendants"}
        onPress={() =>
          toast(formatUsageMessage(clamped, nextPercentAt) + extraLabel)
        }
        style={({ pressed }) => [styles.badge, pressed && styles.pressed]}
      >
        <GlassBackground blurTarget={blurTarget} />
        <Svg
          accessible={false}
          width={RING_SIZE}
          height={RING_SIZE}
          viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
        >
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            stroke={tokens.color.borderSubtleStrong}
            strokeWidth={RING_STROKE_WIDTH}
          />
          {clamped > 0 ? (
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              fill="none"
              stroke={tokens.color.accent}
              strokeWidth={RING_STROKE_WIDTH}
              strokeLinecap={extra > 0 ? "butt" : "round"}
              strokeDasharray={`${basicArc} ${RING_CIRCUMFERENCE}`}
              transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
            />
          ) : null}
          {extra > 0 ? (
            <Circle
              testID="generation-opus-extra-usage-arc"
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              fill="none"
              stroke={tokens.color.badge3}
              strokeWidth={RING_STROKE_WIDTH}
              strokeLinecap="butt"
              strokeDasharray={`${extraArc} ${RING_CIRCUMFERENCE}`}
              strokeDashoffset={-basicArc}
              transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
            />
          ) : null}
        </Svg>
        <Text style={[styles.text, { color }]}>{total}</Text>
      </Pressable>
    </Reanimated.View>
  );
});

const styles = StyleSheet.create({
  badge: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: tokens.radius.pill,
  },
  pressed: {
    opacity: tokens.opacity.pressed,
  },
  text: {
    position: "absolute",
    fontFamily: tokens.font.semibold,
    fontSize: 9,
  },
});
