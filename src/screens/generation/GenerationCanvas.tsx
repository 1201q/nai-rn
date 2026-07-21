import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
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

import {
  useAppSheet,
  useAppSheetOpen,
} from "../../context/AppSheetContext";
import { resolveGenerationImageUri } from "../../lib/generationHistory";
import {
  getI2IEffectiveResolution,
  useGenerationStore,
} from "../../store/generationStore";
import { monoFont, tokens } from "../../styles/tokens";
import { ImagePreviewModal } from "../../components/image-preview/ImagePreviewModal";

const TOOLBAR_COLLAPSED_WIDTH = 42;
const TOOLBAR_EXPANDED_WIDTH = 260;
const MAIN_IMAGE_BLUR_RADIUS = 28;
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
  const isSheetOpen = useAppSheetOpen();
  const [expanded, setExpanded] = useState(true);
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [canvasSize, setCanvasSize] = useState<Size>({ width: 0, height: 0 });
  const [loadedImage, setLoadedImage] = useState<{
    uri: string;
    aspectRatio: number;
  } | null>(null);
  const [toolbarAnimation] = useState(() => new Animated.Value(1));
  const previewAnimation = useRef(new Animated.Value(0)).current;

  const currentImageUri = currentGeneration
    ? resolveGenerationImageUri(currentGeneration)
    : null;
  const displayedImageUri = streamingPreviewUri ?? currentImageUri;
  const imageSource = useMemo(
    () => (displayedImageUri ? { uri: displayedImageUri } : undefined),
    [displayedImageUri],
  );
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
  const canOpenImagePreview =
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

  function openImagePreview() {
    if (!canOpenImagePreview) return;
    setIsImagePreviewOpen(true);
    previewAnimation.setValue(0);
    Animated.timing(previewAnimation, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }

  function closeImagePreview() {
    Animated.timing(previewAnimation, {
      toValue: 0,
      duration: 140,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setIsImagePreviewOpen(false);
    });
  }

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (isImagePreviewOpen && !isSheetOpen) {
          closeImagePreview();
          return true;
        }
        return false;
      },
    );
    return () => subscription.remove();
  }, [isImagePreviewOpen, isSheetOpen]);

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
      Alert.alert("저장됨", "이미지를 휴대폰 저장소에 저장했습니다.");
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
      Alert.alert("복사됨", "이미지를 클립보드에 복사했습니다.");
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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="생성 이미지 미리보기"
            accessibilityState={{ disabled: !canOpenImagePreview }}
            disabled={!canOpenImagePreview}
            onPress={openImagePreview}
            style={[styles.generatedImage, imageSize]}
          >
            <ExpoImage
              source={imageSource}
              blurRadius={mainImageBlurred ? MAIN_IMAGE_BLUR_RADIUS : 0}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={0}
              style={StyleSheet.absoluteFill}
              onLoad={handleImageLoad}
            />
          </Pressable>
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
              icon="dice-outline"
              label="시드"
              onPress={() => {}}
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

      <ImagePreviewModal
        visible={isImagePreviewOpen}
        closeButtonVariant="header"
        images={currentImageUri ? [currentImageUri] : []}
        initialIndex={0}
        animation={previewAnimation}
        onClose={closeImagePreview}
        metadataRecords={currentGeneration ? [currentGeneration] : undefined}
      />
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
    alignItems: "flex-end",
  },
  toolbar: {
    height: 42,
    overflow: "hidden",
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.overlay,
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
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
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
  },
  toolbarPressed: {
    opacity: 0.65,
  },
});
