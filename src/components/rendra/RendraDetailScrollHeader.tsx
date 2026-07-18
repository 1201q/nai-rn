import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { ScreenEdgeFade } from "../ScreenEdgeFade";
import { tokens } from "../../styles/tokens";

export const RENDRA_DETAIL_HEADER_TOP_OFFSET = 8;

export function RendraDetailScrollTitle({
  title,
  scrollY,
}: {
  title: string;
  scrollY: Animated.Value;
}) {
  const opacity = scrollY.interpolate({
    inputRange: [0, 48],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  return (
    <View style={styles.titleRow}>
      <View style={styles.backButtonSpace} />
      <Animated.View style={[styles.titleContainer, { opacity }]}>
        <Text style={styles.title}>{title}</Text>
      </Animated.View>
    </View>
  );
}

export function RendraDetailHeaderOverlay({
  scrollY,
  topInset,
  onBack,
}: {
  scrollY: Animated.Value;
  topInset: number;
  onBack: () => void;
}) {
  const fadeOpacity = scrollY.interpolate({
    inputRange: [0, 24],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const backButtonBackgroundOpacity = scrollY.interpolate({
    inputRange: [0, 30],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[styles.edgeFade, { opacity: fadeOpacity }]}
      >
        <ScreenEdgeFade
          topHeight={topInset + 70}
          color={tokens.color.app}
          transparentColor="rgba(10,10,11,0)"
        />
      </Animated.View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="뒤로"
        hitSlop={6}
        onPress={onBack}
        style={({ pressed }) => [
          styles.backButton,
          { top: topInset + RENDRA_DETAIL_HEADER_TOP_OFFSET + 6 },
          pressed && styles.pressed,
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.backButtonBackground,
            { opacity: backButtonBackgroundOpacity },
          ]}
        />
        <Ionicons
          name="chevron-back"
          size={18}
          color={tokens.color.textPrimary}
        />
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  backButtonSpace: {
    width: 36,
    height: 36,
  },
  titleContainer: {
    flex: 1,
    transform: [{ translateY: -2 }],
  },
  title: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type.lg,
    letterSpacing: tokens.tracking.tight,
  },
  edgeFade: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 2,
  },
  backButton: {
    position: "absolute",
    left: tokens.space[8],
    zIndex: 3,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: tokens.radius.pill,
  },
  backButtonBackground: {
    ...StyleSheet.absoluteFill,
    borderRadius: tokens.radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.borderSubtle,
    backgroundColor: tokens.color.overlay,
    ...tokens.shadow.floatSm,
  },
  pressed: {
    opacity: 0.68,
  },
});
