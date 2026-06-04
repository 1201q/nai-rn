import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";

import type { GenerationRecord } from "../../lib/generationHistory";
import { colors } from "../../styles/colors";
import { styles } from "./styles";

export function CreatePage({
  currentGeneration,
  currentImageUri,
  message,
  isLoading,
  isSavingImage,
  isCopyingImage,
  onOpenImagePreview,
  onSaveImage,
  onCopyImage,
  onOpenOptions,
  onOpenBottomSheet,
  onGenerate,
}: {
  currentGeneration: GenerationRecord | null;
  currentImageUri: string | null;
  message: string | null;
  isLoading: boolean;
  isSavingImage: boolean;
  isCopyingImage: boolean;
  onOpenImagePreview: () => void;
  onSaveImage: () => void;
  onCopyImage: () => void;
  onOpenOptions: () => void;
  onOpenBottomSheet: () => void;
  onGenerate: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <>
      <View style={styles.imageStage}>
        {currentImageUri && currentGeneration ? (
          <TouchableOpacity
            activeOpacity={0.92}
            onPress={onOpenImagePreview}
            style={[
              styles.generatedImageWrap,
              {
                aspectRatio: currentGeneration.width / currentGeneration.height,
              },
            ]}
          >
            <ExpoImage
              source={{ uri: currentImageUri }}
              contentFit="contain"
              transition={120}
              style={styles.generatedImage}
            />
          </TouchableOpacity>
        ) : null}

        {currentImageUri && currentGeneration ? (
          <View style={styles.imageActionRow}>
            <TouchableOpacity
              style={[
                styles.imageActionButton,
                isSavingImage && styles.disabledButton,
              ]}
              activeOpacity={0.82}
              onPress={onSaveImage}
              disabled={isSavingImage}
            >
              {isSavingImage ? (
                <ActivityIndicator
                  color={colors.colorTextSecondary}
                  size="small"
                />
              ) : (
                <Ionicons
                  name="arrow-down-outline"
                  size={22}
                  color={colors.colorTextSecondary}
                />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.imageActionButton,
                isCopyingImage && styles.disabledButton,
              ]}
              activeOpacity={0.82}
              onPress={onCopyImage}
              disabled={isCopyingImage}
            >
              {isCopyingImage ? (
                <ActivityIndicator
                  color={colors.colorTextSecondary}
                  size="small"
                />
              ) : (
                <Ionicons
                  name="copy-outline"
                  size={22}
                  color={colors.colorTextSecondary}
                />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.imageActionButton, styles.disabledButton]}
              activeOpacity={0.82}
              disabled
            >
              <Ionicons
                name="cube-outline"
                size={22}
                color={colors.colorTextSecondary}
              />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      {message ? <Text style={styles.message}>{message}</Text> : null}

      <View style={[styles.actionArea, { paddingBottom: insets.bottom + 18 }]}>
        <View style={styles.toolButtonRow}>
          <TouchableOpacity
            style={styles.toolButton}
            activeOpacity={0.78}
            onPress={onOpenOptions}
          >
            <Ionicons
              name="create-outline"
              size={17}
              color={colors.colorTextSecondary}
            />
            <Text style={styles.toolButtonText}>프롬프트</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toolButton}
            activeOpacity={0.78}
            onPress={onOpenBottomSheet}
          >
            <Ionicons
              name="options-outline"
              size={17}
              color={colors.colorTextSecondary}
            />
            <Text style={styles.toolButtonText}>이미지 설정</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toolButton, styles.disabledButton]}
            activeOpacity={0.78}
            disabled
          >
            <Ionicons
              name="images-outline"
              size={17}
              color={colors.colorTextSecondary}
            />
            <Text style={styles.toolButtonText}>참조</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.generateButton, isLoading && styles.disabledButton]}
            activeOpacity={0.82}
            onPress={onGenerate}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.colorTextInverse} />
            ) : (
              <Text style={styles.generateText}>Generate</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}
