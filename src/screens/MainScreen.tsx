import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  BackHandler,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { GestureResponderEvent } from "react-native";
import * as Clipboard from "expo-clipboard";
import { File } from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  TouchableOpacity as BottomSheetTouchableOpacity,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { useNavigation } from "@react-navigation/native";
import PagerView from "react-native-pager-view";

import { useGenerationOptions } from "../context/GenerationOptionsContext";
import type { MainScreenNavigationProp } from "../navigation/types";
import { colors } from "../styles/colors";
import { CreatePage } from "./main/CreatePage";
import { HistoryPage } from "./main/HistoryPage";
import { ImagePreviewModal } from "./main/ImagePreviewModal";
import { MainScreenHeader, type MainPageIndex } from "./main/MainScreenHeader";
import { styles } from "./main/styles";

const MAIN_SHEET_COLLAPSED_HEIGHT = 300;
const MAIN_SHEET_SNAP_POINTS = [MAIN_SHEET_COLLAPSED_HEIGHT, "92%"];
const MAIN_SHEET_TEST_BUTTONS = Array.from(
  { length: 20 },
  (_, index) => index + 1,
);
type MainSheetRoute = "home" | "test1" | "test2";

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
    generateImage,
  } = useGenerationOptions();

  const mainPagerRef = useRef<PagerView>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const isBottomSheetOpenRef = useRef(false);
  const previewAnimation = useRef(new Animated.Value(0)).current;
  const [mainPageIndex, setMainPageIndex] = useState<MainPageIndex>(0);
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
  const [isSavingImage, setIsSavingImage] = useState(false);
  const [isCopyingImage, setIsCopyingImage] = useState(false);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [previewInitialIndex, setPreviewInitialIndex] = useState(0);
  const [bottomSheetRoute, setBottomSheetRoute] =
    useState<MainSheetRoute>("home");

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (isImagePreviewOpen) {
          closeImagePreview();
          return true;
        }
        if (isBottomSheetOpenRef.current && bottomSheetRoute !== "home") {
          returnBottomSheetHome();
          return true;
        }
        if (isBottomSheetOpenRef.current) {
          bottomSheetRef.current?.close();
          return true;
        }
        return false;
      },
    );
    return () => subscription.remove();
  }, [bottomSheetRoute, isImagePreviewOpen]);

  const renderBottomSheetBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
      />
    ),
    [],
  );

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

  function openBottomSheet() {
    setBottomSheetRoute("home");
    requestAnimationFrame(() => bottomSheetRef.current?.snapToIndex(0));
  }

  function returnBottomSheetHome() {
    setBottomSheetRoute("home");
  }

  function handleBottomSheetChange(index: number) {
    isBottomSheetOpenRef.current = index >= 0;
    if (index < 0) {
      setBottomSheetRoute("home");
    }
  }

  function getBottomSheetTitle() {
    if (bottomSheetRoute === "test1") return "Test 1";
    if (bottomSheetRoute === "test2") return "Test 2";
    return "Bottom Sheet";
  }

  function keepSheetHeaderPress(event: GestureResponderEvent) {
    event.stopPropagation();
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
    <View style={styles.screen}>
      <StatusBar style="light" />
      <MainScreenHeader
        activeIndex={mainPageIndex}
        onSelect={selectMainPage}
        onOpenSettings={() => navigation.navigate("Settings")}
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
            onOpenBottomSheet={openBottomSheet}
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

      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={MAIN_SHEET_SNAP_POINTS}
        enablePanDownToClose
        backdropComponent={renderBottomSheetBackdrop}
        detached
        bottomInset={14}
        style={styles.sheetContainer}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.sheetHandle}
        enableDynamicSizing={false}
        onChange={handleBottomSheetChange}
      >
        <View
          style={styles.sheetHeader}
          onStartShouldSetResponder={() => true}
          onResponderRelease={keepSheetHeaderPress}
        >
          {bottomSheetRoute === "home" ? (
            <View style={styles.sheetHeaderSide} />
          ) : (
            <BottomSheetTouchableOpacity
              style={styles.sheetCloseButton}
              activeOpacity={0.78}
              onPress={returnBottomSheetHome}
            >
              <Ionicons
                name="chevron-back"
                size={22}
                color={colors.colorTextPrimary}
              />
            </BottomSheetTouchableOpacity>
          )}

          <Text style={[styles.sheetTitle, styles.sheetHeaderTitle]}>
            {getBottomSheetTitle()}
          </Text>

          <BottomSheetTouchableOpacity
            style={styles.sheetCloseButton}
            activeOpacity={0.78}
            onPress={() => bottomSheetRef.current?.close()}
          >
            <Ionicons
              name="close"
              size={22}
              color={colors.colorTextPrimary}
            />
          </BottomSheetTouchableOpacity>
        </View>

        <BottomSheetScrollView
          style={styles.sheetScroll}
          contentContainerStyle={[
            styles.sheetButtonGroup,
            bottomSheetRoute !== "home" && styles.sheetDetailScrollContent,
          ]}
          showsVerticalScrollIndicator={false}
        >
          {bottomSheetRoute === "home" ? (
            <>
              <BottomSheetTouchableOpacity
                style={styles.sheetNavButton}
                activeOpacity={0.78}
                onPress={() => setBottomSheetRoute("test1")}
              >
                <Text style={styles.sheetNavButtonText}>test1</Text>
              </BottomSheetTouchableOpacity>

              <BottomSheetTouchableOpacity
                style={styles.sheetNavButton}
                activeOpacity={0.78}
                onPress={() => setBottomSheetRoute("test2")}
              >
                <Text style={styles.sheetNavButtonText}>test2</Text>
              </BottomSheetTouchableOpacity>

              {MAIN_SHEET_TEST_BUTTONS.map((item) => (
                <BottomSheetTouchableOpacity
                  key={item}
                  style={styles.sheetNavButton}
                  activeOpacity={0.78}
                >
                  <Text style={styles.sheetNavButtonText}>Button {item}</Text>
                </BottomSheetTouchableOpacity>
              ))}
            </>
          ) : (
            <View style={styles.sheetDetailContent}>
              <Text style={styles.sheetDetailText}>{getBottomSheetTitle()}</Text>
            </View>
          )}
        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  );
}
