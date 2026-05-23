import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  Image,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useNavigation } from "@react-navigation/native";

import { Header } from "../components/Header";
import { useGenerationOptions } from "../context/GenerationOptionsContext";
import { colors } from "../styles/colors";
import type { CreateScreenNavigationProp } from "../navigation/types";

export function CreateScreen() {
  const navigation = useNavigation<CreateScreenNavigationProp>();
  const {
    prompt,
    imageDataUri,
    generatedDimensions,
    isLoading,
    message,
    setMessage,
    generateImage,
    storedToken,
    saveToken,
  } = useGenerationOptions();

  const previewAnimation = useRef(new Animated.Value(0)).current;
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
    if (!imageDataUri) return;
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
      setMessage("토큰을 입력해주세요.");
      return;
    }
    await saveToken(token);
    setTokenInput("");
    setMessage("토큰 저장 완료");
  }

  function handleGenerate() {
    if (!prompt.trim()) {
      navigation.navigate("Option");
      return;
    }
    generateImage();
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <Header title="Create" onBack={() => {}} />

      <View style={styles.imageStage}>
        {imageDataUri && generatedDimensions ? (
          <TouchableOpacity
            activeOpacity={0.92}
            onPress={openImagePreview}
            style={[
              styles.generatedImageWrap,
              {
                aspectRatio:
                  generatedDimensions.width / generatedDimensions.height,
              },
            ]}
          >
            <Image
              source={{ uri: imageDataUri }}
              resizeMode="cover"
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
          <Text style={styles.optionsIcon}>⚙</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.generateButton, isLoading && styles.disabledButton]}
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
            {imageDataUri ? (
              <Animated.Image
                source={{ uri: imageDataUri }}
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
              탭해서 닫기
            </Animated.Text>
          </TouchableOpacity>
        </Animated.View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? 28 : 0,
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
    fontSize: 26,
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
