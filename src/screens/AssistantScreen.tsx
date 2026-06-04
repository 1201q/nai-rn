import React, { useRef, useState } from "react";
import {
  Animated,
  Pressable,
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
import { MODELS, NOISE_SCHEDULES, SAMPLERS } from "../constants/generation";
import { formatDecimal } from "./option/helpers";

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

function ScalePressable({
  children,
  style,
  onPress,
}: {
  children: React.ReactNode;
  style?: object | object[];
  onPress?: () => void;
}) {
  const anim = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(anim, {
      toValue: 0.93,
      useNativeDriver: true,
      speed: 60,
      bounciness: 0,
    }).start();

  const onPressOut = () =>
    Animated.spring(anim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 0,
    }).start();

  return (
    <Pressable onPressIn={onPressIn} onPressOut={onPressOut} onPress={onPress}>
      <Animated.View style={[style, { transform: [{ scale: anim }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

function VarietyChip({
  active,
  onPress,
}: {
  active: boolean;
  onPress: () => void;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  const onPressIn = () => {
    Animated.spring(anim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 60,
      bounciness: 0,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(anim, {
      toValue: 0,
      useNativeDriver: true,
      speed: 30,
      bounciness: 0,
    }).start();
    onPress();
  };

  const scale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.93],
  });

  return (
    <Pressable onPressIn={onPressIn} onPressOut={onPressOut}>
      <Animated.View
        style={[
          styles.optionChip,
          active ? styles.optionChipActive : null,
          { transform: [{ scale }] },
        ]}
      >
        <Ionicons
          name="sparkles-outline"
          size={16}
          color={active ? "#ffffff" : light.textSecondary}
        />
        <Text
          style={[styles.optionChipText, active && styles.optionChipTextActive]}
        >
          Variety+
        </Text>
      </Animated.View>
    </Pressable>
  );
}

type ChipValue = { text: string; unit?: string; unitBefore?: boolean };

function OptionChip({
  opt,
  value,
}: {
  opt: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap };
  value: ChipValue;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  const onPressIn = () => {
    Animated.spring(anim, {
      toValue: 1,
      useNativeDriver: false,
      speed: 60,
      bounciness: 0,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(anim, {
      toValue: 0,
      useNativeDriver: false,
      speed: 30,
      bounciness: 0,
    }).start();
  };

  const scale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.93],
  });
  const backgroundColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [light.surface, light.surfaceAlt],
  });

  return (
    <Pressable onPressIn={onPressIn} onPressOut={onPressOut}>
      <Animated.View
        style={[styles.optionChip, { transform: [{ scale }], backgroundColor }]}
      >
        <Ionicons name={opt.icon} size={16} color={light.textSecondary} />
        {value.unitBefore && value.unit ? (
          <Text style={styles.optionChipUnit}>{value.unit}</Text>
        ) : null}
        <Text style={styles.optionChipText}>{value.text}</Text>
        {!value.unitBefore && value.unit ? (
          <Text style={styles.optionChipUnit}>{value.unit}</Text>
        ) : null}
        <Ionicons name="chevron-down" size={14} color={light.textSecondary} />
      </Animated.View>
    </Pressable>
  );
}

function PromptModePill({
  mode,
  onChange,
}: {
  mode: "base" | "negative";
  onChange: (m: "base" | "negative") => void;
}) {
  const leftAnim = useRef(new Animated.Value(0)).current;
  const widthAnim = useRef(new Animated.Value(0)).current;
  const layouts = useRef<{ x: number; width: number }[]>([]);
  const initialized = useRef(false);

  const animateTo = (index: number) => {
    const layout = layouts.current[index];
    if (!layout) return;
    Animated.spring(leftAnim, {
      toValue: layout.x,
      useNativeDriver: false,
      speed: 25,
      bounciness: 5,
    }).start();
    Animated.spring(widthAnim, {
      toValue: layout.width,
      useNativeDriver: false,
      speed: 25,
      bounciness: 5,
    }).start();
  };

  const handleLayout = (index: number, x: number, width: number) => {
    layouts.current[index] = { x, width };
    if (!initialized.current && layouts.current[0] && layouts.current[1]) {
      initialized.current = true;
      const initial = layouts.current[mode === "base" ? 0 : 1];
      leftAnim.setValue(initial.x);
      widthAnim.setValue(initial.width);
    }
  };

  const handlePress = (next: "base" | "negative") => {
    animateTo(next === "base" ? 0 : 1);
    onChange(next);
  };

  return (
    <View style={styles.promptModePill}>
      <Animated.View
        style={[styles.promptModeThumb, { left: leftAnim, width: widthAnim }]}
      />
      <Pressable
        onLayout={(e) =>
          handleLayout(0, e.nativeEvent.layout.x, e.nativeEvent.layout.width)
        }
        onPress={() => handlePress("base")}
        style={styles.promptModeSegment}
      >
        <Text
          style={[
            styles.promptModeText,
            mode === "base" && styles.promptModeTextActive,
          ]}
        >
          Base
        </Text>
      </Pressable>
      <Pressable
        onLayout={(e) =>
          handleLayout(1, e.nativeEvent.layout.x, e.nativeEvent.layout.width)
        }
        onPress={() => handlePress("negative")}
        style={styles.promptModeSegment}
      >
        <Text
          style={[
            styles.promptModeText,
            mode === "negative" && styles.promptModeTextActive,
          ]}
        >
          Negative
        </Text>
      </Pressable>
    </View>
  );
}

export function AssistantScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<AssistantScreenNavigationProp>();
  const {
    currentGeneration,
    currentImageUri,
    model,
    resolution,
    steps,
    promptGuidance,
    promptGuidanceRescale,
    noiseSchedule,
    sampler,
    seedText,
    varietyPlus,
    setVarietyPlus,
    prompt,
    setPrompt,
    negativePrompt,
    setNegativePrompt,
  } = useGenerationOptions();
  const [promptMode, setPromptMode] = useState<"base" | "negative">("base");

  const optionValues: Record<string, ChipValue> = {
    model: { text: MODELS.find((m) => m.value === model)?.label ?? model },
    resolution: { text: `${resolution.width}×${resolution.height}` },
    seed: { text: seedText || "Random" },
    steps: { text: String(steps), unit: "steps", unitBefore: true },
    cfg: {
      text: formatDecimal(promptGuidance),
      unit: "guidance",
      unitBefore: true,
    },
    cfgRescale: {
      text: formatDecimal(promptGuidanceRescale, 2),
      unit: "rescale",
      unitBefore: true,
    },
    sampler: {
      text: SAMPLERS.find((s) => s.value === sampler)?.label ?? sampler,
    },
    schedule: {
      text:
        NOISE_SCHEDULES.find((n) => n.value === noiseSchedule)?.label ??
        noiseSchedule,
    },
  };

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
            <OptionChip
              key={opt.key}
              opt={opt}
              value={optionValues[opt.key] ?? { text: opt.label }}
            />
          ))}

          <VarietyChip
            active={varietyPlus}
            onPress={() => setVarietyPlus(!varietyPlus)}
          />
        </ScrollView>

        <View style={styles.promptCard}>
          <View style={styles.promptInputWrap}>
            <TextInput
              style={styles.promptInput}
              value={promptMode === "base" ? prompt : negativePrompt}
              onChangeText={promptMode === "base" ? setPrompt : setNegativePrompt}
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
            <View style={styles.promptActionLeft}>
              {/* <View style={styles.plusButton}>
                <Ionicons name="add" size={24} color={light.textSecondary} />
              </View> */}
              <PromptModePill mode={promptMode} onChange={setPromptMode} />
              <ScalePressable style={styles.characterButton}>
                <Ionicons
                  name="person-outline"
                  size={15}
                  color={light.textSecondary}
                />
                <Text style={styles.characterButtonText}>Character</Text>
              </ScalePressable>
            </View>
            <ScalePressable style={styles.submitButton}>
              <Ionicons name="arrow-up" size={22} color="#ffffff" />
            </ScalePressable>
          </View>
        </View>
      </KeyboardStickyView>
    </View>
  );
}
