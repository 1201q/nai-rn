import { ReactNode, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Pill } from "./FloatingPillHeader";
import { light } from "../screens/home/styles";

// 상세 페이지 헤더. 좌측 뒤로가기/우측 액션은 스크롤 시 배경+패딩이 생기는 pill,
// 가운데 타이틀은 스크롤 시 사라지고 위로 올리면 다시 등장한다.
// scrollY 를 안 주면(스크롤 없는 화면) rest 상태 — 버튼 투명, 타이틀 노출 고정.
export function DetailPillHeader({
  title,
  subtitle,
  scrollY,
  topInset,
  onBack,
  right,
  variant = "solid",
}: {
  title: string;
  subtitle?: string;
  scrollY?: Animated.Value;
  topInset: number;
  onBack: () => void;
  right?: ReactNode;
  variant?: "blur" | "solid";
}) {
  const fallback = useRef(new Animated.Value(0)).current;
  const sy = scrollY ?? fallback;

  const titleOpacity = sy.interpolate({
    inputRange: [0, 30],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });
  const titleTranslateY = sy.interpolate({
    inputRange: [0, 30],
    outputRange: [0, -4],
    extrapolate: "clamp",
  });

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.headerFixed,
        { height: topInset + 56, paddingTop: topInset },
      ]}
    >
      <View pointerEvents="box-none" style={styles.row}>
        <Pill scrollY={sy} variant={variant} circle onPress={onBack}>
          <View style={styles.iconBox}>
            <Ionicons name="chevron-back" size={22} color={light.textPrimary} />
          </View>
        </Pill>

        <Animated.View
          pointerEvents="none"
          style={[
            styles.center,
            { opacity: titleOpacity, transform: [{ translateY: titleTranslateY }] },
          ]}
        >
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </Animated.View>

        {right ? (
          <Pill scrollY={sy} variant={variant} circle>
            {right}
          </Pill>
        ) : (
          <View style={styles.spacer} />
        )}
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
    paddingHorizontal: 16,
  },
  // 좌우 pill(56폭) 침범 방지용 여백 확보.
  center: {
    position: "absolute",
    left: 56,
    right: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: light.textPrimary,
  },
  subtitle: {
    marginTop: -1,
    fontSize: 12,
    fontWeight: "700",
    color: light.textHint,
  },
  spacer: {
    width: 46,
  },
  // pillHeader 와 동일: 콘텐츠 30, Pill(minHeight 46)+패딩 8 → 스크롤 시 46 원형.
  iconBox: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
});
