import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { toast } from "sonner-native";
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
  selected,
  onSelect,
  onSave,
}: {
  item: UpscaleQueueItem;
  removable: boolean;
  onRemove: () => void;
  selected: boolean;
  onSelect: () => void;
  onSave: () => void;
}) {
  // 진행 중인 행만 진행률을 구독한다.
  const progress = useUpscaleQueueStore((state) =>
    item.status === "running" ? state.progress : 0,
  );
  return (
    <View style={styles.row}>
      {item.status === "done" && !item.saved && item.result?.uri ? (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel={`${item.originalFilename ?? item.id} 선택`}
          accessibilityState={{ checked: selected, disabled: item.saving }}
          disabled={item.saving}
          onPress={onSelect}
          hitSlop={8}
        >
          <Ionicons
            name={selected ? "checkbox" : "square-outline"}
            size={22}
            color={tokens.color.accent}
          />
        </Pressable>
      ) : null}
      <Image
        source={{ uri: item.result?.uri ?? item.uri }}
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
        {item.status === "done" ? (
          <Text
            numberOfLines={2}
            style={[
              styles.rowStatus,
              item.saveError ? styles.rowStatusFailed : null,
            ]}
          >
            {item.saving
              ? "저장 중…"
              : item.saved
                ? "갤러리에 저장됨"
                : item.saveError
                  ? `저장 실패: ${item.saveError}`
                  : "앱에 보관됨 · 저장 가능"}
          </Text>
        ) : null}
      </View>
      {item.status === "done" && item.result?.uri && !item.saved ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`결과 저장 ${item.originalFilename ?? item.id}`}
          disabled={item.saving}
          accessibilityState={{ disabled: item.saving }}
          onPress={onSave}
          hitSlop={8}
        >
          <Ionicons
            name="download-outline"
            size={22}
            color={item.saving ? tokens.color.textMuted : tokens.color.accent}
          />
        </Pressable>
      ) : null}
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
  const [selected, setSelected] = useState<string[]>([]);
  const saveItems = useUpscaleQueueStore((state) => state.saveItems);
  const persistenceError = useUpscaleQueueStore(
    (state) => state.persistenceError,
  );
  const saving = useUpscaleQueueStore((state) =>
    state.items.some((item) => item.saving),
  );
  const autoSave = useUpscaleSettingsStore((state) => state.settings.autoSave);
  const eligible = items
    .filter(
      (item) =>
        item.status === "done" &&
        item.result?.uri &&
        !item.saved &&
        !item.saving,
    )
    .map((item) => item.id);
  const selectedIds = selected.filter((id) => eligible.includes(id));
  async function save(ids: string[]) {
    const result = await saveItems(ids);
    if (result.saved)
      toast.success(`${result.saved}장을 갤러리에 저장했습니다.`);
    if (result.failed)
      toast.error(
        result.denied
          ? "사진 저장 권한이 필요합니다."
          : `${result.failed}장을 저장하지 못했습니다. 다시 시도할 수 있습니다.`,
      );
    setSelected((current) =>
      current.filter(
        (id) =>
          !useUpscaleQueueStore.getState().items.find((item) => item.id === id)
            ?.saved,
      ),
    );
  }
  function confirmRemove(item: UpscaleQueueItem) {
    if (item.status === "done" && !item.saved)
      Alert.alert(
        "결과 삭제",
        "아직 갤러리에 저장하지 않은 결과를 삭제할까요?",
        [
          { text: "취소", style: "cancel" },
          {
            text: "삭제",
            style: "destructive",
            onPress: () => removeItem(item.id),
          },
        ],
      );
    else removeItem(item.id);
  }
  function confirmClear() {
    if (
      useUpscaleQueueStore
        .getState()
        .items.some((item) => item.status === "done" && !item.saved)
    )
      Alert.alert(
        "전체 목록 비우기",
        "저장하지 않은 결과도 함께 삭제됩니다. 계속할까요?",
        [
          { text: "취소", style: "cancel" },
          { text: "삭제", style: "destructive", onPress: clear },
        ],
      );
    else clear();
  }
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
            {!autoSave
              ? "결과를 앱에 보관합니다. 완료 탭에서 갤러리에 저장할 수 있습니다."
              : albumName
                ? `결과는 한 장이 끝날 때마다 갤러리의 '${albumName}' 앨범에 저장됩니다.`
                : "결과는 한 장이 끝날 때마다 갤러리에 저장됩니다."}
          </Text>
        </>
      ) : null}
      <View style={styles.queue}>
        {tab === "completed" && persistenceError ? (
          <Text style={styles.rowStatusFailed}>{persistenceError}</Text>
        ) : null}
        <View style={styles.queueHeader}>
          <Text style={styles.queueTitle}>{items.length}장</Text>
          {!busy && !saving && items.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="업스케일 목록 비우기"
              hitSlop={8}
              onPress={confirmClear}
            >
              <Text style={styles.queueClear}>전체 목록 비우기</Text>
            </Pressable>
          ) : null}
        </View>
        {tab === "completed" && eligible.length > 0 ? (
          <View style={styles.queueHeader}>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                setSelected(
                  selectedIds.length === eligible.length ? [] : eligible,
                )
              }
            >
              <Text style={styles.queueClear}>
                {selectedIds.length === eligible.length
                  ? "선택 해제"
                  : "전체 선택"}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="선택한 결과 저장"
              disabled={selectedIds.length === 0}
              onPress={() => void save(selectedIds)}
            >
              <Text
                style={[
                  styles.queueClear,
                  selectedIds.length === 0 && { opacity: 0.4 },
                ]}
              >{`선택 저장 (${selectedIds.length})`}</Text>
            </Pressable>
          </View>
        ) : null}
        {items.map((item) => (
          <QueueRow
            key={item.id}
            item={item}
            removable={!activeBatchIds.includes(item.id) && !item.saving}
            selected={selectedIds.includes(item.id)}
            onSelect={() =>
              setSelected((current) =>
                current.includes(item.id)
                  ? current.filter((id) => id !== item.id)
                  : [...current, item.id],
              )
            }
            onSave={() => void save([item.id])}
            onRemove={() => confirmRemove(item)}
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
