import { Animated, StyleSheet, Text, View } from "react-native";

import { IconButton } from "./Buttons";
import { ScreenEdgeFade } from "./ScreenEdgeFade";
import { tokens } from "../../styles/tokens";

export const DETAIL_HEADER_TOP_OFFSET = 8;
export const DETAIL_FIXED_HEADER_CONTENT_OFFSET = 72;
export const DETAIL_SCROLL_TITLE_HEIGHT = 110;

export function DetailScrollTitle({
  title,
  scrollY,
}: {
  title: string;
  scrollY: Animated.Value;
}) {
  const opacity = scrollY.interpolate({
    inputRange: [0, 56],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  return (
    <View style={styles.scrollTitle}>
      <View style={styles.navigationSpacer} />
      <Animated.View style={[styles.largeTitleContainer, { opacity }]}>
        <Text style={styles.largeTitle}>{title}</Text>
      </Animated.View>
    </View>
  );
}

export function DetailHeaderOverlay({
  title,
  scrollY,
  topInset,
  onBack,
  onAdd,
  addLabel = "추가",
  addDisabled = false,
  onMore,
  showMore = true,
  titleAlwaysVisible = false,
}: {
  title: string;
  scrollY: Animated.Value;
  topInset: number;
  onBack?: () => void;
  onAdd?: () => void;
  addLabel?: string;
  addDisabled?: boolean;
  onMore?: () => void;
  showMore?: boolean;
  titleAlwaysVisible?: boolean;
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
        {onBack ? (
          <IconButton
            icon="chevron-back"
            label="뒤로"
            size={40}
            onPress={onBack}
          />
        ) : null}

        <Animated.View
          pointerEvents="none"
          style={[
            styles.compactTitleContainer,
            onAdd && showMore && styles.compactTitleContainerWithAdd,
            !titleAlwaysVisible && {
              opacity: compactTitleOpacity,
              transform: [{ translateY: compactTitleTranslateY }],
            },
          ]}
        >
          <Text numberOfLines={1} style={styles.compactTitle}>
            {title}
          </Text>
        </Animated.View>

        {onAdd ? (
          <IconButton
            icon="add"
            label={addLabel}
            size={40}
            disabled={addDisabled}
            onPress={onAdd}
            style={[
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
            style={styles.moreButton}
          />
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  scrollTitle: {
    height: DETAIL_SCROLL_TITLE_HEIGHT,
  },
  navigationSpacer: {
    height: 42,
  },
  largeTitleContainer: {
    height: 56,
    justifyContent: "center",
  },
  largeTitle: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.bold,
    fontSize: tokens.type["2xl"],
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
  compactTitle: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: 17,
    letterSpacing: tokens.tracking.tight,
    textAlign: "center",
  },
});
