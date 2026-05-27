import { useEffect, useRef, useState } from "react";
import { Animated, BackHandler, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useNavigation } from "@react-navigation/native";
import PagerView from "react-native-pager-view";

import { useGenerationOptions } from "../context/GenerationOptionsContext";
import type { MainScreenNavigationProp } from "../navigation/types";
import { CreatePage } from "./main/CreatePage";
import { HistoryPage } from "./main/HistoryPage";
import { ImagePreviewModal } from "./main/ImagePreviewModal";
import { MainScreenHeader, type MainPageIndex } from "./main/MainScreenHeader";
import { styles } from "./main/styles";

export function MainScreen() {
  const navigation = useNavigation<MainScreenNavigationProp>();
  const {
    prompt,
    currentGeneration,
    currentImageUri,
    generationHistory,
    resolveGenerationImageUri,
    resolveGenerationThumbnailUri,
    isLoading,
    message,
    setMessage,
    generateImage,
    storedToken,
    saveToken,
  } = useGenerationOptions();

  const mainPagerRef = useRef<PagerView>(null);
  const previewAnimation = useRef(new Animated.Value(0)).current;
  const [mainPageIndex, setMainPageIndex] = useState<MainPageIndex>(0);
  const [tokenInput, setTokenInput] = useState("");
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
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

  async function handleSaveToken() {
    const token = tokenInput.trim();
    if (!token) {
      setMessage("Enter a token.");
      return;
    }
    await saveToken(token);
    setTokenInput("");
    setMessage("Token saved.");
  }

  function handleGenerate() {
    if (!prompt.trim()) {
      navigation.navigate("Option");
      return;
    }
    generateImage();
  }

  function selectMainPage(index: MainPageIndex) {
    setMainPageIndex(index);
    mainPagerRef.current?.setPage(index);
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <MainScreenHeader activeIndex={mainPageIndex} onSelect={selectMainPage} />

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
            storedToken={storedToken}
            tokenInput={tokenInput}
            setTokenInput={setTokenInput}
            isLoading={isLoading}
            onOpenImagePreview={openImagePreview}
            onSaveToken={handleSaveToken}
            onOpenOptions={() => navigation.navigate("Option")}
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
