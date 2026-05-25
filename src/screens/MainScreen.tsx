import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useNavigation } from "@react-navigation/native";
import { Image as ExpoImage } from "expo-image";
import PagerView from "react-native-pager-view";

import { useGenerationOptions } from "../context/GenerationOptionsContext";
import type { GenerationRecord } from "../lib/generationHistory";
import { colors } from "../styles/colors";
import type { MainScreenNavigationProp } from "../navigation/types";

type MainPageIndex = 0 | 1;

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
          <View style={styles.imageStage}>
            {currentImageUri && currentGeneration ? (
              <TouchableOpacity
                activeOpacity={0.92}
                onPress={openImagePreview}
                style={[
                  styles.generatedImageWrap,
                  {
                    aspectRatio:
                      currentGeneration.width / currentGeneration.height,
                  },
                ]}
              >
                <ExpoImage
                  source={{ uri: currentImageUri }}
                  contentFit="cover"
                  transition={120}
                  style={styles.generatedImage}
                />
              </TouchableOpacity>
            ) : null}
          </View>

          {message ? <Text style={styles.message}>{message}</Text> : null}

          <View style={styles.temporaryTokenBox}>
            <Text style={styles.temporaryTokenLabel}>
              {storedToken ? "Token saved" : "Temporary token"}
            </Text>
            <View style={styles.temporaryTokenRow}>
              <TextInput
                value={tokenInput}
                onChangeText={setTokenInput}
                placeholder="NovelAI API Token"
                placeholderTextColor={colors.grey500}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                style={styles.temporaryTokenInput}
              />
              <TouchableOpacity
                style={styles.temporaryTokenButton}
                activeOpacity={0.78}
                onPress={handleSaveToken}
              >
                <Text style={styles.temporaryTokenButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={styles.optionsButton}
              activeOpacity={0.78}
              onPress={() => navigation.navigate("Option")}
            >
              <Text style={styles.optionsIcon}>Options</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.generateButton,
                isLoading && styles.disabledButton,
              ]}
              activeOpacity={0.82}
              onPress={handleGenerate}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.generateText}>Generate</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View key="history" style={styles.page}>
          <HistoryPage
            images={generationHistory}
            resolveImageUri={resolveGenerationImageUri}
            resolveThumbnailUri={resolveGenerationThumbnailUri}
          />
        </View>
      </PagerView>

      <Modal
        visible={isImagePreviewOpen}
        transparent
        animationType="fade"
        onRequestClose={closeImagePreview}
      >
        <Animated.View
          style={[styles.previewBackdrop, { opacity: previewAnimation }]}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.previewPressArea}
            onPress={closeImagePreview}
          >
            {currentImageUri ? (
              <Animated.Image
                source={{ uri: currentImageUri }}
                resizeMode="contain"
                style={[
                  styles.previewImage,
                  {
                    transform: [
                      {
                        scale: previewAnimation.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.94, 1],
                        }),
                      },
                    ],
                  },
                ]}
              />
            ) : null}
            <Animated.Text
              style={[styles.previewHint, { opacity: previewAnimation }]}
            >
              Tap to close
            </Animated.Text>
          </TouchableOpacity>
        </Animated.View>
      </Modal>
    </View>
  );
}

function MainScreenHeader({
  activeIndex,
  onSelect,
}: {
  activeIndex: MainPageIndex;
  onSelect: (index: MainPageIndex) => void;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerSide} />
      <View style={styles.segmentedControl}>
        <SegmentButton
          label="Create"
          active={activeIndex === 0}
          onPress={() => onSelect(0)}
        />
        <SegmentButton
          label="History"
          active={activeIndex === 1}
          onPress={() => onSelect(1)}
        />
      </View>
      <View style={styles.headerSide} />
    </View>
  );
}

function SegmentButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.segmentButton, active && styles.segmentButtonActive]}
      activeOpacity={0.78}
      onPress={onPress}
    >
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function HistoryPage({
  images,
  resolveImageUri,
  resolveThumbnailUri,
}: {
  images: GenerationRecord[];
  resolveImageUri: (record: GenerationRecord) => string;
  resolveThumbnailUri: (record: GenerationRecord) => string | null;
}) {
  const { width } = useWindowDimensions();
  const padding = 2;
  const gap = 2;
  const itemSize = (width - padding * 2 - gap * 2) / 3;

  return (
    <FlatList
      data={images}
      keyExtractor={(item) => item.id}
      numColumns={3}
      showsVerticalScrollIndicator={false}
      style={styles.historyList}
      contentContainerStyle={[
        styles.historyGrid,
        images.length === 0 && styles.historyEmptyGrid,
      ]}
      ListEmptyComponent={
        <View style={styles.historyEmptyState}>
          <Text style={styles.historyEmptyTitle}>No history yet</Text>
          <Text style={styles.historyEmptyText}>
            Generated images will appear here.
          </Text>
        </View>
      }
      renderItem={({ item, index }) => (
        <TouchableOpacity
          activeOpacity={0.86}
          style={[
            styles.historyTile,
            {
              width: itemSize,
              height: itemSize,
              marginRight: index % 3 === 2 ? 0 : gap,
              marginBottom: gap,
            },
          ]}
        >
          <ExpoImage
            source={{
              uri: resolveThumbnailUri(item) ?? resolveImageUri(item),
            }}
            contentFit="cover"
            recyclingKey={item.id}
            transition={120}
            style={styles.historyImage}
          />
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? 28 : 0,
    backgroundColor: colors.grey900,
  },
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  headerSide: {
    width: 44,
  },
  segmentedControl: {
    width: 220,
    height: 38,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    padding: 3,
    backgroundColor: colors.grey800,
  },
  segmentButton: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
  },
  segmentButtonActive: {
    backgroundColor: colors.greyOpacity300,
  },
  segmentText: {
    color: colors.grey400,
    fontSize: 14,
    fontWeight: "800",
  },
  segmentTextActive: {
    color: colors.background,
  },
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
    backgroundColor: colors.grey900,
  },
  imageStage: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  generatedImageWrap: {
    width: "100%",
    overflow: "hidden",
    borderRadius: 14,
    backgroundColor: colors.grey800,
  },
  generatedImage: {
    width: "100%",
    height: "100%",
  },
  message: {
    marginHorizontal: 16,
    marginBottom: 10,
    color: colors.red300,
    fontSize: 13,
    lineHeight: 18,
  },
  temporaryTokenBox: {
    marginHorizontal: 16,
    marginBottom: 10,
  },
  temporaryTokenLabel: {
    marginBottom: 6,
    color: colors.grey400,
    fontSize: 12,
    fontWeight: "700",
  },
  temporaryTokenRow: {
    flexDirection: "row",
    gap: 8,
  },
  temporaryTokenInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: colors.greyOpacity500,
    borderRadius: 14,
    paddingHorizontal: 12,
    backgroundColor: colors.grey800,
    color: colors.background,
  },
  temporaryTokenButton: {
    width: 74,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: colors.blue600,
  },
  temporaryTokenButtonText: {
    color: colors.background,
    fontWeight: "800",
  },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 18,
  },
  optionsButton: {
    width: 68,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: colors.grey800,
  },
  optionsIcon: {
    color: colors.purple300,
    fontSize: 12,
    fontWeight: "800",
  },
  generateButton: {
    flex: 1,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: colors.blue500,
  },
  disabledButton: {
    opacity: 0.62,
  },
  generateText: {
    color: colors.background,
    fontSize: 18,
    fontWeight: "800",
  },
  historyList: {
    flex: 1,
  },
  historyGrid: {
    paddingHorizontal: 2,
    paddingTop: 2,
    paddingBottom: 18,
  },
  historyEmptyGrid: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  historyTile: {
    overflow: "hidden",
    backgroundColor: colors.grey800,
  },
  historyImage: {
    width: "100%",
    height: "100%",
  },
  historyEmptyState: {
    alignItems: "center",
  },
  historyEmptyTitle: {
    marginBottom: 6,
    color: colors.background,
    fontSize: 16,
    fontWeight: "800",
  },
  historyEmptyText: {
    color: colors.grey400,
    fontSize: 13,
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.94)",
  },
  previewPressArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  previewImage: {
    width: "100%",
    height: "88%",
  },
  previewHint: {
    marginTop: 14,
    color: colors.background,
    fontSize: 14,
    opacity: 0.75,
  },
});
