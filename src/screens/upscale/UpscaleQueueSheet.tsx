import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheetKeyboardAwareScrollView } from "../../components/generation/BottomSheetKeyboardAwareScrollView";
import { useGenerationChromeMetrics } from "../../hooks/useGenerationChromeMetrics";
import {
  useUpscaleQueueStore,
  type UpscaleQueueItem,
} from "../../store/upscaleQueueStore";
import { tokens } from "../../styles/tokens";
import { useUpscaleSettingsStore } from "../../store/upscaleSettingsStore";
import {
  TabbedSheetHost,
  type TabbedSheetStage,
} from "../generation/sheets/TabbedSheetHost";
import type { SharedValue } from "react-native-reanimated";

function statusText(item: UpscaleQueueItem, progress: number) {
  if (item.status === "pending") return "대기";
  if (item.status === "running") {
    return `업스케일 중… ${Math.round(progress * 100)}%`;
  }
  if (item.status === "failed") {
    if (item.error?.includes("CPU_POLICY_UNAVAILABLE")) {
      return "실패: 선택한 CPU 코어 정책을 적용할 수 없습니다.";
    }
    return item.error?.includes("IMAGE_TOO_LARGE")
      ? "실패: 이미지가 너무 큽니다 (결과 최대 4096×4096 상당)"
      : `실패: ${item.error}`;
  }
  const result = item.result!;
  return [
    `${result.width} × ${result.height}`,
    `${(result.elapsedMs / 1000).toFixed(1)}초`,
    result.usedGpu
      ? "GPU"
      : `CPU ${result.cpuThreads}스레드 · ${["전체", "리틀", "빅"][result.cpuPolicy]}`,
    `적용 타일 ${result.tileSize}`,
    `${(result.bytes / 1024 / 1024).toFixed(2)}MB`,
  ].join(" · ");
}

function QueueRow({
  removable,
  item,
  onRemove,
}: {
  item: UpscaleQueueItem;
  removable: boolean;
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
        {item.originalFilename ? (
          <Text numberOfLines={1} style={styles.rowTitle}>
            {item.originalFilename}
          </Text>
        ) : null}
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
      {removable ? (
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

type QueueTab = "planned" | "running" | "completed";

function QueuePage({
  tab,
  active,
  hiddenHeight,
  items,
  activeBatchIds,
  chooseImageSource,
}: {
  tab: QueueTab;
  active: boolean;
  hiddenHeight: number;
  items: UpscaleQueueItem[];
  activeBatchIds: string[];
  chooseImageSource: () => void;
}) {
  const { sheetContentPaddingBottom } = useGenerationChromeMetrics();
  const removeItem = useUpscaleQueueStore((state) => state.removeItem);
  const busy = useUpscaleQueueStore((state) => state.running);
  const clear = useUpscaleQueueStore((state) => state.clear);
  const albumName = useUpscaleSettingsStore((state) =>
    state.settings.albumName.trim(),
  );
  return (
    <BottomSheetKeyboardAwareScrollView
      active={active}
      enabled={false}
      scrollEnabled={active}
      style={{ flex: 1 }}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: sheetContentPaddingBottom + hiddenHeight },
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {tab === "planned" ? (
        <>
          {items.length === 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="업스케일할 이미지 추가"
              onPress={chooseImageSource}
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
                <Ionicons
                  name="add"
                  size={18}
                  color={tokens.color.textPrimary}
                />
                <Text style={styles.pickerActionLabel}>이미지 선택</Text>
              </View>
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="업스케일할 이미지 더 추가"
              onPress={chooseImageSource}
              style={({ pressed }) => [
                styles.picker,
                pressed && styles.pressed,
              ]}
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
              <Ionicons
                name="add"
                size={22}
                color={tokens.color.textTertiary}
              />
            </Pressable>
          )}
          <Text style={styles.meta}>
            {busy
              ? "지금 추가한 이미지는 현재 작업에 포함되지 않습니다. 다음 업스케일 시작 시 처리합니다."
              : "예정 이미지와 실패한 이미지는 업스케일 버튼을 누르면 처리합니다."}
          </Text>
          <Text style={styles.meta}>
            {albumName
              ? `결과는 한 장이 끝날 때마다 갤러리의 '${albumName}' 앨범에 저장됩니다.`
              : "결과는 한 장이 끝날 때마다 갤러리에 저장됩니다."}
          </Text>
        </>
      ) : null}
      <View style={styles.queue}>
        <View style={styles.queueHeader}>
          <Text style={styles.queueTitle}>{items.length}장</Text>
          {!busy && items.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="업스케일 목록 비우기"
              hitSlop={8}
              onPress={clear}
            >
              <Text style={styles.queueClear}>전체 목록 비우기</Text>
            </Pressable>
          ) : null}
        </View>
        {items.map((item) => (
          <QueueRow
            key={item.id}
            item={item}
            removable={!activeBatchIds.includes(item.id)}
            onRemove={() => removeItem(item.id)}
          />
        ))}
        {items.length === 0 && tab !== "planned" ? (
          <Text style={styles.meta}>
            {tab === "running"
              ? "진행 중인 작업이 없습니다."
              : "완료된 작업이 없습니다."}
          </Text>
        ) : null}
      </View>
    </BottomSheetKeyboardAwareScrollView>
  );
}

export function UpscaleQueueSheet({
  stage,
  onStageChange,
  predictiveBackProgress,
  onAddImages,
}: {
  stage: TabbedSheetStage;
  onStageChange: (stage: TabbedSheetStage) => void;
  predictiveBackProgress: SharedValue<number>;
  onAddImages: () => void;
}) {
  const items = useUpscaleQueueStore((state) => state.items);
  const activeBatchIds = useUpscaleQueueStore((state) => state.activeBatchIds);
  const batchIds = new Set(activeBatchIds);
  const groups: Record<QueueTab, UpscaleQueueItem[]> = {
    planned: [],
    running: [],
    completed: [],
  };
  for (const item of items) {
    if (item.status === "done" || item.status === "failed")
      groups.completed.push(item);
    else if (batchIds.has(item.id)) groups.running.push(item);
    else groups.planned.push(item);
  }
  return (
    <TabbedSheetHost
      title="업스케일 이미지"
      preview={`예정 ${groups.planned.length} · 진행 중 ${groups.running.length} · 진행 완료 ${groups.completed.length}`}
      stage={stage}
      onStageChange={onStageChange}
      predictiveBackProgress={predictiveBackProgress}
      testIDPrefix="upscale"
      tabs={[
        { key: "planned", label: "예정", count: groups.planned.length },
        { key: "running", label: "진행 중", count: groups.running.length },
        {
          key: "completed",
          label: "진행 완료",
          count: groups.completed.length,
        },
      ]}
      renderPage={(tab, active, hiddenHeight) => (
        <QueuePage
          tab={tab}
          active={active}
          hiddenHeight={hiddenHeight}
          items={groups[tab]}
          activeBatchIds={activeBatchIds}
          chooseImageSource={onAddImages}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 18 },
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
});
