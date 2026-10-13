import { useCallback, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PortalHost } from "@gorhom/portal";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  cancelAnimation,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { toast } from "sonner-native";

import {
  DETAIL_FIXED_HEADER_CONTENT_OFFSET,
  DetailHeaderOverlay,
} from "../../components/common/DetailScrollHeader";
import { useGenerationChromeMetrics } from "../../hooks/useGenerationChromeMetrics";
import {
  type GenerationRecord,
  resolveGenerationImageUri,
} from "../../lib/generationHistory";
import type { PredictiveBackEvent } from "../../native/predictiveBack";
import { PREDICTIVE_BACK_CANCEL_SPRING } from "../../native/predictiveBackStyle";
import { useBackHandler } from "../../native/useBackHandler";
import {
  useUpscaleQueueStore,
  type UpscaleQueueItem,
  type UpscaleSettings,
} from "../../store/upscaleQueueStore";
import { tokens } from "../../styles/tokens";
import {
  ActionBar,
  ActionIconButton,
  ActionProgressButton,
} from "../generation/GenerationActionBar";
import { UtilitySheetHost } from "../generation/GenerationSheetScaffold";
import { DEFAULT_UPSCALE_SETTINGS } from "./upscaleOptions";
import {
  UPSCALE_SELECT_PORTAL_HOST,
  UpscaleSettingsSheetHost,
} from "./UpscaleSettingsSheet";

type UpscaleSheet = "settings" | "history";

