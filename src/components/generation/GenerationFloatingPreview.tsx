import { useCallback, useEffect, useMemo } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { router } from "expo-router";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Reanimated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import {
  generationImagePipeline,
  previewRequestId,
  releaseNativePreviews,
} from "../../../modules/generation-image-pipeline";
import { useGenerationChromeMetrics } from "../../hooks/useGenerationChromeMetrics";
import { usePipBackScale } from "../../hooks/usePipBackScale";
import { resolveGenerationImageUri } from "../../lib/generationHistory";
import {
  getCanvasImageRect,
  reportPipSourceRect,
  type WindowRect,
} from "../../lib/pipLayout";
import { useGenerationStore } from "../../store/generationStore";
import { tokens } from "../../styles/tokens";

const MAX_WIDTH = 180;
const MAX_HEIGHT = 200;
const EDGE = 12;
const HEADER_CLEARANCE = 64;
const MOVE_DURATION = 260;
const EASING = Easing.out(Easing.cubic);

type Corner = { right: boolean; bottom: boolean };
// 세션 동안 마지막으로 놓은 모서리를 기억한다.
let lastCorner: Corner = { right: true, bottom: true };

function fitFloating(aspectRatio: number) {
  let width = MAX_WIDTH;
  let height = width / aspectRatio;
  if (height > MAX_HEIGHT) {
    height = MAX_HEIGHT;
    width = height * aspectRatio;
  }
  return { width, height };
}

// 생성 이미지를 앱 위에 띄우는 인앱 플로팅 (Android). 시스템 PiP는 앱을 나갈 때만 쓴다.
export function GenerationFloatingPreview() {
  const isFloatingOpen = useGenerationStore((s) => s.isFloatingOpen);
  if (Platform.OS !== "android" || !isFloatingOpen) return null;
  return <FloatingPreview />;
}

