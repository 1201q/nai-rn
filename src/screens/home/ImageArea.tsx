import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  Pressable,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { File } from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import { Image as ExpoImage } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import Reanimated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";

import { resolveGenerationImageUri } from "../../lib/generationHistory";
import { useGenerationStore } from "../../store/generationStore";
import { ImagePreviewModal } from "../main/ImagePreviewModal";
import { styles } from "./styles";
import { IMAGE_MIN_SCALE, PROMPT_MAX_HEIGHT, PROMPT_MIN_HEIGHT } from "./constants";

export function ImageArea({
  inputHeight,
}: {
  inputHeight: SharedValue<number>;
}) {
  const currentGeneration = useGenerationStore((s) => s.currentGeneration);
  const currentImageUri = currentGeneration
    ? resolveGenerationImageUri(currentGeneration)
    : null;

  const previewAnimation = useRef(new Animated.Value(0)).current;
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
  const [isSavingImage, setIsSavingImage] = useState(false);
  const [isCopyingImage, setIsCopyingImage] = useState(false);

  function openImagePreview() {
    if (!currentImageUri) return;
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

  // 입력창이 커질수록 이미지를 비율 유지한 채 축소.
  // scale(transform) 이라 재레이아웃 없음 → 깜박이지 않음.
  // 세로 공간 회수는 바깥 slot 의 height 로만.
  const baseHeight = useSharedValue(0);

  const imageCardAnimStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(
          inputHeight.value,
          [PROMPT_MIN_HEIGHT, PROMPT_MAX_HEIGHT],
          [1, IMAGE_MIN_SCALE],
        ),
      },
    ],
  }));

  const imageSlotAnimStyle = useAnimatedStyle(() => {
    if (baseHeight.value === 0) return {};
    const scale = interpolate(
      inputHeight.value,
      [PROMPT_MIN_HEIGHT, PROMPT_MAX_HEIGHT],
      [1, IMAGE_MIN_SCALE],
    );
    return { height: baseHeight.value * scale };
  });

  return (
    <>
      <ScrollView
        style={styles.imageScroll}
        contentContainerStyle={styles.imageScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Reanimated.View style={[styles.imageSlot, imageSlotAnimStyle]}>
          <Reanimated.View
            onLayout={(e) => {
              baseHeight.value = e.nativeEvent.layout.height;
            }}
            style={[
              styles.imageCard,
              imageCardAnimStyle,
              currentGeneration
                ? {
                    aspectRatio:
                      currentGeneration.width / currentGeneration.height,
                  }
                : null,
            ]}
          >
            {currentImageUri ? (
              <Pressable
                style={styles.generatedImage}
                onPress={openImagePreview}
              >
                <ExpoImage
                  source={{ uri: currentImageUri }}
                  contentFit="cover"
                  transition={120}
                  style={styles.generatedImage}
                />
              </Pressable>
            ) : null}
            {currentImageUri ? (
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
        </Reanimated.View>
      </ScrollView>

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
