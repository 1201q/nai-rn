import { memo, useEffect } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { toast } from "sonner-native";

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
  exhausted,
  nextPercentAt,
  visible,
  slideDistance,
}: {
  percent: number;
  exhausted: boolean;
  nextPercentAt?: number;
  visible: boolean;
  slideDistance: number;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const color = exhausted ? tokens.color.negative : tokens.color.accent;
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
        accessibilityLabel={`Opus 사용량 ${clamped}% 남음`}
        accessibilityElementsHidden={!visible}
        importantForAccessibility={visible ? "auto" : "no-hide-descendants"}
        onPress={() => toast(formatUsageMessage(clamped, nextPercentAt))}
        style={({ pressed }) => [styles.badge, pressed && styles.pressed]}
      >
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
              stroke={color}
              strokeWidth={RING_STROKE_WIDTH}
              strokeLinecap="round"
              strokeDasharray={`${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
              strokeDashoffset={RING_CIRCUMFERENCE * (1 - clamped / 100)}
              transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
            />
          ) : null}
        </Svg>
        <Text style={[styles.text, { color }]}>{clamped}</Text>
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
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.card,
    ...tokens.shadow.floatMd,
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
