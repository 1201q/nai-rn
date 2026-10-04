import { useRef, useState } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
} from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { toast } from "sonner-native";

import {
  imageUpscaler,
  type UpscaleEngine,
  type UpscaleFormat,
  type UpscaleResult,
} from "../../../modules/image-upscaler";
import { PrimaryButton } from "../../components/common/Buttons";
import {
  DETAIL_FIXED_HEADER_CONTENT_OFFSET,
  DetailHeaderOverlay,
} from "../../components/common/DetailScrollHeader";
import {
  requestGallerySavePermission,
  saveImageToGallery,
} from "../../lib/gallery";
import { tokens } from "../../styles/tokens";

const ENGINES: { value: UpscaleEngine; label: string }[] = [
  { value: "realcugan", label: "Real-CUGAN" },
  { value: "waifu2x", label: "waifu2x" },
];

// 모듈에 번들된 2x 모델 (ImageUpscalerModule.kt의 models와 일치해야 한다)
const MODELS: Record<UpscaleEngine, { value: string; label: string }[]> = {
  realcugan: [
    { value: "up2x-conservative", label: "Conservative" },
    { value: "up2x-no-denoise", label: "No denoise" },
  ],
  waifu2x: [
    { value: "scale2.0x_model", label: "No denoise" },
    { value: "noise0_scale2.0x_model", label: "Denoise 0" },
  ],
};

const TILE_SIZES = [
  { value: 0, label: "자동" },
  { value: 100, label: "100" },
  { value: 200, label: "200" },
  { value: 400, label: "400" },
];

const FORMATS: { value: UpscaleFormat; label: string }[] = [
  { value: "png", label: "PNG" },
  { value: "jpg", label: "JPG" },
  { value: "webp", label: "WebP" },
];

type Source = { uri: string; width: number; height: number };

function Chips<T extends string | number>({
  title,
  options,
  value,
  disabled,
  onChange,
}: {
  title: string;
  options: { value: T; label: string }[];
  value: T;
  disabled: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.option}>
      <Text style={styles.optionTitle}>{title}</Text>
      <View style={styles.chips}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              onPress={() => onChange(option.value)}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text
                style={[styles.chipLabel, selected && styles.chipLabelSelected]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Preview({
  uri,
  width,
  height,
}: {
  uri: string;
  width: number;
  height: number;
}) {
  const frame: ImageStyle = { aspectRatio: width / height };
  return (
    <View>
      <Image
        source={{ uri }}
        contentFit="contain"
        style={[styles.preview, frame]}
      />
      <Text style={styles.meta}>
        {width} × {height}
      </Text>
    </View>
  );
}

export function UpscaleScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scrollY = useRef(new Animated.Value(0)).current;
  const [source, setSource] = useState<Source | null>(null);
  const [engine, setEngine] = useState<UpscaleEngine>("realcugan");
  const [model, setModel] = useState(MODELS.realcugan[0].value);
  const [tileSize, setTileSize] = useState(0);
  const [format, setFormat] = useState<UpscaleFormat>("png");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<UpscaleResult | null>(null);

  async function pickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      toast.error("이미지를 선택하려면 사진 접근 권한이 필요합니다.");
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
    });
    const asset = picked.canceled ? undefined : picked.assets[0];
    if (!asset) return;
    setSource({ uri: asset.uri, width: asset.width, height: asset.height });
    setResult(null);
  }

  async function runUpscale() {
    if (!source) return;
    if (!imageUpscaler) {
      toast.error("이 빌드에는 업스케일 모듈이 없습니다.");
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      setResult(
        await imageUpscaler.upscale(
          source.uri,
          engine,
          model,
          tileSize,
          format,
        ),
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(
        message.includes("IMAGE_TOO_LARGE")
          ? "이미지가 너무 큽니다. (최대 2048×2048 상당)"
          : `업스케일에 실패했습니다. ${message}`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveResult() {
    if (!result) return;
    try {
      if (!(await requestGallerySavePermission())) {
        toast.error("저장하려면 사진 접근 권한이 필요합니다.");
        return;
      }
      await saveImageToGallery(result.uri);
      toast.success("갤러리에 저장했습니다.");
    } catch {
      toast.error("갤러리에 저장하지 못했습니다.");
    }
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="이미지 선택"
          disabled={busy}
          onPress={() => void pickImage()}
          style={({ pressed }) => [
            styles.picker,
            pressed && styles.pickerPressed,
          ]}
        >
          {source ? (
            <Preview {...source} />
          ) : (
            <Text style={styles.pickerHint}>
              저장소에서 이미지를 선택하세요
            </Text>
          )}
        </Pressable>

        <Chips
          title="Engine"
          options={ENGINES}
          value={engine}
          disabled={busy}
          onChange={(next) => {
            setEngine(next);
            setModel(MODELS[next][0].value);
          }}
        />
        <Chips
          title="Model (2x)"
          options={MODELS[engine]}
          value={model}
          disabled={busy}
          onChange={setModel}
        />
        <Chips
          title="Tile size"
          options={TILE_SIZES}
          value={tileSize}
          disabled={busy}
          onChange={setTileSize}
        />
        <Chips
          title="Format"
          options={FORMATS}
          value={format}
          disabled={busy}
          onChange={setFormat}
        />

        <View style={styles.action}>
          <PrimaryButton
            label={busy ? "업스케일 중…" : "업스케일하기"}
            loading={busy}
            disabled={!source || busy}
            onPress={() => void runUpscale()}
          />
        </View>

        {result ? (
          <View style={styles.result}>
            <Preview {...result} />
            <Text style={styles.meta}>
              {(result.elapsedMs / 1000).toFixed(1)}초 ·{" "}
              {result.usedGpu ? "GPU (Vulkan)" : "CPU"} · tile {result.tileSize}{" "}
              · {(result.bytes / 1024 / 1024).toFixed(2)}MB
            </Text>
            <View style={styles.action}>
              <PrimaryButton
                label="갤러리에 저장"
                onPress={() => void saveResult()}
              />
            </View>
          </View>
        ) : null}
      </Animated.ScrollView>

      <DetailHeaderOverlay
        title="이미지 업스케일"
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
    flexGrow: 1,
    paddingHorizontal: tokens.space[10],
  },
  picker: {
    minHeight: 160,
    padding: tokens.space[6],
    justifyContent: "center",
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    backgroundColor: tokens.color.card,
  },
  pickerPressed: {
    opacity: tokens.opacity.pressed,
  },
  pickerHint: {
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.medium,
    fontSize: tokens.type.sm,
    textAlign: "center",
  },
  preview: {
    width: "100%",
    maxHeight: 420,
    alignSelf: "center",
    borderRadius: tokens.radius.md,
  },
  meta: {
    marginTop: tokens.space[4],
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.medium,
    fontSize: tokens.type.xs,
    textAlign: "center",
  },
  option: {
    marginTop: tokens.space[9],
    gap: tokens.space[4],
  },
  optionTitle: {
    color: tokens.color.textSecondary,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type.sm,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.space[4],
  },
  chip: {
    height: 36,
    paddingHorizontal: tokens.space[7],
    justifyContent: "center",
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.card,
  },
  chipSelected: {
    backgroundColor: tokens.color.accent,
  },
  chipLabel: {
    color: tokens.color.textSecondary,
    fontFamily: tokens.font.medium,
    fontSize: tokens.type.sm,
  },
  chipLabelSelected: {
    color: tokens.color.onAccent,
  },
  action: {
    marginTop: tokens.space[10],
    height: 52,
    flexDirection: "row",
  },
  result: {
    marginTop: tokens.space[12],
  },
});