function statusText(item: UpscaleQueueItem, progress: number) {
  if (item.status === "pending") return "대기";
  if (item.status === "running") {
    return `업스케일 중… ${Math.round(progress * 100)}%`;
  }
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
  // 진행 중인 행만 진행률을 구독한다.
  const progress = useUpscaleQueueStore((state) =>
    item.status === "running" ? state.progress : 0,
  );
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
          {statusText(item, progress)}
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

function UpscaleAction({ settings }: { settings: UpscaleSettings }) {
  const items = useUpscaleQueueStore((state) => state.items);
  const busy = useUpscaleQueueStore((state) => state.running);
  const stopRequested = useUpscaleQueueStore((state) => state.stopRequested);
  const progress = useUpscaleQueueStore((state) => state.progress);
  const start = useUpscaleQueueStore((state) => state.start);
  const requestStop = useUpscaleQueueStore((state) => state.requestStop);
  const waiting = items.filter(
    (item) => item.status === "pending" || item.status === "failed",
  ).length;
  const processed = items.filter(
    (item) => item.status === "done" || item.status === "failed",
  ).length;

  async function runUpscale() {
    const started = await start(settings);
    if (started === "no-module") {
      toast.error("이 빌드에는 업스케일 모듈이 없습니다.");
    } else if (started === "no-permission") {
      toast.error("결과를 저장하려면 사진 접근 권한이 필요합니다.");
    }
  }

  const label = !busy
    ? waiting > 0
      ? `업스케일 (${waiting}장)`
      : "업스케일"
    : stopRequested
      ? "중단하는 중…"
      : `중단 (${Math.min(processed + 1, items.length)}/${items.length}) · ${Math.round(progress * 100)}%`;

  return (
    <ActionProgressButton
      label={label}
      icon={busy ? "stop" : "expand-outline"}
      loading={busy}
      percent={items.length > 0 ? (processed + progress) / items.length : 0}
      disabled={busy ? stopRequested : waiting === 0}
      onPress={busy ? requestStop : () => void runUpscale()}
    />
  );
}

export function UpscaleScreen() {
  const { topInset, promptCollapsedHeight } = useGenerationChromeMetrics();
  const router = useRouter();
  const scrollY = useRef(new Animated.Value(0)).current;
  const items = useUpscaleQueueStore((state) => state.items);
  const busy = useUpscaleQueueStore((state) => state.running);
  const addImages = useUpscaleQueueStore((state) => state.addImages);
  const removeItem = useUpscaleQueueStore((state) => state.removeItem);
  const clear = useUpscaleQueueStore((state) => state.clear);
  const [settings, setSettings] = useState(DEFAULT_UPSCALE_SETTINGS);
  const [sheet, setSheet] = useState<UpscaleSheet | null>(null);
  const [historyVisible, setHistoryVisible] = useState(false);
  const settingsBackProgress = useSharedValue(0);
  const historyBackProgress = useSharedValue(0);
  const finished = items.filter((item) => item.status === "done").length;

  const toggleSheet = useCallback((next: UpscaleSheet) => {
    setSheet((current) => (current === next ? null : next));
  }, []);
  const handleSettingsOpenChange = useCallback((open: boolean) => {
    setSheet((current) =>
      open ? "settings" : current === "settings" ? null : current,
    );
  }, []);
  const closeHistory = useCallback(() => {
    setSheet((current) => (current === "history" ? null : current));
  }, []);
  // History에서는 이미지를 캔버스에 띄우는 대신 업스케일 목록에 넣는다.
  const addHistoryImage = useCallback(
    (item: GenerationRecord) => {
      addImages([
        {
          uri: resolveGenerationImageUri(item),
          width: item.width,
          height: item.height,
        },
      ]);
      toast("업스케일 목록에 추가했습니다.");
    },
    [addImages],
  );

  const hasHistorySheet = sheet === "history" || historyVisible;
  const trackPredictiveBack = useCallback(
    (event: PredictiveBackEvent) => {
      const active = hasHistorySheet
        ? historyBackProgress
        : settingsBackProgress;
      cancelAnimation(active);
      active.value = event.progress;
    },
    [hasHistorySheet, historyBackProgress, settingsBackProgress],
  );
  const cancelPredictiveBack = useCallback(() => {
    settingsBackProgress.value = withSpring(0, PREDICTIVE_BACK_CANCEL_SPRING);
    historyBackProgress.value = withSpring(0, PREDICTIVE_BACK_CANCEL_SPRING);
  }, [historyBackProgress, settingsBackProgress]);

  useBackHandler(sheet !== null || historyVisible, {
    onBack: () => setSheet(null),
    onStart: trackPredictiveBack,
    onProgress: trackPredictiveBack,
    onCancel: cancelPredictiveBack,
  });

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

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      <Animated.ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: topInset + DETAIL_FIXED_HEADER_CONTENT_OFFSET,
            // 접힌 Settings 시트와 액션바에 가리지 않게 한다.
            paddingBottom: promptCollapsedHeight + 24,
          },
        ]}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {items.length === 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="업스케일할 이미지 추가"
            onPress={() => void pickImages()}
            style={({ pressed }) => [
              styles.picker,
              styles.emptyPicker,
              pressed && styles.pressed,
            ]}
          >
            <View style={[styles.pickerIcon, styles.emptyPickerIcon]}>
              <Ionicons
                name="images-outline"
                size={30}
                color={tokens.color.textTertiary}
              />
            </View>
            <View style={styles.emptyPickerCopy}>
              <Text style={styles.emptyPickerTitle}>
                어떤 이미지를 업스케일할까요?
              </Text>
              <Text style={styles.emptyPickerText}>
                {
                  "이미지를 선택해 더 선명하게 만들어 보세요.\n여러 장을 한 번에 추가할 수 있어요."
                }
              </Text>
            </View>
            <View style={styles.pickerAction}>
              <Ionicons name="add" size={18} color={tokens.color.textPrimary} />
              <Text style={styles.pickerActionLabel}>이미지 선택</Text>
            </View>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="업스케일할 이미지 더 추가"
            onPress={() => void pickImages()}
            style={({ pressed }) => [styles.picker, pressed && styles.pressed]}
          >
            <View style={styles.pickerIcon}>
              <Ionicons
                name="images-outline"
                size={22}
                color={tokens.color.textTertiary}
              />
            </View>
            <View style={styles.pickerCopy}>
              <Text style={styles.pickerTitle}>이미지 더 추가</Text>
              <Text style={styles.pickerText}>
                여러 장을 한 번에 선택할 수 있어요
              </Text>
            </View>
            <Ionicons name="add" size={22} color={tokens.color.textTertiary} />
          </Pressable>
        )}

        {items.length > 0 ? (
          <View style={styles.queue}>
            <View style={styles.queueHeader}>
              <Text style={styles.queueTitle}>
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

        <Text style={styles.meta}>
          결과는 한 장이 끝날 때마다 갤러리에 저장됩니다.
        </Text>
      </Animated.ScrollView>

      <DetailHeaderOverlay
        title="이미지 업스케일"
        scrollY={scrollY}
        topInset={topInset}
        onBack={() => router.back()}
        showMore={false}
        hideCompactTitleOnScroll
      />

      <UpscaleSettingsSheetHost
        open={sheet === "settings"}
        settings={settings}
        disabled={busy}
        predictiveBackProgress={settingsBackProgress}
        onOpenChange={handleSettingsOpenChange}
        onChange={setSettings}
      />

      <UtilitySheetHost
        sheet={sheet === "history" ? "history" : null}
        predictiveBackProgress={historyBackProgress}
        onClose={closeHistory}
        onVisibilityChange={setHistoryVisible}
        onSelectGeneration={addHistoryImage}
      />

      <ActionBar>
        <ActionIconButton
          icon="settings-sharp"
          label={sheet === "settings" ? "Settings 닫기" : "Settings 열기"}
          active={sheet === "settings"}
          onPress={() => toggleSheet("settings")}
        />
        <UpscaleAction settings={settings} />
        <ActionIconButton
          icon="time-outline"
          label={sheet === "history" ? "History 닫기" : "History 열기"}
          active={sheet === "history"}
          onPress={() => toggleSheet("history")}
        />
      </ActionBar>

      <View pointerEvents="box-none" style={styles.selectPortalLayer}>
        <PortalHost name={UPSCALE_SELECT_PORTAL_HOST} />
      </View>
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
    paddingHorizontal: tokens.space[8],
  },
  picker: {
    padding: tokens.space[8],
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space[7],
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    backgroundColor: tokens.color.card,
  },
  emptyPicker: {
    minHeight: 280,
    paddingVertical: tokens.space[16],
    paddingHorizontal: tokens.space[10],
    flexDirection: "column",
    justifyContent: "center",
    gap: tokens.space[10],
    borderStyle: "dashed",
  },
  pickerIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.raised,
  },
  emptyPickerIcon: {
    width: 64,
    height: 64,
    borderRadius: tokens.radius.xl,
  },
  pickerCopy: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  pickerTitle: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type.base,
  },
  pickerText: {
    color: tokens.color.textMuted,
    fontFamily: tokens.font.regular,
    fontSize: tokens.type["2xs"],
    lineHeight: 19,
  },
  emptyPickerCopy: {
    alignItems: "center",
    gap: tokens.space[4],
  },
  emptyPickerTitle: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: 17,
  },
  emptyPickerText: {
    color: tokens.color.textMuted,
    fontFamily: tokens.font.regular,
    fontSize: tokens.type.xs,
    lineHeight: 21,
    textAlign: "center",
  },
  pickerAction: {
    minHeight: 40,
    paddingHorizontal: tokens.space[9],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.space[3],
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    backgroundColor: tokens.color.raised,
  },
  pickerActionLabel: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type.sm,
  },
  pressed: {
    opacity: tokens.opacity.pressed,
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
  queueTitle: {
    color: tokens.color.textSecondary,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type.sm,
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
    marginTop: tokens.space[10],
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.medium,
    fontSize: tokens.type.xs,
    textAlign: "center",
  },
  selectPortalLayer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 120,
    elevation: 120,
  },
});
