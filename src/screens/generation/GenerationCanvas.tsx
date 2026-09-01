import { memo, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage, type ImageLoadEventData } from "expo-image";
import * as Clipboard from "expo-clipboard";
import { File } from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Reanimated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withTiming,
} from "react-native-reanimated";
import { toast } from "sonner-native";

import { useAppSheet } from "../../context/AppSheetContext";
import { resolveGenerationImageUri } from "../../lib/generationHistory";
import {
  getI2IEffectiveResolution,
  useGenerationStore,
} from "../../store/generationStore";
import { monoFont, tokens } from "../../styles/tokens";

const TOOLBAR_COLLAPSED_WIDTH = 42;
const TOOLBAR_EXPANDED_WIDTH = 218;
const MAIN_IMAGE_BLUR_RADIUS = 28;
const MAIN_IMAGE_MIN_SCALE = 0.5;
const MAIN_IMAGE_MAX_SCALE = 4;
const MAIN_IMAGE_DECELERATION = 0.992;
const MAIN_IMAGE_RESET_DURATION = 180;
const STRIPES = Array.from({ length: 52 }, (_, index) => index);

type Size = {
  width: number;
  height: number;
};

function fitImage(size: Size, aspectRatio: number): Size {
  if (size.width <= 0 || size.height <= 0 || aspectRatio <= 0) {
    return { width: 0, height: 0 };
  }

  let width = size.width;
  let height = width / aspectRatio;
  if (height > size.height) {
    height = size.height;
    width = height * aspectRatio;
  }

  return { width, height };
}

const StripePlaceholder = memo(function StripePlaceholder() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {STRIPES.map((stripe) => (
        <View
          key={stripe}
          style={[styles.stripe, { top: stripe * 20 - 220 }]}
        />
      ))}
      <View style={styles.placeholderLabelWrap}>
        <Text style={styles.placeholderLabel}>generated image</Text>
      </View>
    </View>
  );
});

const FreeTransformImage = memo(function FreeTransformImage({
  uri,
  size,
  viewportSize,
  blurRadius,
  enabled,
  onLoad,
}: {
  uri: string;
  size: Size;
  viewportSize: Size;
  blurRadius: number;
  enabled: boolean;
  onLoad: (event: ImageLoadEventData) => void;
}) {
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const panStartX = useSharedValue(0);
  const panStartY = useSharedValue(0);
  const pinchStartScale = useSharedValue(1);

  useEffect(() => {
    cancelAnimation(scale);
    cancelAnimation(translateX);
    cancelAnimation(translateY);
    scale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
  }, [
    scale,
    size.height,
    size.width,
    translateX,
    translateY,
    uri,
    viewportSize.height,
    viewportSize.width,
  ]);

  const panGesture = Gesture.Pan()
    .enabled(enabled)
    .maxPointers(1)
    .minDistance(1)
    .onBegin(() => {
      cancelAnimation(translateX);
      cancelAnimation(translateY);
      panStartX.value = translateX.value;
      panStartY.value = translateY.value;
    })
    .onUpdate((event) => {
      translateX.value = panStartX.value + event.translationX;
      translateY.value = panStartY.value + event.translationY;
    })
    .onEnd((event) => {
      translateX.value = withDecay({
        velocity: event.velocityX,
        deceleration: MAIN_IMAGE_DECELERATION,
      });
      translateY.value = withDecay({
        velocity: event.velocityY,
        deceleration: MAIN_IMAGE_DECELERATION,
      });
    });

  const pinchGesture = Gesture.Pinch()
    .enabled(enabled)
    .onBegin(() => {
      cancelAnimation(scale);
      cancelAnimation(translateX);
      cancelAnimation(translateY);
      pinchStartScale.value = scale.value;
    })
    .onUpdate((event) => {
      scale.value = Math.min(
        MAIN_IMAGE_MAX_SCALE,
        Math.max(MAIN_IMAGE_MIN_SCALE, pinchStartScale.value * event.scale),
      );
    });

  const doubleTapGesture = Gesture.Tap()
    .enabled(enabled)
    .numberOfTaps(2)
    .maxDuration(250)
    .onEnd((_event, success) => {
      if (!success) return;

      const hasTransform =
        Math.abs(scale.value - 1) > 0.01 ||
        Math.abs(translateX.value) > 1 ||
        Math.abs(translateY.value) > 1;
      if (hasTransform) {
        scale.value = withTiming(1, { duration: MAIN_IMAGE_RESET_DURATION });
        translateX.value = withTiming(0, {
          duration: MAIN_IMAGE_RESET_DURATION,
        });
        translateY.value = withTiming(0, {
          duration: MAIN_IMAGE_RESET_DURATION,
        });
        return;
      }

      const nextScale = 2;
      scale.value = withTiming(nextScale, {
        duration: MAIN_IMAGE_RESET_DURATION,
      });
    });

  const gesture = Gesture.Race(
    Gesture.Simultaneous(panGesture, pinchGesture),
    doubleTapGesture,
  );
  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel="생성 이미지"
        accessibilityState={{ disabled: !enabled }}
        style={styles.zoomViewport}
      >
        <Reanimated.View style={[styles.generatedImage, size, imageStyle]}>
          <ExpoImage
            source={{ uri }}
            blurRadius={blurRadius}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={0}
            style={StyleSheet.absoluteFill}
            onLoad={onLoad}
          />
        </Reanimated.View>
      </View>
    </GestureDetector>
  );
});

