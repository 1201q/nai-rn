import {
  ActivityIndicator,
  Text,
  TextInput,
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
  storedToken,
  tokenInput,
  setTokenInput,
  isLoading,
  onOpenImagePreview,
  onSaveToken,
  onOpenOptions,
  onGenerate,
}: {
  currentGeneration: GenerationRecord | null;
  currentImageUri: string | null;
  message: string | null;
  storedToken: string | null;
  tokenInput: string;
  setTokenInput: (v: string) => void;
  isLoading: boolean;
  onOpenImagePreview: () => void;
  onSaveToken: () => void;
  onOpenOptions: () => void;
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
            placeholderTextColor={colors.colorTextTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            style={styles.temporaryTokenInput}
          />
          <TouchableOpacity
            style={styles.temporaryTokenButton}
            activeOpacity={0.78}
            onPress={onSaveToken}
          >
            <Text style={styles.temporaryTokenButtonText}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>

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
    </>
  );
}
