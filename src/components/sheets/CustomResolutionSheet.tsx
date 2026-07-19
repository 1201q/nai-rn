import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Reanimated, {
  type SharedValue,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import {
  DEFAULT_NAI_RESOLUTION,
  NAI_RESOLUTIONS,
} from "../../constants/generation";
import {
  type CustomResolution,
  useGenerationStore,
} from "../../store/generationStore";
import { tokens } from "../../styles/tokens";
import {
  type RegisterSheetDraft,
  type SheetDraftController,
} from "./SheetDraft";

const RESOLUTION_STEP = 64;
const ROW_HEIGHT = 56;

type Positions = Record<string, number>;

function buildPositions(items: CustomResolution[]): Positions {
  const positions: Positions = {};
  items.forEach((item, index) => {
    positions[item.id] = index;
  });
  return positions;
}

function objectMove(positions: Positions, from: number, to: number): Positions {
  "worklet";
  const next: Positions = Object.assign({}, positions);
  for (const id in positions) {
    if (positions[id] === from) next[id] = to;
    else if (from < to && positions[id] > from && positions[id] <= to) {
      next[id] = positions[id] - 1;
    } else if (from > to && positions[id] < from && positions[id] >= to) {
      next[id] = positions[id] + 1;
    }
  }
  return next;
}

function clamp(value: number, min: number, max: number) {
  "worklet";
  return Math.min(Math.max(value, min), max);
}

function isDefaultResolution(width: number, height: number) {
  return (
    NAI_RESOLUTIONS.find((group) => group.group === "Normal")?.options.some(
      (item) => item.width === width && item.height === height,
    ) ?? false
  );
}

function snapDimension(value: string) {
  if (!value) return "";
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return "";
  return String(
    Math.max(RESOLUTION_STEP, Math.round(parsed / RESOLUTION_STEP) * 64),
  );
}

function listSignature(items: CustomResolution[]) {
  return items.map((item) => `${item.id}:${item.width}x${item.height}`).join("|");
}

function createCustomResolutionId() {
  return `custom-resolution-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const DraggableResolutionRow = memo(function DraggableResolutionRow({
  item,
  index,
  count,
  positions,
  activeId,
  activeY,
  onCommitOrder,
  onDelete,
}: {
  item: CustomResolution;
  index: number;
  count: number;
  positions: SharedValue<Positions>;
  activeId: SharedValue<string | null>;
  activeY: SharedValue<number>;
  onCommitOrder: () => void;
  onDelete: (id: string) => void;
}) {
  const startY = useSharedValue(index * ROW_HEIGHT);
  const mounted = useSharedValue(false);

  useEffect(() => {
    mounted.value = true;
  }, [mounted]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activateAfterLongPress(100)
        .onStart(() => {
          startY.value = (positions.value[item.id] ?? index) * ROW_HEIGHT;
          activeY.value = startY.value;
          activeId.value = item.id;
        })
        .onUpdate((event) => {
          activeY.value = clamp(
            startY.value + event.translationY,
            0,
            Math.max(0, count - 1) * ROW_HEIGHT,
          );
          const currentIndex = positions.value[item.id] ?? index;
          const nextIndex = clamp(
            Math.round(activeY.value / ROW_HEIGHT),
            0,
            count - 1,
          );
          if (nextIndex !== currentIndex) {
            positions.value = objectMove(
              positions.value,
              currentIndex,
              nextIndex,
            );
          }
        })
        .onFinalize(() => {
          activeId.value = null;
          runOnJS(onCommitOrder)();
        }),
    [
      activeId,
      activeY,
      count,
      index,
      item.id,
      onCommitOrder,
      positions,
      startY,
    ],
  );

  const animatedStyle = useAnimatedStyle(() => {
    const active = activeId.value === item.id;
    const targetY = (positions.value[item.id] ?? index) * ROW_HEIGHT;
    return {
      zIndex: active ? 2 : 0,
      elevation: active ? 4 : 0,
      transform: [
        {
          translateY: active
            ? activeY.value
            : mounted.value
              ? withTiming(targetY, { duration: 160 })
              : targetY,
        },
        { scale: active ? 1.02 : 1 },
      ],
    };
  });

  return (
    <Reanimated.View style={[styles.rowContainer, animatedStyle]}>
      <View style={styles.row}>
        <GestureDetector gesture={panGesture}>
          <View
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={`${item.width} x ${item.height} 순서 변경`}
            style={styles.dragHandle}
          >
            <Ionicons
              name="reorder-three-outline"
              size={24}
              color={tokens.color.textTertiary}
            />
          </View>
        </GestureDetector>
        <Text style={styles.rowLabel}>
          {item.width} x {item.height}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${item.width} x ${item.height} 삭제`}
          hitSlop={8}
          onPress={() => onDelete(item.id)}
          style={({ pressed }) => [
            styles.deleteButton,
            pressed && styles.controlPressed,
          ]}
        >
          <Ionicons
            name="trash-outline"
            size={18}
            color={tokens.color.negative}
          />
        </Pressable>
      </View>
    </Reanimated.View>
  );
});

