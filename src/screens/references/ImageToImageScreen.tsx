import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { toast } from "sonner-native";
import Reanimated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import {
  DETAIL_FIXED_HEADER_CONTENT_OFFSET,
  DetailHeaderOverlay,
} from "../../components/common/DetailScrollHeader";
import {
  TAP_FEEDBACK_OVERLAY_COLOR,
  TapFeedbackPressable,
  useTapFeedback,
} from "../../components/common/TapFeedbackPressable";
import {
  ParameterSlider,
  Toggle,
} from "../../components/forms/FormControls";
import { useGenerationStore } from "../../store/generationStore";
import { tokens } from "../../styles/tokens";

const DISABLED_SCRIM_OPACITY = 0.5;
const CONTENT_TIMING = {
  duration: 180,
  easing: Easing.out(Easing.cubic),
};
const PARAMETERS_ENTERING = FadeIn.duration(180).easing(
  Easing.out(Easing.cubic),
);
const PARAMETERS_EXITING = FadeOut.duration(140).easing(
  Easing.out(Easing.cubic),
);
const PARAMETERS_LAYOUT = LinearTransition.duration(200).easing(
  Easing.out(Easing.cubic),
);

export function ImageToImageScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const sourceImage = useGenerationStore((state) => state.i2iSourceImage);
  const setSourceImage = useGenerationStore((state) => state.setI2ISourceImage);
  const enabled = useGenerationStore((state) => state.i2iEnabled);
  const setEnabled = useGenerationStore((state) => state.setI2IEnabled);
  const clearI2I = useGenerationStore((state) => state.clearI2I);
  const strength = useGenerationStore((state) => state.i2iStrength);
  const setStrength = useGenerationStore((state) => state.setI2IStrength);
  const noise = useGenerationStore((state) => state.i2iNoise);
  const setNoise = useGenerationStore((state) => state.setI2INoise);
  const setMessage = useGenerationStore((state) => state.setMessage);
  const [busy, setBusy] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  const hasSourceImage = Boolean(sourceImage);
  const disabledScrimOpacity = useSharedValue(
    enabled ? 0 : DISABLED_SCRIM_OPACITY,
  );
  const contentAnimationReady = useRef(false);
  const parametersAnimationReady = useRef(false);
  const {
    contentAnimatedStyle: toggleCardContentAnimatedStyle,
    endFeedback: endToggleCardFeedback,
    overlayStyle: toggleCardOverlayStyle,
    startFeedback: startToggleCardFeedback,
  } = useTapFeedback();

  const disabledScrimAnimatedStyle = useAnimatedStyle(() => ({
    opacity: disabledScrimOpacity.value,
  }));

  useEffect(() => {
    const nextOpacity = enabled ? 0 : DISABLED_SCRIM_OPACITY;
    if (!contentAnimationReady.current) {
      contentAnimationReady.current = true;
      disabledScrimOpacity.value = nextOpacity;
      return;
    }
    disabledScrimOpacity.value = withTiming(nextOpacity, CONTENT_TIMING);
  }, [disabledScrimOpacity, enabled]);

  useEffect(() => {
    parametersAnimationReady.current = true;
  }, []);

  async function pickImage() {
    if (busy) return;
    const replacing = Boolean(sourceImage);

    try {
      setBusy(true);
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setMessage("이미지를 선택하려면 사진 접근 권한이 필요합니다.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 1,
        base64: false,
      });
      const asset = result.canceled ? undefined : result.assets[0];
      if (!asset) return;

      const storedImage = await setSourceImage({
        uri: asset.uri,
        width: asset.width || 64,
        height: asset.height || 64,
        fileName: asset.fileName,
        mimeType: asset.mimeType,
      });
      if (!storedImage) return;
      toast.success(
        replacing
          ? "I2I 이미지를 교체했습니다."
          : "I2I 이미지를 추가했습니다.",
      );
    } catch {
      setMessage("I2I 이미지를 선택하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  function handleToggle(value: boolean) {
    if (value) {
      if (sourceImage) setEnabled(true);
      else void pickImage();
      return;
    }
    setEnabled(false);
  }

  function handleClear() {
    clearI2I();
    toast.success("I2I 이미지를 삭제했습니다.");
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <Animated.ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + DETAIL_FIXED_HEADER_CONTENT_OFFSET,
            paddingBottom: insets.bottom + 32,
          },
        ]}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[styles.toggleCard, enabled && styles.toggleCardEnabled]}
        >
          <Reanimated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              styles.tapOverlay,
              toggleCardOverlayStyle,
            ]}
          />
          <Reanimated.View
            pointerEvents="box-none"
            style={[
              styles.toggleCardContent,
              toggleCardContentAnimatedStyle,
            ]}
          >
            <Text
              style={[
                styles.toggleLabel,
                enabled && styles.toggleLabelEnabled,
              ]}
            >
              {enabled ? "사용 중" : "사용 안 함"}
            </Text>
            <Toggle
              value={enabled}
              label="Image2Image"
              onChange={handleToggle}
              onPressIn={startToggleCardFeedback}
              onPressOut={endToggleCardFeedback}
            />
          </Reanimated.View>
        </View>

        <Reanimated.View
          layout={PARAMETERS_LAYOUT}
          style={styles.detailContent}
        >
          <View style={styles.imageSection}>
            {sourceImage ? (
              <View style={styles.previewCard}>
                <TapFeedbackPressable
                  accessibilityRole="button"
                  accessibilityLabel="I2I 이미지 교체"
                  disabled={busy}
                  overlayPlacement="foreground"
                  onPress={() => void pickImage()}
                  style={StyleSheet.absoluteFill}
                >
                  <ExpoImage
                    source={{ uri: sourceImage.uri }}
                    contentFit="cover"
                    contentPosition="center"
                    transition={120}
                    style={StyleSheet.absoluteFill}
                  />
                </TapFeedbackPressable>
                <TapFeedbackPressable
                  accessibilityRole="button"
                  accessibilityLabel="I2I 이미지 제거"
                  hitSlop={5}
                  onPress={handleClear}
                  style={styles.removeButton}
                  contentStyle={styles.centeredTapContent}
                >
                  <Ionicons
                    name="trash-outline"
                    size={16}
                    color={tokens.color.negative}
                  />
                </TapFeedbackPressable>
                {busy ? (
                  <View pointerEvents="none" style={styles.busyOverlay}>
                    <ActivityIndicator color={tokens.color.textPrimary} />
                  </View>
                ) : null}
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="I2I 이미지 추가"
                disabled={busy}
                onPress={() => void pickImage()}
                style={styles.uploadCard}
              >
                {busy ? (
                  <ActivityIndicator color={tokens.color.textMuted} />
                ) : (
                  <>
                    <Ionicons
                      name="add-circle-outline"
                      size={32}
                      color={tokens.color.textMuted}
                    />
                    <Text style={styles.uploadLabel}>이미지 추가</Text>
                  </>
                )}
              </Pressable>
            )}
          </View>

          {hasSourceImage ? (
            <Reanimated.View
              entering={
                parametersAnimationReady.current
                  ? PARAMETERS_ENTERING
                  : undefined
              }
              exiting={PARAMETERS_EXITING}
              style={styles.parameters}
            >
              <View style={styles.parameterCard}>
                <ParameterSlider
                  label="Strength"
                  value={strength}
                  min={0.01}
                  max={0.99}
                  step={0.01}
                  precision={2}
                  onChange={setStrength}
                  settingsCard
                />
              </View>
              <View style={styles.parameterCard}>
                <ParameterSlider
                  label="Noise"
                  value={noise}
                  min={0}
                  max={0.99}
                  step={0.01}
                  precision={2}
                  onChange={setNoise}
                  settingsCard
                />
              </View>
            </Reanimated.View>
          ) : null}

          <Reanimated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              styles.disabledScrim,
              disabledScrimAnimatedStyle,
            ]}
          />
        </Reanimated.View>
      </Animated.ScrollView>

      <DetailHeaderOverlay
        title="Image2Image"
        scrollY={scrollY}
        topInset={insets.top}
        onBack={() => router.back()}
        showMore={false}
        hideCompactTitleOnScroll
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: tokens.color.app,
  },
  content: {
    paddingHorizontal: tokens.space[6],
  },
  toggleCard: {
    overflow: "hidden",
    minHeight: 58,
    paddingHorizontal: 18,
    justifyContent: "center",
    borderRadius: tokens.radius["2xl"],
    backgroundColor: tokens.color.card,
  },
  toggleCardContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tapOverlay: {
    backgroundColor: TAP_FEEDBACK_OVERLAY_COLOR,
  },
  toggleCardEnabled: {
    backgroundColor: tokens.color.toast,
  },
  toggleLabel: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.bold,
    fontSize: 17,
    lineHeight: 22,
  },
  toggleLabelEnabled: {
    color: tokens.color.accent,
  },
  imageSection: {
    marginTop: 24,
  },
  detailContent: {
    position: "relative",
  },
  previewCard: {
    width: "100%",
    aspectRatio: 1,
    overflow: "hidden",
    borderRadius: tokens.radius.xl,
    backgroundColor: tokens.color.card,
  },
  uploadCard: {
    width: "100%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: tokens.radius.xl,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: tokens.color.borderSubtleStrong,
    backgroundColor: tokens.color.card,
  },
  uploadLabel: {
    color: tokens.color.textMuted,
    fontFamily: tokens.font.medium,
    fontSize: tokens.type.xs,
  },
  removeButton: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: 17,
    backgroundColor: "rgba(23,23,26,0.86)",
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
  },
  centeredTapContent: {
    alignItems: "center",
    justifyContent: "center",
  },
  busyOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.scrim,
  },
  parameters: {
    marginTop: 24,
    gap: 20,
  },
  parameterCard: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: tokens.radius.settings,
    backgroundColor: tokens.color.card,
  },
  disabledScrim: {
    zIndex: 1,
    backgroundColor: tokens.color.app,
  },
});
