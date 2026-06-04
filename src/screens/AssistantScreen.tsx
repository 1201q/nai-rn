import { useState } from "react";
import {
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";

import { KeyboardStickyView } from "react-native-keyboard-controller";

import { useNavigation } from "@react-navigation/native";
import { useGenerationOptions } from "../context/GenerationOptionsContext";
import type { AssistantScreenNavigationProp } from "../navigation/types";
import { light, styles } from "./assistant/styles";

const OPTIONS: {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: "model", label: "Model", icon: "layers-outline" },
  { key: "resolution", label: "Resolution", icon: "scan-outline" },
  { key: "seed", label: "Seed", icon: "dice-outline" },
  { key: "steps", label: "Steps", icon: "footsteps-outline" },
  { key: "cfg", label: "CFG Scale", icon: "pulse-outline" },
  { key: "cfgRescale", label: "CFG Rescale", icon: "git-compare-outline" },
  { key: "sampler", label: "Sampler", icon: "shuffle-outline" },
  { key: "schedule", label: "Schedule", icon: "git-branch-outline" },
];

export function AssistantScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<AssistantScreenNavigationProp>();
  const { currentGeneration, currentImageUri } = useGenerationOptions();
  const [prompt, setPrompt] = useState("");
  const [varietyPlus, setVarietyPlus] = useState(false);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      {/* 상단 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerCircleButton}
          activeOpacity={0.78}
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={22} color={light.textPrimary} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>test1</Text>

        <View style={styles.headerCircleButton}>
          <Ionicons
            name="ellipsis-horizontal"
            size={20}
            color={light.textPrimary}
          />
        </View>
      </View>

      {/* 중단: 생성 이미지 영역 */}
      <ScrollView
        style={styles.imageScroll}
        contentContainerStyle={styles.imageScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.imageCard,
            currentGeneration
              ? {
                  aspectRatio:
                    currentGeneration.width / currentGeneration.height,
                }
              : null,
          ]}
        >
          {currentImageUri ? (
            <ExpoImage
              source={{ uri: currentImageUri }}
              contentFit="cover"
              transition={120}
              style={styles.generatedImage}
            />
          ) : null}
          <View style={styles.imageOverlayRow}>
            <View style={styles.imageOverlayButton}>
              <Ionicons name="arrow-down-outline" size={20} color="#ffffff" />
            </View>
            <View style={styles.imageOverlayButton}>
              <Ionicons name="copy-outline" size={20} color="#ffffff" />
            </View>
          </View>
        </View>
      </ScrollView>

      {/* 하단: 옵션 + 프롬프트 */}
      <KeyboardStickyView
        style={[styles.bottomArea, { paddingBottom: insets.bottom + 16 }]}
        offset={{ closed: 0, opened: 0 }}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.optionScrollContent}
        >
          {OPTIONS.map((opt) => (
            <View key={opt.key} style={styles.optionChip}>
              <Ionicons name={opt.icon} size={16} color={light.textSecondary} />
              <Text style={styles.optionChipText}>{opt.label}</Text>
              <Ionicons
                name="chevron-down"
                size={14}
                color={light.textSecondary}
              />
            </View>
          ))}

          <TouchableOpacity
            style={[styles.optionChip, varietyPlus && styles.optionChipActive]}
            activeOpacity={0.8}
            onPress={() => setVarietyPlus((v) => !v)}
          >
            <Ionicons
              name="sparkles-outline"
              size={16}
              color={varietyPlus ? "#ffffff" : light.textSecondary}
            />
            <Text
              style={[
                styles.optionChipText,
                varietyPlus && styles.optionChipTextActive,
              ]}
            >
              Variety+
            </Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={styles.promptCard}>
          <View style={styles.promptInputWrap}>
            <TextInput
              style={styles.promptInput}
              value={prompt}
              onChangeText={setPrompt}
              placeholder="Ready to help, ask anything…"
              placeholderTextColor={light.textHint}
              multiline
            />
            <View style={styles.expandButton}>
              <Ionicons
                name="scan-outline"
                size={16}
                color={light.textSecondary}
              />
            </View>
          </View>

          <View style={styles.promptActionRow}>
            <View style={styles.plusButton}>
              <Ionicons name="add" size={24} color={light.textSecondary} />
            </View>
            <View style={styles.submitButton}>
              <Ionicons name="arrow-up" size={22} color="#ffffff" />
            </View>
          </View>
        </View>
      </KeyboardStickyView>
    </View>
  );
}
