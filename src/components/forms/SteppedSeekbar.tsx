import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ReactNode } from "react";

import { Slider } from "./Slider";
import { useGenerationStore } from "../../store/generationStore";
import { tokens } from "../../styles/tokens";

// Slider의 pill 핸들 폭(thumbSize 24 * 0.6)의 절반. 첫 / 마지막 단계의 중심이 여기 온다.
const THUMB_HALF = 7;
const STOP_LABEL_WIDTH = 32;

// 몇 개의 정해진 값 중 하나를 고르는 슬라이더. 단계마다 점과 라벨이 붙는다.
export function SteppedSeekbar({
  label,
  labelAccessory,
  stops,
  value,
  onChange,
}: {
  label: string;
  labelAccessory?: ReactNode;
  stops: { value: number; label: string }[];
  value: number;
  onChange: (value: number) => void;
}) {
  const sliderHandleOnly = useGenerationStore((s) => s.sliderHandleOnly);
  const index = Math.max(
    0,
    stops.findIndex((stop) => stop.value === value),
  );
  const last = stops.length - 1;

  function selectIndex(next: number) {
    if (stops[next].value !== value) onChange(stops[next].value);
  }

  return (
    <View style={styles.field}>
      <View style={styles.header}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label}</Text>
          {labelAccessory}
        </View>
        <View style={styles.valueBox}>
          <Text style={styles.value}>{stops[index].label}</Text>
        </View>
      </View>
      <View>
        <Slider
          accessibilityLabel={label}
          value={index}
          min={0}
          max={last}
          step={1}
          precision={0}
          trackHeight={6}
          thumbSize={24}
          pill
          jumpOnTap
          handleOnly={sliderHandleOnly}
          trackBg={tokens.color.sunken}
          thumbBorderWidth={0}
          onValueChange={selectIndex}
          onSlidingComplete={selectIndex}
        >
          <View style={styles.points}>
            {stops.map((stop, i) =>
              i === index ? null : (
                <View
                  key={stop.value}
                  style={[
                    styles.point,
                    { left: `${(i / last) * 100}%` },
                    i < index && styles.pointFilled,
                  ]}
                />
              ),
            )}
          </View>
        </Slider>
        <View style={styles.stopLabels}>
          {stops.map((stop, i) => (
            <Pressable
              key={stop.value}
              accessibilityRole="button"
              accessibilityLabel={`${label}: ${stop.label}`}
              accessibilityState={{ selected: i === index }}
              onPress={() => selectIndex(i)}
              style={({ pressed }) => [
                styles.stopLabelButton,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.stopLabel,
                  i === index && styles.stopLabelSelected,
                ]}
              >
                {stop.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  labelRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  field: {
    gap: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  label: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.medium,
    fontSize: 15,
  },
  valueBox: {
    minWidth: 64,
    height: 38,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    borderRadius: 12,
    backgroundColor: tokens.color.sunken,
  },
  value: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.medium,
    fontSize: 16,
    fontVariant: ["tabular-nums"],
  },
  points: {
    position: "absolute",
    left: THUMB_HALF,
    right: THUMB_HALF,
    height: 8,
  },
  point: {
    position: "absolute",
    width: 8,
    height: 8,
    marginLeft: -4,
    borderWidth: 2,
    borderColor: tokens.color.cardAlt,
    borderRadius: 4,
    backgroundColor: tokens.color.textTertiary,
  },
  pointFilled: {
    backgroundColor: tokens.color.onAccent,
  },
  // 라벨 중심이 각 단계의 점 아래에 오도록 양끝을 라벨 반폭만큼 내민다.
  stopLabels: {
    marginHorizontal: THUMB_HALF - STOP_LABEL_WIDTH / 2,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  stopLabelButton: {
    width: STOP_LABEL_WIDTH,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  stopLabel: {
    color: tokens.color.textMuted,
    fontFamily: tokens.font.medium,
    fontSize: 12,
    fontVariant: ["tabular-nums"],
  },
  stopLabelSelected: {
    color: tokens.color.textPrimary,
  },
  pressed: {
    opacity: tokens.opacity.pressed,
  },
});
