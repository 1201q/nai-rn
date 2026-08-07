import { memo, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { getImagePromptTokenPolicy } from "../../constants/generation";
import { usePromptTokenMetrics } from "../../hooks/usePromptTokenMetrics";
import type { PromptTokenTarget } from "../../lib/promptTokens/metrics";
import { useGenerationStore } from "../../store/generationStore";
import { monoFont, tokens } from "../../styles/tokens";
import {
  formatPromptTokenTooltip,
  getPromptTokenCounterColor,
} from "./promptTokenPresentation";

type AnchorRect = { x: number; y: number; width: number; height: number };

export const PromptTokenCounter = memo(function PromptTokenCounter({
  target,
  draftText,
  style,
}: {
  target: PromptTokenTarget;
  draftText: string;
  style?: StyleProp<ViewStyle>;
}) {
  const anchorRef = useRef<View>(null);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const model = useGenerationStore((state) => state.model);
  const metrics = usePromptTokenMetrics(target, draftText);
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);
  const [tooltipHeight, setTooltipHeight] = useState(72);
  const policy = getImagePromptTokenPolicy(model);
  const visible = anchor !== null;

  const counterColor = getPromptTokenCounterColor(metrics);

  const counterText =
    metrics.status === "ready"
      ? `${metrics.totalTokens} / ${metrics.maxTokens}`
      : metrics.status === "loading" && metrics.maxTokens !== null
        ? `— / ${metrics.maxTokens}`
        : "계산 불가";

  const tooltipText = formatPromptTokenTooltip(
    metrics,
    target,
    policy?.tokenizer,
  );

  const tooltipWidth = Math.min(320, windowWidth - 32);
  const showBelow = anchor ? anchor.y - tooltipHeight - 10 < 16 : false;
  const tooltipLeft = anchor
    ? Math.max(
        16,
        Math.min(windowWidth - tooltipWidth - 16, anchor.x + anchor.width - tooltipWidth),
      )
    : 16;
  const tooltipTop = anchor
    ? showBelow
      ? Math.min(windowHeight - tooltipHeight - 16, anchor.y + anchor.height + 10)
      : Math.max(16, anchor.y - tooltipHeight - 10)
    : 16;
  const arrowLeft = anchor
    ? Math.max(
        14,
        Math.min(
          tooltipWidth - 22,
          anchor.x + anchor.width / 2 - tooltipLeft - 5,
        ),
      )
    : 14;

  function toggleTooltip() {
    if (visible) {
      setAnchor(null);
      return;
    }
    anchorRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
    });
  }

  function handleTooltipLayout(event: LayoutChangeEvent) {
    const nextHeight = event.nativeEvent.layout.height;
    if (nextHeight !== tooltipHeight) setTooltipHeight(nextHeight);
  }

  return (
    <>
      <Pressable
        ref={anchorRef}
        accessibilityRole="button"
        accessibilityLabel={`프롬프트 토큰 ${counterText}`}
        accessibilityHint="남은 토큰 정보를 표시합니다"
        hitSlop={8}
        onPress={toggleTooltip}
        style={({ pressed }) => [
          styles.counter,
          style,
          pressed && styles.counterPressed,
        ]}
      >
        <Text style={[styles.counterText, { color: counterColor }]}>
          {counterText}
        </Text>
      </Pressable>

      <Modal
        transparent
        visible={visible}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setAnchor(null)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="토큰 정보 닫기"
            style={StyleSheet.absoluteFill}
            onPress={() => setAnchor(null)}
          />
          {anchor ? (
            <View
              accessibilityViewIsModal
              onLayout={handleTooltipLayout}
              style={[
                styles.tooltip,
                {
                  top: tooltipTop,
                  left: tooltipLeft,
                  width: tooltipWidth,
                },
              ]}
            >
              <View
                style={[
                  styles.arrow,
                  showBelow ? styles.arrowTop : styles.arrowBottom,
                  { left: arrowLeft },
                ]}
              />
              <Text style={styles.tooltipText}>{tooltipText}</Text>
            </View>
          ) : null}
        </View>
      </Modal>
    </>
  );
});

const styles = StyleSheet.create({
  counter: {
    minHeight: 24,
    paddingHorizontal: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  counterPressed: {
    opacity: 0.6,
  },
  counterText: {
    fontFamily: monoFont,
    fontSize: tokens.type["2xs"],
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
  },
  modalRoot: {
    flex: 1,
  },
  tooltip: {
    position: "absolute",
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.color.borderSubtleStrong,
    backgroundColor: tokens.color.raised,
    ...tokens.shadow.floatSm,
  },
  tooltipText: {
    color: tokens.color.textSecondary,
    fontFamily: tokens.font.medium,
    fontSize: tokens.type.sm,
    lineHeight: 20,
    textAlign: "center",
  },
  arrow: {
    position: "absolute",
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
  arrowBottom: {
    bottom: -7,
    borderTopWidth: 7,
    borderTopColor: tokens.color.raised,
  },
  arrowTop: {
    top: -7,
    borderBottomWidth: 7,
    borderBottomColor: tokens.color.raised,
  },
});
