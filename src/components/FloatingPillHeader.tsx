import { ReactNode } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";

import { light } from "../screens/home/styles";

// 스크롤 0 → 텍스트만, 스크롤 시작 → 패딩 자라며 blur pill 배경 fade-in.
// scrollY 는 RN Animated.Value (useNativeDriver:false 로 구동).
export function FloatingPillHeader({
  title,
  scrollY,
  topInset,
  left,
  variant = "blur",
}: {
  title: string;
  scrollY: Animated.Value;
  topInset: number;
  left?: ReactNode;
  variant?: "blur" | "solid";
}) {
  const pillOpacity = scrollY.interpolate({
    inputRange: [0, 30],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const pillPadH = scrollY.interpolate({
    inputRange: [0, 30],
    outputRange: [0, 14],
    extrapolate: "clamp",
  });
  const pillPadV = scrollY.interpolate({
    inputRange: [0, 30],
    outputRange: [0, 8],
    extrapolate: "clamp",
  });

  return (
    <View
      pointerEvents="box-none"
      style={[styles.headerFixed, { height: topInset + 56, paddingTop: topInset }]}
    >
      <View pointerEvents="box-none" style={styles.row}>
        {left}
        <Animated.View
          style={[
            styles.pill,
            { marginLeft: left ? 8 : 16 },
            { paddingHorizontal: pillPadH, paddingVertical: pillPadV },
          ]}
        >
          <Animated.View
            style={[
              styles.pillBg,
              variant === "solid" ? styles.pillBgSolid : styles.pillBgBlur,
              { opacity: pillOpacity },
            ]}
          >
            {variant === "blur" ? (
              <BlurView
                intensity={50}
                tint="light"
                style={StyleSheet.absoluteFill}
              />
            ) : null}
          </Animated.View>
          <Text style={styles.headerTitle}>{title}</Text>
        </Animated.View>
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
  },
  pill: {
    alignSelf: "flex-start",
    borderRadius: 22,
    justifyContent: "center",
  },
  pillBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
  },
  pillBgBlur: {
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.55)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.06)",
  },
  pillBgSolid: {
    backgroundColor: "#ffffff",
    shadowColor: "#000000",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: light.textPrimary,
  },
});