export function GenerationCanvas() {
  const currentGeneration = useGenerationStore((s) => s.currentGeneration);
  const streamingPreviewUri = useGenerationStore((s) => s.streamingPreviewUri);
  const isLoading = useGenerationStore((s) => s.isLoading);
  const resolution = useGenerationStore((s) => s.resolution);
  const i2iSourceImage = useGenerationStore((s) => s.i2iSourceImage);
  const i2iEnabled = useGenerationStore((s) => s.i2iEnabled);
  const mainImageBlurred = useGenerationStore((s) => s.mainImageBlurred);
  const setMainImageBlurred = useGenerationStore(
    (s) => s.setMainImageBlurred,
  );
  const { open } = useAppSheet();
  const [expanded, setExpanded] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [canvasSize, setCanvasSize] = useState<Size>({ width: 0, height: 0 });
  const [loadedImage, setLoadedImage] = useState<{
    uri: string;
    aspectRatio: number;
  } | null>(null);
  const [toolbarAnimation] = useState(() => new Animated.Value(1));

  const currentImageUri = currentGeneration
    ? resolveGenerationImageUri(currentGeneration)
    : null;
  const displayedImageUri = streamingPreviewUri ?? currentImageUri;
  const streamingResolution =
    i2iEnabled && i2iSourceImage
      ? getI2IEffectiveResolution(i2iSourceImage)
      : resolution;
  const fallbackAspectRatio = streamingPreviewUri
    ? streamingResolution.width / streamingResolution.height
    : currentGeneration
      ? currentGeneration.width / currentGeneration.height
      : resolution.width / resolution.height;
  const imageAspectRatio =
    !streamingPreviewUri && loadedImage?.uri === displayedImageUri
      ? loadedImage.aspectRatio
      : fallbackAspectRatio;
  const imageSize = useMemo(
    () => fitImage(canvasSize, imageAspectRatio),
    [canvasSize, imageAspectRatio],
  );
  const canUseImageActions = Boolean(currentImageUri) && !isLoading;
  const canTransformImage =
    Boolean(currentImageUri) && !isLoading && !streamingPreviewUri;

  function handleImageLoad(event: ImageLoadEventData) {
    if (!displayedImageUri) return;
    const { width, height } = event.source;
    if (width > 0 && height > 0) {
      setLoadedImage({
        uri: displayedImageUri,
        aspectRatio: width / height,
      });
    }
  }

  function toggleToolbar() {
    const nextExpanded = !expanded;
    setExpanded(nextExpanded);
    Animated.timing(toolbarAnimation, {
      toValue: nextExpanded ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }

  async function saveImage() {
    if (!currentImageUri || isSaving) return;
    setIsSaving(true);
    try {
      const permission = await MediaLibrary.requestPermissionsAsync(true, [
        "photo",
      ]);
      if (!permission.granted) {
        Alert.alert("저장 실패", "사진 저장 권한이 필요합니다.");
        return;
      }
      await MediaLibrary.Asset.create(currentImageUri);
      toast.success("이미지를 저장했습니다.");
    } catch {
      Alert.alert("저장 실패", "이미지를 휴대폰 저장소에 저장하지 못했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  async function copyImage() {
    if (!currentImageUri || isCopying) return;
    setIsCopying(true);
    try {
      const base64Image = await new File(currentImageUri).base64();
      await Clipboard.setImageAsync(base64Image);
    } catch {
      Alert.alert("복사 실패", "이미지를 클립보드에 복사하지 못했습니다.");
    } finally {
      setIsCopying(false);
    }
  }

  const toolbarWidth = toolbarAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [TOOLBAR_COLLAPSED_WIDTH, TOOLBAR_EXPANDED_WIDTH],
  });
  const actionOpacity = toolbarAnimation.interpolate({
    inputRange: [0.25, 1],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  return (
    <View style={styles.section}>
      <View
        style={styles.canvas}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          setCanvasSize((current) =>
            current.width === width && current.height === height
              ? current
              : { width, height },
          );
        }}
      >
        {!displayedImageUri ? (
          <View style={styles.placeholder}>
            <StripePlaceholder />
          </View>
        ) : null}
        {displayedImageUri ? (
          <FreeTransformImage
            uri={displayedImageUri}
            size={imageSize}
            viewportSize={canvasSize}
            blurRadius={mainImageBlurred ? MAIN_IMAGE_BLUR_RADIUS : 0}
            enabled={canTransformImage}
            onLoad={handleImageLoad}
          />
        ) : null}
        {isLoading && !streamingPreviewUri ? (
          <ActivityIndicator
            color={tokens.color.textPrimary}
            size="large"
            style={StyleSheet.absoluteFill}
          />
        ) : null}
      </View>

      <View style={styles.toolbarRow}>
        <Animated.View style={[styles.toolbar, { width: toolbarWidth }]}>
          <Animated.View
            pointerEvents={expanded ? "auto" : "none"}
            style={[styles.toolbarActions, { opacity: actionOpacity }]}
          >
            <ToolbarAction
              icon={mainImageBlurred ? "eye-off-outline" : "eye-outline"}
              label={
                mainImageBlurred ? "이미지 블러 해제" : "이미지 블러 적용"
              }
              active={mainImageBlurred}
              onPress={() => setMainImageBlurred(!mainImageBlurred)}
            />
            <ToolbarAction
              icon={isSaving ? undefined : "download-outline"}
              label="이미지 다운로드"
              disabled={!canUseImageActions || isSaving}
              loading={isSaving}
              onPress={saveImage}
            />
            <ToolbarAction
              icon={isCopying ? undefined : "copy-outline"}
              label="이미지 복사"
              disabled={!canUseImageActions || isCopying}
              loading={isCopying}
              onPress={copyImage}
            />
            <ToolbarAction
              icon="information-circle-outline"
              label="메타데이터 정보"
              disabled={!canUseImageActions}
              onPress={() =>
                currentGeneration && open("metadataView", currentGeneration)
              }
            />
          </Animated.View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              expanded ? "이미지 도구 접기" : "이미지 도구 펼치기"
            }
            accessibilityState={{ expanded }}
            hitSlop={4}
            onPress={toggleToolbar}
            style={({ pressed }) => [
              styles.toolbarToggle,
              pressed && styles.toolbarPressed,
            ]}
          >
            <Ionicons
              name={expanded ? "chevron-forward" : "chevron-back"}
              size={18}
              color={tokens.color.textPrimary}
            />
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const ToolbarAction = memo(function ToolbarAction({
  icon,
  label,
  onPress,
  disabled = false,
  loading = false,
  active = false,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  active?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: active }}
      disabled={disabled}
      hitSlop={2}
      onPress={onPress}
      style={({ pressed }) => [
        styles.toolbarAction,
        disabled && styles.toolbarActionDisabled,
        pressed && styles.toolbarPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={tokens.color.textPrimary} size="small" />
      ) : icon ? (
        <Ionicons
          name={icon}
          size={17}
          color={active ? tokens.color.accent : tokens.color.textPrimary}
        />
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  section: {
    flex: 1,
    minHeight: 0,
    gap: tokens.space[5],
  },
  canvas: {
    flex: 1,
    minHeight: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  zoomViewport: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholder: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: "hidden",
    borderRadius: tokens.radius["lg"],
  },
  generatedImage: {
    overflow: "hidden",
    borderRadius: tokens.radius["lg"],
  },
  stripe: {
    position: "absolute",
    left: -300,
    width: 1000,
    height: 2,
    backgroundColor: tokens.color.placeholderStripe,
    transform: [{ rotate: "-45deg" }],
  },
  placeholderLabelWrap: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderLabel: {
    color: tokens.color.textMuted,
    fontFamily: monoFont,
    fontSize: tokens.type["2xs"],
    letterSpacing: 0.4,
  },
  toolbarRow: {
    height: 42,
    marginBottom: tokens.space[4],
    alignItems: "flex-end",
  },
  toolbar: {
    height: 42,
    overflow: "hidden",
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.overlay,
    ...tokens.shadow.floatSm,
  },
  toolbarActions: {
    position: "absolute",
    left: 4,
    right: 42,
    top: 2,
    height: 36,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  toolbarAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  toolbarActionDisabled: {
    opacity: 0.35,
  },
  toolbarToggle: {
    position: "absolute",
    right: -1,
    top: -1,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.card,
  },
  toolbarPressed: {
    opacity: 0.65,
  },
});
