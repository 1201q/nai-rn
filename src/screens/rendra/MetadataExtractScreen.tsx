import { useRef, useState } from "react";
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
import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  RENDRA_DETAIL_HEADER_TOP_OFFSET,
  RendraDetailHeaderOverlay,
  RendraDetailScrollTitle,
} from "../../components/rendra/RendraDetailScrollHeader";
import { MODELS, NOISE_SCHEDULES, SAMPLERS } from "../../constants/generation";
import { parseNaiMetadata, type ParsedNaiMetadata } from "../../lib/naiMetadata";
import { getUcPresetLabel } from "../../lib/naiPresets";
import { extractPngTextMetadata } from "../../lib/novelai";
import { useGenerationStore } from "../../store/generationStore";
import { tokens } from "../../styles/tokens";

type SettingRow = {
  label: string;
  value: string;
  active?: boolean;
};

function listLabel(
  items: ReadonlyArray<{ label: string; value: string }>,
  value: string | undefined,
) {
  if (!value) return "—";
  return items.find((item) => item.value === value)?.label ?? value;
}

function fixedValue(value: number | undefined, precision: number) {
  return value === undefined ? "—" : value.toFixed(precision);
}

function MetadataTextSection({
  label,
  value,
  negative = false,
}: {
  label: string;
  value: string;
  negative?: boolean;
}) {
  return (
    <View style={styles.textSection}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={[styles.textCard, negative && styles.textCardNegative]}>
        <Text style={styles.metadataText}>{value}</Text>
      </View>
    </View>
  );
}

