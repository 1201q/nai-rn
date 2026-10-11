import type { RefObject } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { IconButton } from "./Buttons";
import { GlassBackground } from "./GlassBackground";
import { ScreenEdgeFade } from "./ScreenEdgeFade";
import { tokens } from "../../styles/tokens";

export const DETAIL_HEADER_TOP_OFFSET = 8;
export const DETAIL_FIXED_HEADER_CONTENT_OFFSET = 72;

export function DetailHeaderOverlay({
  title,
  scrollY,
  topInset,
  onBack,
  onAdd,
  addLabel = "추가",
  addDisabled = false,
  onMore,
  showCompactTitle = true,
  showMore = true,
  hideCompactTitleOnScroll = false,
  blurTarget,
}: {
  title: string;
  scrollY: Animated.Value;
  topInset: number;
  onBack?: () => void;
  onAdd?: () => void;
  addLabel?: string;
  addDisabled?: boolean;
  onMore?: () => void;
  showCompactTitle?: boolean;
  showMore?: boolean;
  hideCompactTitleOnScroll?: boolean;
  // 주면 뒤로 버튼 배경이 이 BlurTargetView를 비추는 블러가 된다.
  blurTarget?: RefObject<View | null>;
}) {
  const fadeOpacity = scrollY.interpolate({
    inputRange: [20, 84],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const compactTitleOpacity = scrollY.interpolate({
    inputRange: [44, 78],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const compactTitleTranslateY = scrollY.interpolate({
    inputRange: [44, 78],
    outputRange: [4, 0],
    extrapolate: "clamp",
  });
  const compactTitleFadeOutOpacity = scrollY.interpolate({
    inputRange: [0, 72],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[styles.edgeFade, { opacity: fadeOpacity }]}
      >
        <ScreenEdgeFade
          topHeight={topInset + 92}
          color="rgba(10,10,11,0.72)"
          transparentColor="rgba(10,10,11,0)"
        />
      </Animated.View>

      <View
        pointerEvents="box-none"
        style={[
          styles.navigationBar,
          { top: topInset + DETAIL_HEADER_TOP_OFFSET },
        ]}
      >
        {onBack && blurTarget ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="뒤로"
            hitSlop={4}
            onPress={onBack}
            style={({ pressed }) => [
              styles.glassHeaderButton,
              pressed && styles.pressed,
            ]}
          >
            <GlassBackground blurTarget={blurTarget} />
            <Ionicons
              name="chevron-back"
              size={18}
              color={tokens.color.textPrimary}
            />
          </Pressable>
        ) : onBack ? (
          <IconButton
            icon="chevron-back"
            label="뒤로"
            size={40}
            onPress={onBack}
            style={styles.borderlessHeaderButton}
          />
        ) : null}

        {showCompactTitle ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.compactTitleContainer,
              onAdd && showMore && styles.compactTitleContainerWithAdd,
              hideCompactTitleOnScroll
                ? { opacity: compactTitleFadeOutOpacity }
                : {
                    opacity: compactTitleOpacity,
                    transform: [{ translateY: compactTitleTranslateY }],
                  },
            ]}
          >
            <Text numberOfLines={1} style={styles.compactTitle}>
              {title}
            </Text>
          </Animated.View>
        ) : null}

        {onAdd ? (
          <IconButton
            icon="add"
            label={addLabel}
            size={40}
            disabled={addDisabled}
            onPress={onAdd}
            style={[
              styles.borderlessHeaderButton,
              styles.addButton,
              !showMore && styles.addButtonWithoutMore,
            ]}
          />
        ) : null}

        {showMore ? (
          <IconButton
            icon="ellipsis-horizontal"
            label="더 보기"
            size={40}
            onPress={onMore}
            style={[styles.borderlessHeaderButton, styles.moreButton]}
          />
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  edgeFade: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 2,
  },
  navigationBar: {
    position: "absolute",
    left: tokens.space[8],
    right: tokens.space[8],
    zIndex: 3,
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  compactTitleContainer: {
    position: "absolute",
    top: 0,
    right: 48,
    bottom: 0,
    left: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  compactTitleContainerWithAdd: {
    right: 96,
    left: 96,
  },
  addButton: {
    position: "absolute",
    right: 48,
  },
  addButtonWithoutMore: {
    right: 0,
  },
  moreButton: {
    marginLeft: "auto",
  },
  borderlessHeaderButton: {
    borderWidth: 0,
    backgroundColor: tokens.color.card,
  },
  glassHeaderButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: tokens.radius.pill,
  },
  pressed: {
    opacity: tokens.opacity.pressed,
  },
  compactTitle: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: 17,
    letterSpacing: tokens.tracking.tight,
    textAlign: "center",
  },
});
