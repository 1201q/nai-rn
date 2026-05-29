import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
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
                <ActivityIndicator color={colors.colorTextInverse} />
              ) : (
                <>
                  <Ionicons
                    name="save-outline"
                    size={18}
                    color={colors.colorTextInverse}
                  />
                  <Text style={styles.imageActionText}>저장</Text>
                </>
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
                <ActivityIndicator color={colors.colorTextInverse} />
              ) : (
                <>
                  <Ionicons
                    name="clipboard-outline"
                    size={18}
                    color={colors.colorTextInverse}
                  />
                  <Text style={styles.imageActionText}>복사</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      {message ? <Text style={styles.message}>{message}</Text> : null}

      <View style={styles.actionArea}>
        <TouchableOpacity
          style={styles.sheetButton}
          activeOpacity={0.78}
          onPress={onOpenBottomSheet}
        >
          <Ionicons
            name="albums-outline"
            size={20}
            color={colors.colorTextInfo}
          />
          <Text style={styles.sheetButtonText}>Bottom Sheet</Text>
        </TouchableOpacity>

        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.optionsButton}
            activeOpacity={0.78}
            onPress={onOpenOptions}
          >
            <Ionicons name="options-outline" size={20} color={colors.colorTextInfo} />
          </TouchableOpacity>

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
