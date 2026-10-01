import { useEffect, useRef } from "react";
import {
  PixelRatio,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type TextStyle,
} from "react-native";
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const ROLL_DURATION_MS = 450;
// 9 → 0 경계를 넘을 때 이어서 보이도록 끝에 0을 한 번 더 둔다.
const STRIP_DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

function digitAt(value: number, place: number) {
  return Math.floor(value / 10 ** place) % 10;
}

type DigitSlotProps = {
  value: number;
  // 일의 자리 = 0. 자릿수가 바뀌어도 같은 자리가 같은 슬롯을 유지한다.
  place: number;
  height: number;
  textStyle: StyleProp<TextStyle>;
};

function DigitSlot({ value, place, height, textStyle }: DigitSlotProps) {
  const digit = digitAt(value, place);
  // 누적 위치(스트립 칸 단위). 증가는 +, 감소는 - 방향으로만 쌓인다.
  const position = useSharedValue(digit);
  const target = useRef(digit);
  const previousValue = useRef(value);

  useEffect(() => {
    const previous = previousValue.current;
    previousValue.current = value;
    const previousDigit = digitAt(previous, place);
    if (previousDigit === digit) return;

    target.current +=
      value > previous
        ? (digit - previousDigit + 10) % 10
        : -((previousDigit - digit + 10) % 10);
    position.value = withTiming(target.current, {
      duration: ROLL_DURATION_MS,
    });
  }, [value, place, digit, position]);

  const stripStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -(((position.value % 10) + 10) % 10) * height }],
  }));

  return (
    <View style={[styles.slot, { height }]}>
      <Reanimated.View style={stripStyle}>
        {STRIP_DIGITS.map((stripDigit, index) => (
          <Text key={index} style={textStyle}>
            {stripDigit}
          </Text>
        ))}
      </Reanimated.View>
    </View>
  );
}

type RollingNumberProps = {
  // 0 이상의 정수
  value: number;
  style?: StyleProp<TextStyle>;
  lineHeight: number;
};

// 값이 바뀌면 달라진 자리의 숫자만 굴린다. 증가는 위로, 감소는 아래로.
export function RollingNumber({
  value,
  style,
  lineHeight,
}: RollingNumberProps) {
  const { fontScale } = useWindowDimensions();
  const chars = value.toLocaleString().split("");
  const isDigit = (char: string) => char >= "0" && char <= "9";
  // 스트립은 height × 숫자만큼 이동하므로 Text 실제 높이가 height와 조금이라도
  // 다르면 숫자마다 오차가 쌓인다. 각 Text 높이를 같은 값으로 고정한다.
  const height = PixelRatio.roundToNearestPixel(lineHeight * fontScale);
  const textStyle = [style, styles.text, { lineHeight, height }];

  return (
    <View style={styles.row}>
      {chars.map((char, index) => {
        const fromRight = chars.length - index;
        if (!isDigit(char)) {
          return (
            <Text key={`separator-${fromRight}`} style={textStyle}>
              {char}
            </Text>
          );
        }

        const place = chars.slice(index + 1).filter(isDigit).length;
        return (
          <DigitSlot
            key={`digit-${place}`}
            value={value}
            place={place}
            height={height}
            textStyle={textStyle}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  slot: {
    overflow: "hidden",
  },
  text: {
    fontVariant: ["tabular-nums"],
  },
});
