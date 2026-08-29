import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { tokens } from "../../styles/tokens";

export type GenerationSheet = "settings" | "history" | "prompt";
export type PromptSheetStage = "half" | "full";

type PromptTab = "prompt" | "reference" | "chunks";

const SHEET_EASING = [0.32, 0.72, 0, 1] as const;
const PROMPT_TABS: Array<{ key: PromptTab; label: string }> = [
  { key: "prompt", label: "Prompt" },
  { key: "reference", label: "Reference Images" },
  { key: "chunks", label: "Chunks" },
];

function SheetHandle() {
  return (
    <View style={styles.handleArea}>
      <View style={styles.handle} />
    </View>
  );
}

function Scrim({ onPress }: { onPress: () => void }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [opacity]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="시트 닫기"
        onPress={onPress}
        style={styles.scrim}
      />
    </Animated.View>
  );
}

function EmptyMainSheet({
  title,
  onClose,
}: {
  title: "Settings" | "History";
  onClose: () => void;
}) {
  const translateY = useRef(new Animated.Value(96)).current;

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: 0,
      duration: 300,
      easing: Easing.bezier(...SHEET_EASING),
      useNativeDriver: true,
    }).start();
  }, [translateY]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderGrant: () => translateY.stopAnimation(),
        onPanResponderMove: (_, gesture) => {
          translateY.setValue(Math.max(0, gesture.dy));
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > 80) {
            onClose();
            return;
          }
          Animated.timing(translateY, {
            toValue: 0,
            duration: 220,
            easing: Easing.bezier(...SHEET_EASING),
            useNativeDriver: true,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.timing(translateY, {
            toValue: 0,
            duration: 220,
            easing: Easing.bezier(...SHEET_EASING),
            useNativeDriver: true,
          }).start();
        },
      }),
    [onClose, translateY],
  );

  const opacity = translateY.interpolate({
    inputRange: [0, 96],
    outputRange: [1, 0.3],
    extrapolate: "clamp",
  });

  return (
    <Animated.View
      style={[
        styles.mainSheet,
        { opacity, transform: [{ translateY }] },
      ]}
    >
      <View {...panResponder.panHandlers}>
        <SheetHandle />
      </View>
      <View style={styles.mainSheetHeader}>
        <Text style={styles.mainSheetTitle}>{title}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${title} 닫기`}
          hitSlop={4}
          onPress={onClose}
          style={({ pressed }) => [
            styles.closeButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="close" size={21} color={tokens.color.textPrimary} />
        </Pressable>
      </View>
      <View style={styles.divider} />
      <View style={styles.emptyBody} />
    </Animated.View>
  );
}

function EmptyPromptSheet({
  stage,
  onStageChange,
  onClose,
}: {
  stage: PromptSheetStage;
  onStageChange: (stage: PromptSheetStage) => void;
  onClose: () => void;
}) {
  const { height: windowHeight } = useWindowDimensions();
  const [tab, setTab] = useState<PromptTab>("prompt");
  const top = useRef(new Animated.Value(windowHeight)).current;
  const dragStartTop = useRef(windowHeight);
  const targetTop = stage === "full" ? 70 : 400;

  useEffect(() => {
    Animated.timing(top, {
      toValue: targetTop,
      duration: 300,
      easing: Easing.bezier(...SHEET_EASING),
      useNativeDriver: false,
    }).start();
  }, [targetTop, top, windowHeight]);

  const settleAtStage = useCallback(
    (nextStage: PromptSheetStage) => {
      const nextTop = nextStage === "full" ? 70 : 400;
      if (nextStage !== stage) {
        onStageChange(nextStage);
        return;
      }
      Animated.timing(top, {
        toValue: nextTop,
        duration: 220,
        easing: Easing.bezier(...SHEET_EASING),
        useNativeDriver: false,
      }).start();
    },
    [onStageChange, stage, top],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderGrant: () => {
          top.stopAnimation((value) => {
            dragStartTop.current = value;
          });
        },
        onPanResponderMove: (_, gesture) => {
          const nextTop = Math.min(
            windowHeight - 60,
            Math.max(30, dragStartTop.current + gesture.dy),
          );
          top.setValue(nextTop);
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy < -60) {
            settleAtStage("full");
            return;
          }
          if (gesture.dy > 60) {
            if (stage === "full") {
              settleAtStage("half");
            } else {
              onClose();
            }
            return;
          }
          settleAtStage(stage);
        },
        onPanResponderTerminate: () => settleAtStage(stage),
      }),
    [onClose, settleAtStage, stage, top, windowHeight],
  );

  return (
    <Animated.View style={[styles.promptSheet, { top }]}>
      <View {...panResponder.panHandlers}>
        <SheetHandle />
      </View>
      <View style={styles.promptHeader}>
        <View style={styles.promptTabs}>
          {PROMPT_TABS.map((item) => {
            const active = item.key === tab;
            return (
              <Pressable
                key={item.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => setTab(item.key)}
                style={({ pressed }) => [
                  styles.promptTab,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.promptTabLabel,
                    active && styles.promptTabLabelActive,
                  ]}
                >
                  {item.label}
                </Text>
                <View
                  style={[
                    styles.promptTabIndicator,
                    active && styles.promptTabIndicatorActive,
                  ]}
                />
              </Pressable>
            );
          })}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Prompt 닫기"
          hitSlop={4}
          onPress={onClose}
          style={({ pressed }) => [
            styles.promptCloseButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name="chevron-down"
            size={19}
            color={tokens.color.textPrimary}
          />
        </Pressable>
      </View>
      <View style={styles.emptyBody} />
    </Animated.View>
  );
}

export function GenerationSheetHost({
  sheet,
  promptStage,
  onPromptStageChange,
  onClose,
}: {
  sheet: GenerationSheet | null;
  promptStage: PromptSheetStage;
  onPromptStageChange: (stage: PromptSheetStage) => void;
  onClose: () => void;
}) {
  if (!sheet) return null;

  return (
    <View pointerEvents="box-none" style={styles.sheetHost}>
      <Scrim onPress={onClose} />
      {sheet === "prompt" ? (
        <EmptyPromptSheet
          stage={promptStage}
          onStageChange={onPromptStageChange}
          onClose={onClose}
        />
      ) : (
        <EmptyMainSheet
          key={sheet}
          title={sheet === "settings" ? "Settings" : "History"}
          onClose={onClose}
        />
      )}
    </View>
  );
}

export function PromptStrip({
  preview,
  onOpen,
}: {
  preview: string;
  onOpen: (stage: PromptSheetStage) => void;
}) {
  const dragging = useRef(false);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          gesture.dy < -8 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderGrant: () => {
          dragging.current = true;
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy <= -220) {
            onOpen("full");
          } else if (gesture.dy <= -40) {
            onOpen("half");
          }
          setTimeout(() => {
            dragging.current = false;
          }, 0);
        },
        onPanResponderTerminate: () => {
          dragging.current = false;
        },
      }),
    [onOpen],
  );

  return (
    <View {...panResponder.panHandlers} style={styles.promptStrip}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Prompt 열기"
        onPress={() => {
          if (!dragging.current) onOpen("half");
        }}
        style={({ pressed }) => [
          styles.promptStripPressable,
          pressed && styles.pressed,
        ]}
      >
        <SheetHandle />
        <View style={styles.promptStripContent}>
          <Text numberOfLines={1} style={styles.promptPreview}>
            {preview.trim() || "Prompt를 입력하세요"}
          </Text>
          <Ionicons
            name="chevron-up"
            size={17}
            color={tokens.color.textSecondary}
          />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  sheetHost: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 70,
    elevation: 70,
  },
  scrim: {
    flex: 1,
    backgroundColor: "rgba(10,10,12,0.62)",
  },
  mainSheet: {
    position: "absolute",
    top: 56,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: "hidden",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: tokens.color.cardAlt,
    zIndex: 80,
    elevation: 80,
    shadowColor: "#000000",
    shadowOpacity: 0.55,
    shadowRadius: 44,
    shadowOffset: { width: 0, height: -18 },
  },
  handleArea: {
    height: 17,
    paddingTop: 9,
    alignItems: "center",
  },
  handle: {
    width: 38,
    height: 5,
    borderRadius: 3,
    backgroundColor: tokens.color.borderSubtleStrong,
  },
  mainSheetHeader: {
    height: 52,
    paddingLeft: 20,
    paddingRight: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  mainSheetTitle: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.bold,
    fontSize: 23,
    letterSpacing: -0.3,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.raised,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: tokens.color.borderSubtle,
  },
  emptyBody: {
    flex: 1,
  },
  promptSheet: {
    position: "absolute",
    right: 0,
    bottom: 0,
    left: 0,
    overflow: "hidden",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: tokens.color.cardAlt,
    zIndex: 80,
    elevation: 80,
    shadowColor: "#000000",
    shadowOpacity: 0.55,
    shadowRadius: 44,
    shadowOffset: { width: 0, height: -18 },
  },
  promptHeader: {
    height: 47,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "stretch",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.color.borderSubtle,
  },
  promptTabs: {
    flex: 1,
    flexDirection: "row",
    overflow: "hidden",
  },
  promptTab: {
    minWidth: 0,
    paddingHorizontal: 9,
    justifyContent: "center",
  },
  promptTabLabel: {
    color: tokens.color.textMuted,
    fontFamily: tokens.font.semibold,
    fontSize: 13,
  },
  promptTabLabelActive: {
    color: tokens.color.textPrimary,
  },
  promptTabIndicator: {
    position: "absolute",
    right: 9,
    bottom: 0,
    left: 9,
    height: 2,
    backgroundColor: "transparent",
  },
  promptTabIndicatorActive: {
    backgroundColor: tokens.color.accent,
  },
  promptCloseButton: {
    width: 34,
    height: 34,
    marginTop: 6,
    marginLeft: 4,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.raised,
  },
  promptStrip: {
    position: "absolute",
    right: 0,
    bottom: 72,
    left: 0,
    height: 56,
    overflow: "hidden",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: tokens.color.cardAlt,
    zIndex: 60,
    elevation: 60,
    shadowColor: "#000000",
    shadowOpacity: 0.55,
    shadowRadius: 44,
    shadowOffset: { width: 0, height: -18 },
  },
  promptStripPressable: {
    flex: 1,
    paddingBottom: 14,
  },
  promptStripContent: {
    flex: 1,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  promptPreview: {
    flex: 1,
    color: tokens.color.textSecondary,
    fontFamily: tokens.font.regular,
    fontSize: 15,
  },
  pressed: {
    opacity: 0.65,
  },
});
