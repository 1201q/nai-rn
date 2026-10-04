import { useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { toast } from "sonner-native";

import type {
  UpscaleFormat,
  UpscaleModel,
} from "../../../modules/image-upscaler";
import { PrimaryButton } from "../../components/common/Buttons";
import {
  DETAIL_FIXED_HEADER_CONTENT_OFFSET,
  DetailHeaderOverlay,
} from "../../components/common/DetailScrollHeader";
import {
  useUpscaleQueueStore,
  type UpscaleQueueItem,
} from "../../store/upscaleQueueStore";
import { tokens } from "../../styles/tokens";

const MODELS: { value: UpscaleModel; label: string }[] = [
  { value: "realcugan-se", label: "CUGAN Standard" },
  { value: "realcugan-pro", label: "CUGAN Pro" },
  { value: "waifu2x-cunet", label: "waifu2x CUNet" },
];

// 모델별 배율 -> 번들된 denoise 단계 (모듈 assets/upscaler-models와 일치해야 한다)
const NOISE_LEVELS: Record<UpscaleModel, Record<number, number[]>> = {
  "realcugan-se": { 2: [-1, 0, 1, 2, 3], 3: [-1, 0, 3], 4: [-1, 0, 3] },
  "realcugan-pro": { 2: [-1, 0, 3], 3: [-1, 0, 3] },
  "waifu2x-cunet": { 1: [0, 1, 2, 3], 2: [-1, 0, 1, 2, 3] },
};

function scaleOptions(model: UpscaleModel) {
  return Object.keys(NOISE_LEVELS[model]).map((scale) => ({
    value: Number(scale),
    label: `${scale}x`,
  }));
}

function noiseOptions(model: UpscaleModel, scale: number) {
  return NOISE_LEVELS[model][scale].map((noise) => ({
    value: noise,
    label: String(noise),
  }));
}

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

function statusText(item: UpscaleQueueItem) {
  if (item.status === "pending") return "대기";
  if (item.status === "running") return "업스케일 중…";
  if (item.status === "failed") {
    return item.error?.includes("IMAGE_TOO_LARGE")
      ? "실패: 이미지가 너무 큽니다 (결과 최대 4096×4096 상당)"
      : `실패: ${item.error}`;
  }
  const result = item.result!;
  return [
    `${result.width} × ${result.height}`,
    `${(result.elapsedMs / 1000).toFixed(1)}초`,
    result.usedGpu ? "GPU" : "CPU",
    `tile ${result.tileSize}`,
    `${(result.bytes / 1024 / 1024).toFixed(2)}MB`,
  ].join(" · ");
}

function QueueRow({
  item,
  onRemove,
}: {
  item: UpscaleQueueItem;
  onRemove: () => void;
}) {
  return (
    <View style={styles.row}>
      <Image
        source={{ uri: item.uri }}
        contentFit="cover"
        style={styles.thumbnail}
      />
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>
          {item.width} × {item.height}
        </Text>
        <Text
          numberOfLines={2}
          style={[
            styles.rowStatus,
            item.status === "done" && styles.rowStatusDone,
            item.status === "failed" && styles.rowStatusFailed,
          ]}
        >
          {statusText(item)}
        </Text>
      </View>
      {item.status !== "running" ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="목록에서 제거"
          hitSlop={8}
          onPress={onRemove}
        >
          <Ionicons name="close" size={18} color={tokens.color.textTertiary} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function UpscaleScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scrollY = useRef(new Animated.Value(0)).current;
  const items = useUpscaleQueueStore((state) => state.items);
  const busy = useUpscaleQueueStore((state) => state.running);
  const stopRequested = useUpscaleQueueStore((state) => state.stopRequested);
  const addImages = useUpscaleQueueStore((state) => state.addImages);
  const removeItem = useUpscaleQueueStore((state) => state.removeItem);
  const clear = useUpscaleQueueStore((state) => state.clear);
  const start = useUpscaleQueueStore((state) => state.start);
  const requestStop = useUpscaleQueueStore((state) => state.requestStop);
  const [model, setModel] = useState<UpscaleModel>("realcugan-se");
  const [scale, setScale] = useState(2);
  const [noise, setNoise] = useState(-1);
  const [tileSize, setTileSize] = useState(0);
  const [format, setFormat] = useState<UpscaleFormat>("png");
  const waiting = items.filter(
    (item) => item.status === "pending" || item.status === "failed",
  ).length;
  const finished = items.filter((item) => item.status === "done").length;

  // 모델이나 배율이 바뀌면 그 조합에 없는 배율 / denoise는 첫 값으로 되돌린다.
  function selectModel(nextModel: UpscaleModel, nextScale: number) {
    const levels = NOISE_LEVELS[nextModel];
    const validScale = levels[nextScale] ? nextScale : 2;
    setModel(nextModel);
    setScale(validScale);
    if (!levels[validScale].includes(noise)) setNoise(levels[validScale][0]);
  }

  async function pickImages() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      toast.error("이미지를 선택하려면 사진 접근 권한이 필요합니다.");
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 1,
    });
    if (picked.canceled) return;
    addImages(
      picked.assets.map(({ uri, width, height }) => ({ uri, width, height })),
    );
  }

  async function runUpscale() {
    const started = await start({ model, scale, noise, tileSize, format });
    if (started === "no-module") {
      toast.error("이 빌드에는 업스케일 모듈이 없습니다.");
    } else if (started === "no-permission") {
      toast.error("결과를 저장하려면 사진 접근 권한이 필요합니다.");
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
          accessibilityLabel="이미지 추가"
          onPress={() => void pickImages()}
          style={({ pressed }) => [
            styles.picker,
            pressed && styles.pickerPressed,
          ]}
        >
          <Text style={styles.pickerHint}>이미지 추가 (여러 장 선택 가능)</Text>
        </Pressable>

        {items.length > 0 ? (
          <View style={styles.queue}>
            <View style={styles.queueHeader}>
              <Text style={styles.optionTitle}>
                완료 {finished} / {items.length}
              </Text>
              {!busy ? (
                <Pressable
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={clear}
                >
                  <Text style={styles.queueClear}>목록 비우기</Text>
                </Pressable>
              ) : null}
            </View>
            {items.map((item) => (
              <QueueRow
                key={item.id}
                item={item}
                onRemove={() => removeItem(item.id)}
              />
            ))}
          </View>
        ) : null}

        <Chips
          title="Model"
          options={MODELS}
          value={model}
          disabled={busy}
          onChange={(next) => selectModel(next, scale)}
        />
        <Chips
          title="Scale"
          options={scaleOptions(model)}
          value={scale}
          disabled={busy}
          onChange={(next) => selectModel(model, next)}
        />
        <Chips
          title="Denoise"
          options={noiseOptions(model, scale)}
          value={noise}
          disabled={busy}
          onChange={setNoise}
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
          {busy ? (
            <PrimaryButton
              label={stopRequested ? "현재 장까지 처리 후 중단…" : "중단"}
              loading
              disabled={stopRequested}
              onPress={requestStop}
            />
          ) : (
            <PrimaryButton
              label={`업스케일하기 (${waiting}장)`}
              disabled={waiting === 0}
              onPress={() => void runUpscale()}
            />
          )}
        </View>
        <Text style={styles.meta}>
          결과는 한 장이 끝날 때마다 갤러리에 저장됩니다.
        </Text>
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
    height: 64,
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
  queue: {
    marginTop: tokens.space[8],
    gap: tokens.space[4],
  },
  queueHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  queueClear: {
    color: tokens.color.accent,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type.xs,
  },
  row: {
    padding: tokens.space[4],
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space[6],
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.card,
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: tokens.radius.sm,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: tokens.space[1],
  },
  rowTitle: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.medium,
    fontSize: tokens.type.sm,
  },
  rowStatus: {
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.medium,
    fontSize: tokens.type["2xs"],
  },
  rowStatusDone: {
    color: tokens.color.accent,
  },
  rowStatusFailed: {
    color: tokens.color.negative,
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
});
