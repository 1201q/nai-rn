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
import Svg, { Circle } from "react-native-svg";

import { getImagePromptTokenPolicy } from "../../constants/generation";
import { usePromptTokenMetrics } from "../../hooks/usePromptTokenMetrics";
import type { PromptTokenTarget } from "../../lib/promptTokens/metrics";
import { useGenerationStore } from "../../store/generationStore";
import { tokens } from "../../styles/tokens";
import {
  formatPromptTokenTooltip,
  getPromptTokenCounterColor,
  getPromptTokenFieldProgress,
  getPromptTokenProgress,
} from "./promptTokenPresentation";

type AnchorRect = { x: number; y: number; width: number; height: number };

const RING_SIZE = 24;
const RING_STROKE_WIDTH = 2.5;
const RING_RADIUS = (RING_SIZE - RING_STROKE_WIDTH) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

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
  const totalProgress = getPromptTokenProgress(metrics);
  const fieldProgress = getPromptTokenFieldProgress(metrics);

  const counterText =
    metrics.status === "ready"
      ? `${metrics.totalTokens} / ${metrics.maxTokens}`
      : metrics.status === "loading" && metrics.maxTokens !== null
        ? `— / ${metrics.maxTokens}`
        : "계산 불가";
  const accessibilityLabel =
    metrics.status === "ready"
      ? `프롬프트 토큰 사용량, 현재 입력 ${metrics.fieldTokens}, 다른 프롬프트 ${Math.max(
          0,
          (metrics.totalTokens ?? 0) -
            (metrics.includedInTotal ? (metrics.fieldTokens ?? 0) : 0),
        )}, 전체 ${counterText}`
      : `프롬프트 토큰 사용량 ${counterText}`;

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
        accessibilityLabel={accessibilityLabel}
        accessibilityHint="남은 토큰 정보를 표시합니다"
        hitSlop={8}
        onPress={toggleTooltip}
        style={({ pressed }) => [
          styles.counter,
          style,
          pressed && styles.counterPressed,
        ]}
      >
        <View style={styles.ringContainer}>
          <Svg
            accessible={false}
            width={RING_SIZE}
            height={RING_SIZE}
            viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
          >
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              fill="none"
              stroke={tokens.color.borderSubtleStrong}
              strokeWidth={RING_STROKE_WIDTH}
            />
            {totalProgress > 0 ? (
              <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                fill="none"
                stroke={tokens.color.textMuted}
                strokeWidth={RING_STROKE_WIDTH}
                strokeLinecap="round"
                strokeDasharray={`${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
                strokeDashoffset={RING_CIRCUMFERENCE * (1 - totalProgress)}
                transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
              />
            ) : null}
            {fieldProgress > 0 ? (
              <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                fill="none"
                stroke={counterColor}
                strokeWidth={RING_STROKE_WIDTH}
                strokeLinecap="round"
                strokeDasharray={`${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
                strokeDashoffset={RING_CIRCUMFERENCE * (1 - fieldProgress)}
                transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
              />
            ) : null}
          </Svg>
          {metrics.status === "error" || metrics.status === "unavailable" ? (
            <Text style={styles.ringUnavailable}>-</Text>
          ) : null}
        </View>
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
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  counterPressed: {
    opacity: 0.6,
  },
  ringContainer: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  ringUnavailable: {
    position: "absolute",
    color: tokens.color.textMuted,
    fontFamily: tokens.font.medium,
    fontSize: tokens.type["3xs"],
    lineHeight: 13,
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