export const CustomResolutionSheet = memo(
  function CustomResolutionSheet({
    registerDraft,
  }: {
    registerDraft: RegisterSheetDraft;
  }) {
    const resolution = useGenerationStore((state) => state.resolution);
    const setResolution = useGenerationStore((state) => state.setResolution);
    const customResolutions = useGenerationStore(
      (state) => state.customResolutions,
    );
    const setCustomResolutions = useGenerationStore(
      (state) => state.setCustomResolutions,
    );
    const initialSignature = useRef(listSignature(customResolutions)).current;
    const [items, setItems] = useState<CustomResolution[]>(customResolutions);
    const [widthText, setWidthText] = useState("");
    const [heightText, setHeightText] = useState("");
    const positions = useSharedValue<Positions>(buildPositions(items));
    const activeId = useSharedValue<string | null>(null);
    const activeY = useSharedValue(0);

    useEffect(() => {
      positions.value = buildPositions(items);
    }, [items, positions]);

    const width = Number.parseInt(widthText, 10);
    const height = Number.parseInt(heightText, 10);
    const inputsEmpty = widthText === "" && heightText === "";
    const inputsComplete = widthText !== "" && heightText !== "";
    const inputValid =
      inputsComplete &&
      Number.isSafeInteger(width) &&
      Number.isSafeInteger(height) &&
      width >= RESOLUTION_STEP &&
      height >= RESOLUTION_STEP &&
      width % RESOLUTION_STEP === 0 &&
      height % RESOLUTION_STEP === 0;
    const duplicate =
      inputValid &&
      (isDefaultResolution(width, height) ||
        items.some((item) => item.width === width && item.height === height));
    const listDirty = listSignature(items) !== initialSignature;
    const dirty = listDirty || !inputsEmpty;
    const canSave =
      dirty &&
      ((inputsEmpty && listDirty) || (inputValid && !duplicate));
    const inputInvalid = !inputsEmpty && (!inputValid || duplicate);

    const commitDraft = useCallback(() => {
      if (!canSave) return false;

      const nextItems = [...items];
      if (!inputsEmpty) {
        nextItems.push({
          id: createCustomResolutionId(),
          width,
          height,
        });
      }
      setCustomResolutions(nextItems);

      if (
        !isDefaultResolution(resolution.width, resolution.height) &&
        !nextItems.some(
          (item) =>
            item.width === resolution.width &&
            item.height === resolution.height,
        )
      ) {
        setResolution(DEFAULT_NAI_RESOLUTION);
      }
      return true;
    }, [
      canSave,
      height,
      inputsEmpty,
      items,
      resolution.height,
      resolution.width,
      setCustomResolutions,
      setResolution,
      width,
    ]);

    const commitDraftRef = useRef(commitDraft);
    useEffect(() => {
      commitDraftRef.current = commitDraft;
    }, [commitDraft]);

    const draftController = useMemo<SheetDraftController>(
      () => ({
        id: "resolutionCustom",
        dirty,
        canSave,
        promptTitle: "변경사항 저장",
        promptMessage: "변경한 커스텀 해상도를 저장하시겠습니까?",
        save: () => commitDraftRef.current(),
      }),
      [canSave, dirty],
    );

    useEffect(() => {
      registerDraft(draftController);
      return () => registerDraft(null);
    }, [draftController, registerDraft]);

    const handleDimensionChange = useCallback(
      (setter: (value: string) => void, value: string) => {
        setter(value.replace(/\D/g, ""));
      },
      [],
    );
    const handleSwap = useCallback(() => {
      setWidthText(heightText);
      setHeightText(widthText);
    }, [heightText, widthText]);
    const handleDelete = useCallback((id: string) => {
      setItems((current) => current.filter((item) => item.id !== id));
    }, []);
    const handleCommitOrder = useCallback(() => {
      const snapshot = positions.value;
      setItems((current) =>
        [...current].sort(
          (a, b) => (snapshot[a.id] ?? 0) - (snapshot[b.id] ?? 0),
        ),
      );
    }, [positions]);
    const listStyle = useMemo(
      () => [styles.list, { height: items.length * ROW_HEIGHT }],
      [items.length],
    );

    return (
      <View style={styles.content}>
        <View style={styles.inputRow}>
          <View
            style={[styles.inputBox, inputInvalid && styles.inputBoxInvalid]}
          >
            <Text style={styles.inputLabel}>Width</Text>
            <BottomSheetTextInput
              accessibilityLabel="커스텀 해상도 너비"
              value={widthText}
              onChangeText={(value) =>
                handleDimensionChange(setWidthText, value)
              }
              onEndEditing={() => setWidthText(snapDimension(widthText))}
              keyboardType="number-pad"
              returnKeyType="done"
              placeholder="0"
              placeholderTextColor={tokens.color.textMuted}
              style={styles.input}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="너비와 높이 교환"
            onPress={handleSwap}
            style={({ pressed }) => [
              styles.swapButton,
              pressed && styles.controlPressed,
            ]}
          >
            <Text style={styles.swapLabel}>x</Text>
          </Pressable>
          <View
            style={[styles.inputBox, inputInvalid && styles.inputBoxInvalid]}
          >
            <Text style={styles.inputLabel}>Height</Text>
            <BottomSheetTextInput
              accessibilityLabel="커스텀 해상도 높이"
              value={heightText}
              onChangeText={(value) =>
                handleDimensionChange(setHeightText, value)
              }
              onEndEditing={() => setHeightText(snapDimension(heightText))}
              keyboardType="number-pad"
              returnKeyType="done"
              placeholder="0"
              placeholderTextColor={tokens.color.textMuted}
              style={styles.input}
            />
          </View>
        </View>

        <Text style={styles.sectionLabel}>CUSTOM RESOLUTIONS</Text>
        {items.length > 0 ? (
          <View style={listStyle}>
            {items.map((item, index) => (
              <DraggableResolutionRow
                key={item.id}
                item={item}
                index={index}
                count={items.length}
                positions={positions}
                activeId={activeId}
                activeY={activeY}
                onCommitOrder={handleCommitOrder}
                onDelete={handleDelete}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              저장된 커스텀 해상도가 없습니다
            </Text>
          </View>
        )}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  content: {
    width: "100%",
    paddingTop: tokens.space[6],
  },
  inputRow: {
    marginHorizontal: tokens.space[4],
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space[4],
  },
  inputBox: {
    flex: 1,
    minWidth: 0,
    height: 58,
    paddingHorizontal: tokens.space[5],
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.sunken,
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space[3],
  },
  inputBoxInvalid: {
    borderColor: tokens.color.borderNegative,
  },
  inputLabel: {
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.medium,
    fontSize: tokens.type["2xs"],
  },
  input: {
    flex: 1,
    height: 56,
    paddingVertical: 0,
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.medium,
    fontSize: tokens.type.md,
    textAlign: "right",
  },
  swapButton: {
    width: 40,
    height: 48,
    borderRadius: tokens.radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.raised,
  },
  swapLabel: {
    color: tokens.color.textSecondary,
    fontFamily: tokens.font.semibold,
    fontSize: 18,
  },
  sectionLabel: {
    paddingHorizontal: tokens.space[6],
    paddingTop: tokens.space[12],
    paddingBottom: tokens.space[5],
    color: tokens.color.textMuted,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type["3xs"],
    letterSpacing: tokens.tracking.wide,
  },
  list: {
    position: "relative",
    width: "100%",
  },
  rowContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: ROW_HEIGHT,
  },
  row: {
    flex: 1,
    borderRadius: tokens.radius.lg,
    flexDirection: "row",
    alignItems: "center",
  },
  dragHandle: {
    width: 48,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: {
    flex: 1,
    color: tokens.color.textSecondary,
    fontFamily: tokens.font.medium,
    fontSize: 17,
    lineHeight: 22,
  },
  deleteButton: {
    width: 48,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    minHeight: 56,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.sunken,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyStateText: {
    color: tokens.color.textMuted,
    fontFamily: tokens.font.regular,
    fontSize: tokens.type.sm,
  },
  controlPressed: {
    opacity: 0.65,
  },
});
