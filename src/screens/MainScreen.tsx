import { useEffect, useRef, useState } from "react";
import { Alert, Animated, BackHandler, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import { File } from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import { StatusBar } from "expo-status-bar";
import { useNavigation } from "@react-navigation/native";
import PagerView from "react-native-pager-view";

import {
  resolveGenerationImageUri,
  resolveGenerationThumbnailUri,
} from "../lib/generationHistory";
import { useGenerationStore } from "../store/generationStore";
import type { MainScreenNavigationProp } from "../navigation/types";
import { CreatePage } from "./main/CreatePage";
import { HistoryPage } from "./main/HistoryPage";
import { ImagePreviewModal } from "./main/ImagePreviewModal";
import { MainScreenHeader, type MainPageIndex } from "./main/MainScreenHeader";
import { styles } from "./main/styles";

export function MainScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<MainScreenNavigationProp>();
  // 옵션 화면 위에 push 돼도 마운트 유지되므로, 쓰는 슬라이스만 구독해
  // steps/cfg/seed 등 무관한 변경에 재렌더되지 않게 한다.
  const prompt = useGenerationStore((s) => s.prompt);
  const currentGeneration = useGenerationStore((s) => s.currentGeneration);
  const generationHistory = useGenerationStore((s) => s.generationHistory);
  const isLoading = useGenerationStore((s) => s.isLoading);
  const message = useGenerationStore((s) => s.message);
  const generateImage = useGenerationStore((s) => s.generateImage);
  const currentImageUri = currentGeneration
    ? resolveGenerationImageUri(currentGeneration)
    : null;

  const mainPagerRef = useRef<PagerView>(null);
  const previewAnimation = useRef(new Animated.Value(0)).current;
  const [mainPageIndex, setMainPageIndex] = useState<MainPageIndex>(0);
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
  const [isSavingImage, setIsSavingImage] = useState(false);
  const [isCopyingImage, setIsCopyingImage] = useState(false);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [previewInitialIndex, setPreviewInitialIndex] = useState(0);

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

  function openImagePreview() {
    if (!currentImageUri) return;
    setPreviewImages([currentImageUri]);
    setPreviewInitialIndex(0);
    setIsImagePreviewOpen(true);
    previewAnimation.setValue(0);
    Animated.timing(previewAnimation, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }

  function openHistoryImagePreview(index: number) {
    setPreviewImages(generationHistory.map(resolveGenerationImageUri));
    setPreviewInitialIndex(index);
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

  function handleGenerate() {
    if (!prompt.trim()) {
      navigation.navigate("Option");
      return;
    }
    generateImage();
  }

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

  function selectMainPage(index: MainPageIndex) {
    setMainPageIndex(index);
    mainPagerRef.current?.setPage(index);
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <MainScreenHeader
        activeIndex={mainPageIndex}
        onSelect={selectMainPage}
        onOpenSettings={() => navigation.navigate("Settings")}
        onOpenAssistant={() => navigation.navigate("Assistant")}
      />

      <PagerView
        ref={mainPagerRef}
        style={styles.pager}
        initialPage={0}
        onPageSelected={(event) =>
          setMainPageIndex(event.nativeEvent.position as MainPageIndex)
        }
      >
        <View key="create" style={styles.page}>
          <CreatePage
            currentGeneration={currentGeneration}
            currentImageUri={currentImageUri}
            message={message}
            isLoading={isLoading}
            isSavingImage={isSavingImage}
            isCopyingImage={isCopyingImage}
            onOpenImagePreview={openImagePreview}
            onSaveImage={handleSaveImage}
            onCopyImage={handleCopyImage}
            onOpenOptions={() => navigation.navigate("Option")}
            onOpenBottomSheet={() => navigation.navigate("ImageSetting")}
            onGenerate={handleGenerate}
          />
        </View>

        <View key="history" style={styles.page}>
          <HistoryPage
            images={generationHistory}
            resolveImageUri={resolveGenerationImageUri}
            resolveThumbnailUri={resolveGenerationThumbnailUri}
            onImagePress={openHistoryImagePreview}
          />
        </View>
      </PagerView>

      <ImagePreviewModal
        visible={isImagePreviewOpen}
        images={previewImages}
        initialIndex={previewInitialIndex}
        animation={previewAnimation}
        onClose={closeImagePreview}
      />
    </View>
  );
}
