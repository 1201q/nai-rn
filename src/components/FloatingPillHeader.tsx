import { ReactNode } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";

import { light } from "../screens/home/styles";

type Variant = "blur" | "solid";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// 스크롤 0 → 콘텐츠만, 스크롤 시작 → 패딩 자라며 배경 fade-in 하는 플로팅 pill.
function Pill({
  scrollY,
  variant,
  circle,
  onPress,
  style,
  children,
}: {
  scrollY: Animated.Value;
  variant: Variant;
  circle?: boolean;
  onPress?: () => void;
  style?: object;
  children: ReactNode;
}) {
  const opacity = scrollY.interpolate({
    inputRange: [0, 30],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  // circle: 가로/세로 패딩 동일 → 정사각 + borderRadius 로 완벽한 원
  const padH = scrollY.interpolate({
    inputRange: [0, 30],
    outputRange: [0, circle ? 8 : 14],
    extrapolate: "clamp",
  });
  const padV = scrollY.interpolate({
    inputRange: [0, 30],
    outputRange: [0, 8],
    extrapolate: "clamp",
  });

  const Container = onPress ? AnimatedPressable : Animated.View;

  return (
    <Container
      onPress={onPress}
      style={[
        styles.pill,
        style,
        { paddingHorizontal: padH, paddingVertical: padV },
      ]}
    >
      <Animated.View
        style={[
          styles.pillBg,
          variant === "solid" ? styles.pillBgSolid : styles.pillBgBlur,
          { opacity },
        ]}
      >
        {variant === "blur" ? (
          <View style={styles.pillBgClip}>
            <BlurView
              intensity={50}
              tint="light"
              style={StyleSheet.absoluteFill}
            />
          </View>
        ) : null}
      </Animated.View>
      {children}
    </Container>
  );
}

// scrollY 는 RN Animated.Value (useNativeDriver:false 로 구동).
export function FloatingPillHeader({
  title,
  titleNode,
  scrollY,
  topInset,
  left,
  right,
  rightCircle = true,
  variant = "blur",
  onTitlePress,
}: {
  title: string;
  titleNode?: ReactNode;
  scrollY: Animated.Value;
  topInset: number;
  left?: ReactNode;
  right?: ReactNode;
  rightCircle?: boolean;
  variant?: "blur" | "solid";
  onTitlePress?: () => void;
}) {
  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.headerFixed,
        { height: topInset + 56, paddingTop: topInset },
      ]}
    >
      <View pointerEvents="box-none" style={styles.row}>
        <View pointerEvents="box-none" style={styles.leftGroup}>
          {left}
          <Pill
            scrollY={scrollY}
            variant={variant}
            onPress={onTitlePress}
            style={{ marginLeft: left ? 8 : 16 }}
          >
            {titleNode ?? <Text style={styles.headerTitle}>{title}</Text>}
          </Pill>
        </View>
        {right ? (
          <Pill
            scrollY={scrollY}
            variant={variant}
            circle={rightCircle}
            style={styles.rightPill}
          >
            {right}
          </Pill>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerFixed: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    justifyContent: "center",
    zIndex: 10,
    elevation: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  leftGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  rightPill: {
    marginRight: 16,
  },
  pill: {
    alignSelf: "center",
    borderRadius: 22,
    justifyContent: "center",
  },
  pillBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    shadowColor: "#000000",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  pillBgClip: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    overflow: "hidden",
  },
  pillBgBlur: {
    backgroundColor: "rgba(255,255,255,0.75)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.06)",
  },
  pillBgSolid: {
    backgroundColor: "#ffffff",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: light.textPrimary,
  },
});