function MetadataSettingsCard({ parsed }: { parsed: ParsedNaiMetadata | null }) {
  const rows: SettingRow[] = [
    {
      label: "Model",
      value: listLabel(MODELS, parsed?.model),
    },
    {
      label: "Resolution",
      value: parsed?.resolution
        ? `${parsed.resolution.width}x${parsed.resolution.height}`
        : "—",
    },
    { label: "Steps", value: parsed?.steps?.toString() ?? "—" },
    {
      label: "CFG Scale",
      value: fixedValue(parsed?.promptGuidance, 1),
    },
    {
      label: "CFG Rescale",
      value: fixedValue(parsed?.promptGuidanceRescale, 2),
    },
    {
      label: "Sampler",
      value: listLabel(SAMPLERS, parsed?.sampler),
    },
    {
      label: "Schedule",
      value: listLabel(NOISE_SCHEDULES, parsed?.noiseSchedule),
    },
    {
      label: "Variety+",
      value:
        parsed?.varietyPlus === undefined
          ? "—"
          : parsed.varietyPlus
            ? "On"
            : "Off",
      active: parsed?.varietyPlus === true,
    },
    {
      label: "Quality Tags",
      value:
        parsed?.qualityToggle === undefined
          ? "—"
          : parsed.qualityToggle
            ? "On"
            : "Off",
      active: parsed?.qualityToggle === true,
    },
    {
      label: "UC Preset",
      value:
        parsed?.ucPreset === undefined
          ? "—"
          : getUcPresetLabel(parsed.ucPreset),
    },
    { label: "Seed", value: parsed?.seed?.toString() ?? "—" },
  ];

  return (
    <View style={styles.settingsSection}>
      <Text style={styles.sectionLabel}>SETTINGS</Text>
      <View style={styles.settingsCard}>
        {rows.map((row) => (
          <View key={row.label} style={styles.settingRow}>
            <Text style={styles.settingLabel}>{row.label}</Text>
            <Text
              style={[
                styles.settingValue,
                row.active && styles.settingValueActive,
              ]}
              numberOfLines={1}
            >
              {row.value}
            </Text>
          </View>
        ))}
        {!parsed ? (
          <Text style={styles.emptyHint}>
            이미지를 추가하면 여기에 추출된 정보가 표시됩니다
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export function MetadataExtractScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setMessage = useGenerationStore((state) => state.setMessage);
  const [pickedUri, setPickedUri] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedNaiMetadata | null>(null);
  const [busy, setBusy] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;

  async function pickImage() {
    if (busy) return;

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

      setPickedUri(asset.uri);
      const bytes = await new File(asset.uri).bytes();
      const metadata = extractPngTextMetadata(bytes);
      setParsed(parseNaiMetadata(metadata));
    } catch {
      setParsed(null);
      setMessage("이미지에서 메타데이터를 추출하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      <Animated.ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + RENDRA_DETAIL_HEADER_TOP_OFFSET,
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
        <RendraDetailScrollTitle title="Metadata Extract" scrollY={scrollY} />

        <View style={styles.imageSection}>
          {pickedUri ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="메타데이터 이미지 교체"
            disabled={busy}
            onPress={() => void pickImage()}
            style={({ pressed }) => [
              styles.previewCard,
              pressed && styles.pressed,
            ]}
          >
            <ExpoImage
              source={{ uri: pickedUri }}
              contentFit="cover"
              contentPosition="center"
              cachePolicy="memory-disk"
              transition={120}
              style={StyleSheet.absoluteFill}
            />
            {busy ? (
              <View pointerEvents="none" style={styles.busyOverlay}>
                <ActivityIndicator color={tokens.color.textPrimary} />
              </View>
            ) : null}
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="메타데이터 이미지 추가"
            disabled={busy}
            onPress={() => void pickImage()}
            style={({ pressed }) => [
              styles.uploadCard,
              pressed && styles.pressed,
            ]}
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

        {parsed?.prompt ? (
          <MetadataTextSection label="PROMPT" value={parsed.prompt} />
        ) : null}
        {parsed?.negativePrompt ? (
          <MetadataTextSection
            label="NEGATIVE PROMPT"
            value={parsed.negativePrompt}
            negative
          />
        ) : null}
        {parsed?.characters?.map((character, index) => (
          <View key={character.id}>
            {character.prompt ? (
              <MetadataTextSection
                label={
                  parsed.characters!.length > 1
                    ? `CHARACTER ${index + 1} PROMPT`
                    : "CHARACTER PROMPT"
                }
                value={character.prompt}
              />
            ) : null}
            {character.negativePrompt ? (
              <MetadataTextSection
                label={
                  parsed.characters!.length > 1
                    ? `CHARACTER ${index + 1} NEGATIVE PROMPT`
                    : "CHARACTER NEGATIVE PROMPT"
                }
                value={character.negativePrompt}
                negative
              />
            ) : null}
          </View>
        ))}

        <MetadataSettingsCard parsed={parsed} />
      </Animated.ScrollView>

      <RendraDetailHeaderOverlay
        scrollY={scrollY}
        topInset={insets.top}
        onBack={() => router.back()}
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
    paddingHorizontal: tokens.space[8],
  },
  imageSection: {
    marginTop: 24,
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
  previewCard: {
    width: "100%",
    aspectRatio: 6,
    overflow: "hidden",
    borderBottomLeftRadius: tokens.radius.xl,
    borderBottomRightRadius: tokens.radius.xl,
    backgroundColor: tokens.color.card,
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
  textSection: {
    marginTop: 32,
    gap: 12,
  },
  sectionLabel: {
    paddingHorizontal: 4,
    color: tokens.color.textMuted,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type["3xs"],
    letterSpacing: tokens.tracking.wide,
  },
  textCard: {
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderRadius: tokens.radius.xl,
    backgroundColor: tokens.color.card,
  },
  textCardNegative: {
    borderWidth: 1,
    borderColor: tokens.color.borderNegative,
  },
  metadataText: {
    color: tokens.color.textSecondary,
    fontFamily: tokens.font.regular,
    fontSize: tokens.type.sm,
    lineHeight: 21,
  },
  settingsSection: {
    marginTop: 32,
    gap: 12,
  },
  settingsCard: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: tokens.radius.xl,
    backgroundColor: tokens.color.card,
  },
  settingRow: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  settingLabel: {
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.medium,
    fontSize: tokens.type.sm,
  },
  settingValue: {
    flex: 1,
    textAlign: "right",
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.medium,
    fontSize: tokens.type.sm,
  },
  settingValueActive: {
    color: tokens.color.accent,
  },
  emptyHint: {
    marginTop: 10,
    color: tokens.color.textMuted,
    fontFamily: tokens.font.regular,
    fontSize: tokens.type["2xs"],
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.68,
  },
});
