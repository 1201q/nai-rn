import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  Image as ReactNativeImage,
  Pressable,
  TouchableOpacity,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { File } from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import { Image as ExpoImage } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";

import { resolveGenerationImageUri } from "../../lib/generationHistory";
import {
  getI2IEffectiveResolution,
  useGenerationStore,
} from "../../store/generationStore";
import { ImagePreviewModal } from "../main/ImagePreviewModal";
import { light, styles } from "./styles";

const IMAGE_SLOT_HORIZONTAL_PADDING = 32;
const IMAGE_SLOT_VERTICAL_PADDING = 24;

export function ImageArea() {
  const currentGeneration = useGenerationStore((s) => s.currentGeneration);
  const isLoading = useGenerationStore((s) => s.isLoading);
  const resolution = useGenerationStore((s) => s.resolution);
  const i2iSourceImage = useGenerationStore((s) => s.i2iSourceImage);
  const streamingPreviewUri = useGenerationStore((s) => s.streamingPreviewUri);
  const currentImageUri = currentGeneration
    ? resolveGenerationImageUri(currentGeneration)
    : null;
  const displayedImageUri =
    streamingPreviewUri ?? (isLoading ? null : currentImageUri);
  const isStreamingPreview = Boolean(streamingPreviewUri || isLoading);
  const imageSource = useMemo(
    () => (displayedImageUri ? { uri: displayedImageUri } : undefined),
    [displayedImageUri],
  );
  const streamingResolution = i2iSourceImage
    ? getI2IEffectiveResolution(i2iSourceImage)
    : resolution;
  const generationAspect = isStreamingPreview
    ? streamingResolution.width / streamingResolution.height
    : currentGeneration
      ? currentGeneration.width / currentGeneration.height
      : 16 / 9;

  const previewAnimation = useRef(new Animated.Value(0)).current;
  const slotWidth = useSharedValue(0);
  const slotHeight = useSharedValue(0);
  const [imageAspect, setImageAspect] = useState(generationAspect);
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
  const [isSavingImage, setIsSavingImage] = useState(false);
  const [isCopyingImage, setIsCopyingImage] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setImageAspect(generationAspect);

    if (!displayedImageUri || isStreamingPreview) return;

    ReactNativeImage.getSize(
      displayedImageUri,
      (width, height) => {
        if (!cancelled && width > 0 && height > 0) {
          setImageAspect(width / height);
        }
      },
      () => {},
    );

    return () => {
      cancelled = true;
    };
  }, [displayedImageUri, generationAspect, isStreamingPreview]);

  function openImagePreview() {
    if (!currentImageUri || isStreamingPreview) return;
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
        if (isImagePreviewOpen) {
          closeImagePreview();
          return true;
        }
        return false;
      },
    );
    return () => subscription.remove();
  }, [isImagePreviewOpen]);

  async function handleSaveImage() {
    if (!currentImageUri || isSavingImage) return;

    try {
      setIsSavingImage(true);
      const permission = await MediaLibrary.requestPermissionsAsync(true, [
        "photo",
      ]);

      if (!permission.granted) {
        Alert.alert("저장 실패", "사진 저장 권한이 필요합니다.");
        return;
      }

      await MediaLibrary.saveToLibraryAsync(currentImageUri);
      Alert.alert("저장됨", "이미지를 휴대폰 저장소에 저장했습니다.");
    } catch {
      Alert.alert("저장 실패", "이미지를 휴대폰 저장소에 저장하지 못했습니다.");
    } finally {
      setIsSavingImage(false);
    }
  }

  async function handleCopyImage() {
    if (!currentImageUri || isCopyingImage) return;

    try {
      setIsCopyingImage(true);
      const base64Image = await new File(currentImageUri).base64();
      await Clipboard.setImageAsync(base64Image);
      Alert.alert("복사됨", "이미지를 클립보드에 복사했습니다.");
    } catch {
      Alert.alert("복사 실패", "이미지를 클립보드에 복사하지 못했습니다.");
    } finally {
      setIsCopyingImage(false);
    }
  }

  // 사용 가능한 슬롯 안에 비율 유지한 채 꽉 채워 넣되, 가로·세로 모두 넘지 않게
  // 맞춤 → 세로로 긴 이미지도 잘리거나 스크롤 없이 한눈에.
  const imageCardStyle = useAnimatedStyle(() => {
    const availableWidth = Math.max(
      0,
      slotWidth.value - IMAGE_SLOT_HORIZONTAL_PADDING,
    );
    const availableHeight = Math.max(
      0,
      slotHeight.value - IMAGE_SLOT_VERTICAL_PADDING,
    );

    if (availableWidth <= 0 || availableHeight <= 0) {
      return { width: 0, height: 0, opacity: 0 };
    }

    let width = availableWidth;
    let height = width / imageAspect;
    if (height > availableHeight) {
      height = availableHeight;
      width = height * imageAspect;
    }

    return { width, height, opacity: 1 };
  }, [imageAspect]);

  return (
    <>
      <View
        style={styles.imageSlot}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          if (Math.abs(slotWidth.value - width) >= 1) {
            slotWidth.value = width;
          }
          if (Math.abs(slotHeight.value - height) >= 1) {
            slotHeight.value = height;
          }
        }}
      >
        <Reanimated.View style={[styles.imageCard, imageCardStyle]}>
          {displayedImageUri ? (
            <Pressable
              style={styles.generatedImage}
              onPress={openImagePreview}
              disabled={isStreamingPreview}
            >
              <ExpoImage
                source={imageSource}
                contentFit="contain"
                cachePolicy="memory-disk"
                transition={0}
                style={styles.generatedImage}
              />
            </Pressable>
          ) : null}
          {isLoading && !displayedImageUri ? (
            <ActivityIndicator color={light.textPrimary} size="large" />
          ) : null}
          {currentImageUri && !isStreamingPreview ? (
            <View style={styles.imageOverlayRow}>
              <TouchableOpacity
                style={styles.imageOverlayButton}
                activeOpacity={0.82}
                onPress={handleSaveImage}
                disabled={isSavingImage}
              >
                {isSavingImage ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Ionicons
                    name="arrow-down-outline"
                    size={20}
                    color="#ffffff"
                  />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.imageOverlayButton}
                activeOpacity={0.82}
                onPress={handleCopyImage}
                disabled={isCopyingImage}
              >
                {isCopyingImage ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Ionicons name="copy-outline" size={20} color="#ffffff" />
                )}
              </TouchableOpacity>
            </View>
          ) : null}
        </Reanimated.View>
      </View>

      <ImagePreviewModal
        visible={isImagePreviewOpen}
        images={currentImageUri ? [currentImageUri] : []}
        initialIndex={0}
        animation={previewAnimation}
        onClose={closeImagePreview}
      />
    </>
  );
}