function FloatingPreview() {
  const isLoading = useGenerationStore((s) => s.isLoading);
  const streamingPreviewUri = useGenerationStore((s) => s.streamingPreviewUri);
  const queueIndex = useGenerationStore((s) => s.queueIndex);
  const resolution = useGenerationStore((s) => s.resolution);
  const latest = useGenerationStore((s) => s.generationHistory[0] ?? null);
  const setFloatingOpen = useGenerationStore((s) => s.setFloatingOpen);
  const requestQueueCancel = useGenerationStore((s) => s.requestQueueCancel);
  const window = useWindowDimensions();
  const { topInset, promptCollapsedHeight } = useGenerationChromeMetrics();

  // 생성 중: 스트리밍 프리뷰 (다음 장 대기 중엔 이번 큐에서 방금 완성된 이미지).
  // 큐 종료 후: 마지막으로 완성된 이미지를 사용자가 닫을 때까지 보여준다.
  const latestUri = latest ? resolveGenerationImageUri(latest) : null;
  const imageUri = isLoading
    ? streamingPreviewUri ?? (queueIndex > 1 ? latestUri : null)
    : latestUri;
  const aspectRatio = isLoading || !latest
    ? resolution.width / resolution.height
    : latest.width / latest.height;
  const size = useMemo(() => fitFloating(aspectRatio), [aspectRatio]);

  const previewRequest = previewRequestId(imageUri);
  useEffect(() => {
    if (previewRequest) generationImagePipeline?.retainPreviews(previewRequest);
    return () => { if (previewRequest) releaseNativePreviews(previewRequest); };
  }, [previewRequest]);

  // worklet(드래그 종료)에서도 쓰도록 모서리 좌표는 숫자로 둔다.
  const leftX = EDGE;
  const rightX = window.width - size.width - EDGE;
  const topY = topInset + HEADER_CLEARANCE;
  const bottomY = window.height - size.height - promptCollapsedHeight - EDGE;
  const cornerRect = useCallback((corner: Corner): WindowRect => ({
    x: corner.right ? rightX : leftX,
    y: corner.bottom ? bottomY : topY,
    width: size.width,
    height: size.height,
  }), [bottomY, leftX, rightX, size, topY]);

  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const width = useSharedValue(0);
  const height = useSharedValue(0);
  const opacity = useSharedValue(0);
  const dragStartX = useSharedValue(0);
  const dragStartY = useSharedValue(0);
  const backScale = usePipBackScale(true);

  const settle = useCallback((corner: Corner) => {
    lastCorner = corner;
    reportPipSourceRect(cornerRect(corner));
  }, [cornerRect]);

  // 열기: 캔버스 이미지 자리에서 모서리로 줄어든다. 크기/창 크기가 바뀌면 같은 모서리로 다시 맞춘다.
  useEffect(() => {
    const target = cornerRect(lastCorner);
    const origin = opacity.value === 0 ? getCanvasImageRect() : null;
    if (origin) {
      x.value = origin.x;
      y.value = origin.y;
      width.value = origin.width;
      height.value = origin.height;
    }
    opacity.value = 1;
    const config = { duration: origin ? MOVE_DURATION : 0, easing: EASING };
    x.value = withTiming(target.x, config);
    y.value = withTiming(target.y, config);
    width.value = withTiming(target.width, config);
    height.value = withTiming(target.height, config);
    settle(lastCorner);
  }, [cornerRect, height, opacity, settle, width, x, y]);

  const close = useCallback(() => setFloatingOpen(false), [setFloatingOpen]);

  // 탭: 생성 화면으로 돌아가 캔버스 이미지 자리로 커지며 복귀한다.
  const returnToCanvas = useCallback(() => {
    if (router.canDismiss()) router.dismissAll();
    const target = getCanvasImageRect();
    if (!target) {
      close();
      return;
    }
    const config = { duration: MOVE_DURATION, easing: EASING };
    x.value = withTiming(target.x, config);
    y.value = withTiming(target.y, config);
    width.value = withTiming(target.width, config);
    height.value = withTiming(target.height, config, (finished) => {
      if (finished) runOnJS(close)();
    });
  }, [close, height, width, x, y]);

  const dismiss = useCallback(() => {
    opacity.value = withTiming(0, { duration: 160 }, (finished) => {
      if (finished) runOnJS(close)();
    });
  }, [close, opacity]);

  const windowWidth = window.width;
  const windowHeight = window.height;
  const pan = Gesture.Pan()
    .minDistance(4)
    .onBegin(() => {
      dragStartX.value = x.value;
      dragStartY.value = y.value;
    })
    .onUpdate((event) => {
      x.value = dragStartX.value + event.translationX;
      y.value = dragStartY.value + event.translationY;
    })
    .onEnd((event) => {
      // 놓는 속도까지 반영해 가장 가까운 모서리로 붙인다.
      const centerX = x.value + width.value / 2 + event.velocityX * 0.1;
      const centerY = y.value + height.value / 2 + event.velocityY * 0.1;
      const corner = { right: centerX > windowWidth / 2, bottom: centerY > windowHeight / 2 };
      x.value = withSpring(corner.right ? rightX : leftX, { velocity: event.velocityX });
      y.value = withSpring(corner.bottom ? bottomY : topY, { velocity: event.velocityY });
      runOnJS(settle)(corner);
    });
  const tap = Gesture.Tap().onEnd((_event, success) => {
    if (success) runOnJS(returnToCanvas)();
  });

  const containerStyle = useAnimatedStyle(() => ({
    left: x.value,
    top: y.value,
    width: width.value,
    height: height.value,
    opacity: opacity.value,
    transform: [{ scale: backScale.value }],
  }));

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Reanimated.View style={[styles.container, containerStyle]}>
        <GestureDetector gesture={Gesture.Race(pan, tap)}>
          <View
            accessible
            accessibilityRole="button"
            accessibilityLabel="캔버스로 돌아가기"
            onAccessibilityTap={returnToCanvas}
            style={styles.imageFrame}
          >
            {imageUri ? (
              <ExpoImage
                source={{ uri: imageUri }}
                contentFit="cover"
                cachePolicy={previewRequest ? "none" : "memory-disk"}
                transition={0}
                style={StyleSheet.absoluteFill}
              />
            ) : (
              <ActivityIndicator color={tokens.color.textPrimary} />
            )}
          </View>
        </GestureDetector>
        {isLoading ? (
          <FloatingButton
            icon="stop"
            label="생성 취소"
            onPress={requestQueueCancel}
            style={styles.cancelButton}
          />
        ) : null}
        <FloatingButton
          icon="close"
          label="PiP 닫기"
          onPress={dismiss}
          style={styles.closeButton}
        />
      </Reanimated.View>
    </View>
  );
}

function FloatingButton({
  icon,
  label,
  onPress,
  style,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  style: object;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [styles.button, style, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={14} color={tokens.color.textPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.card,
    ...tokens.shadow.floatSm,
  },
  imageFrame: {
    flex: 1,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: tokens.radius.lg,
  },
  button: {
    position: "absolute",
    top: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.scrim,
  },
  cancelButton: {
    left: 6,
  },
  closeButton: {
    right: 6,
  },
  pressed: {
    opacity: 0.65,
  },
});
