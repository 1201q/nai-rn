import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRouter } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { StatusBar } from "expo-status-bar";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Reanimated, {
  type SharedValue,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Line } from "react-native-svg";

import { IconButton } from "../../components/common/Buttons";
import { TapFeedbackPressable } from "../../components/common/TapFeedbackPressable";
import { useAppSheet } from "../../context/AppSheetContext";
import {
  DEFAULT_NAI_RESOLUTION,
  NAI_RESOLUTIONS,
  type NaiResolution,
} from "../../constants/generation";
import {
  type CustomResolution,
  useGenerationStore,
} from "../../store/generationStore";
import { usePredictiveBackHandler } from "../../native/predictiveBack";
import { tokens } from "../../styles/tokens";

const ROW_HEIGHT = 58;
const OPTION_TEXT_OFFSET = 51;
const NORMAL_RESOLUTIONS =
  NAI_RESOLUTIONS.find((group) => group.group === "Normal")?.options ?? [];

type Positions = Record<string, number>;

function resolutionKey(width: number, height: number) {
  return `${width}x${height}`;
}

function listSignature(items: readonly CustomResolution[]) {
  return items
    .map((item) => `${item.id}:${item.width}x${item.height}`)
    .join("|");
}

function buildPositions(items: readonly CustomResolution[]): Positions {
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

function Radio({ selected }: { selected: boolean }) {
  return (
    <View style={[styles.radio, selected && styles.radioSelected]}>
      {selected ? <View style={styles.radioDot} /> : null}
    </View>
  );
}

function ResolutionOptionRow({
  resolution,
  selected,
  showDivider,
  onSelect,
}: {
  resolution: NaiResolution;
  selected: boolean;
  showDivider: boolean;
  onSelect: () => void;
}) {
  const label = `${resolution.width} x ${resolution.height}`;
  return (
    <TapFeedbackPressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={onSelect}
      style={styles.optionRow}
      contentStyle={styles.optionRowTapContent}
      decoration={
        showDivider ? <View style={styles.rowDivider} /> : undefined
      }
    >
      <View style={styles.radioSlot}>
        <Radio selected={selected} />
      </View>
      <View style={styles.optionContent}>
        <Text style={[styles.optionLabel, selected && styles.selectedLabel]}>
          {label}
        </Text>
      </View>
    </TapFeedbackPressable>
  );
}

function SectionDivider() {
  return (
    <View style={styles.sectionDividerRow}>
      <Text style={styles.sectionLabel}>CUSTOM RESOLUTION</Text>
      <View style={styles.sectionDivider}>
        <Svg width="100%" height={1}>
          <Line
            x1={0}
            y1={0.5}
            x2="100%"
            y2={0.5}
            stroke={tokens.color.borderSubtleStrong}
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        </Svg>
      </View>
    </View>
  );
}

const DraggableResolutionRow = memo(function DraggableResolutionRow({
  item,
  index,
  count,
  selected,
  positions,
  activeId,
  activeY,
  onCommitOrder,
  onDelete,
}: {
  item: CustomResolution;
  index: number;
  count: number;
  selected: boolean;
  positions: SharedValue<Positions>;
  activeId: SharedValue<string | null>;
  activeY: SharedValue<number>;
  onCommitOrder: () => void;
  onDelete: (id: string) => void;
}) {
  const startY = useSharedValue(index * ROW_HEIGHT);

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
            : activeId.value !== null
              ? withTiming(targetY, { duration: 160 })
              : targetY,
        },
        { scale: active ? 1.02 : 1 },
      ],
    };
  });

  return (
    <Reanimated.View style={[styles.dragRowContainer, animatedStyle]}>
      <View style={styles.dragRow}>
        <GestureDetector gesture={panGesture}>
          <View
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={`${item.width} x ${item.height} 순서 변경`}
            style={styles.dragHandle}
          >
            <Ionicons
              name="reorder-two-outline"
              size={20}
              color={tokens.color.textTertiary}
            />
          </View>
        </GestureDetector>
        <View style={styles.dragRowContent}>
          <Text style={[styles.optionLabel, selected && styles.selectedLabel]}>
            {item.width} x {item.height}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${item.width} x ${item.height} 삭제`}
          hitSlop={6}
          onPress={() => onDelete(item.id)}
          style={({ pressed }) => [
            styles.deleteButton,
            pressed && styles.controlPressed,
          ]}
        >
          <Ionicons
            name="trash-outline"
            size={19}
            color={tokens.color.negative}
          />
        </Pressable>
      </View>
    </Reanimated.View>
  );
});

export function ResolutionScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation();
  const { open } = useAppSheet();
  const resolution = useGenerationStore((state) => state.resolution);
  const setResolution = useGenerationStore((state) => state.setResolution);
  const customResolutions = useGenerationStore(
    (state) => state.customResolutions,
  );
  const setCustomResolutions = useGenerationStore(
    (state) => state.setCustomResolutions,
  );
  const [isEditing, setIsEditing] = useState(false);
  const [baselineItems, setBaselineItems] =
    useState<CustomResolution[]>(customResolutions);
  const [draftItems, setDraftItems] =
    useState<CustomResolution[]>(customResolutions);
  const previousStoreItemsRef = useRef(customResolutions);
  const allowRemoveRef = useRef(false);
  const alertOpenRef = useRef(false);
  const positions = useSharedValue<Positions>(buildPositions(draftItems));
  const activeId = useSharedValue<string | null>(null);
  const activeY = useSharedValue(0);
  const selectedValue = resolutionKey(resolution.width, resolution.height);
  const dirty = listSignature(draftItems) !== listSignature(baselineItems);

  useEffect(() => {
    positions.value = buildPositions(draftItems);
  }, [draftItems, positions]);

  useEffect(() => {
    const previousStoreItems = previousStoreItemsRef.current;
    previousStoreItemsRef.current = customResolutions;
    if (!isEditing) return;

    const previousIds = new Set(previousStoreItems.map((item) => item.id));
    const addedItems = customResolutions.filter(
      (item) => !previousIds.has(item.id),
    );
    if (addedItems.length === 0) return;

    setBaselineItems(customResolutions);
    setDraftItems((current) => {
      const currentIds = new Set(current.map((item) => item.id));
      return [
        ...current,
        ...addedItems.filter((item) => !currentIds.has(item.id)),
      ];
    });
  }, [customResolutions, isEditing]);

  const commitDraft = useCallback(() => {
    if (dirty) {
      const selectedWasCustom = customResolutions.some(
        (item) =>
          item.width === resolution.width && item.height === resolution.height,
      );
      setCustomResolutions(draftItems);
      if (
        selectedWasCustom &&
        !draftItems.some(
          (item) =>
            item.width === resolution.width &&
            item.height === resolution.height,
        )
      ) {
        setResolution(DEFAULT_NAI_RESOLUTION);
      }
      setBaselineItems(draftItems);
    }
    setIsEditing(false);
  }, [
    customResolutions,
    dirty,
    draftItems,
    resolution.height,
    resolution.width,
    setCustomResolutions,
    setResolution,
  ]);

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !(isEditing && dirty) });
  }, [dirty, isEditing, navigation]);

  const showExitConfirmation = useCallback(
    (leave: () => void) => {
      if (alertOpenRef.current) return;

      alertOpenRef.current = true;
      const finishAlert = () => {
        alertOpenRef.current = false;
      };
      const continueBack = (save: boolean) => {
        finishAlert();
        if (save) commitDraft();
        leave();
      };

      Alert.alert(
        "변경사항 저장",
        "변경한 커스텀 해상도를 저장하시겠습니까?",
        [
          {
            text: "계속 편집",
            style: "cancel",
            onPress: finishAlert,
          },
          {
            text: "저장하지 않고 뒤로가기",
            style: "destructive",
            onPress: () => continueBack(false),
          },
          {
            text: "저장하고 뒤로가기",
            onPress: () => continueBack(true),
          },
        ],
        { cancelable: true, onDismiss: finishAlert },
      );
    },
    [commitDraft],
  );

  const requestBack = useCallback(() => {
    if (!isEditing || !dirty) {
      router.back();
      return;
    }

    showExitConfirmation(() => {
      allowRemoveRef.current = true;
      router.back();
    });
  }, [dirty, isEditing, router, showExitConfirmation]);

  usePreventRemove(isEditing && dirty, ({ data }) => {
    if (allowRemoveRef.current) {
      allowRemoveRef.current = false;
      navigation.dispatch(data.action);
      return;
    }

    showExitConfirmation(() => navigation.dispatch(data.action));
  });

  usePredictiveBackHandler(isEditing && dirty, { onCommit: requestBack });

  useEffect(() => {
    if (!isEditing || !dirty) return;

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        requestBack();
        return true;
      },
    );
    return () => subscription.remove();
  }, [dirty, isEditing, requestBack]);

  function enterEditMode() {
    setBaselineItems(customResolutions);
    setDraftItems(customResolutions);
    setIsEditing(true);
  }

  const handleCommitOrder = useCallback(() => {
    const snapshot = positions.value;
    setDraftItems((current) =>
      [...current].sort(
        (a, b) => (snapshot[a.id] ?? 0) - (snapshot[b.id] ?? 0),
      ),
    );
  }, [positions]);

  const handleDelete = useCallback((id: string) => {
    setDraftItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const displayedCustomItems = isEditing ? draftItems : customResolutions;
  const customListStyle = useMemo(
    () => [
      styles.customList,
      { height: displayedCustomItems.length * ROW_HEIGHT },
    ],
    [displayedCustomItems.length],
  );

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 80,
            paddingBottom: insets.bottom + tokens.space[16],
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.selectionCard}>
          {NORMAL_RESOLUTIONS.map((item, index) => {
            const selected =
              resolutionKey(item.width, item.height) === selectedValue;
            return isEditing ? (
              <View
                key={resolutionKey(item.width, item.height)}
                style={styles.editDefaultRow}
              >
                <Text
                  style={[styles.optionLabel, selected && styles.selectedLabel]}
                >
                  {item.width} x {item.height}
                </Text>
                {index < NORMAL_RESOLUTIONS.length - 1 ? (
                  <View style={styles.rowDivider} />
                ) : null}
              </View>
            ) : (
              <ResolutionOptionRow
                key={resolutionKey(item.width, item.height)}
                resolution={item}
                selected={selected}
                showDivider={index < NORMAL_RESOLUTIONS.length - 1}
                onSelect={() => setResolution(item)}
              />
            );
          })}

          <SectionDivider />

          <View style={customListStyle}>
            {isEditing
              ? draftItems.map((item, index) => (
                  <DraggableResolutionRow
                    key={item.id}
                    item={item}
                    index={index}
                    count={draftItems.length}
                    selected={
                      resolutionKey(item.width, item.height) === selectedValue
                    }
                    positions={positions}
                    activeId={activeId}
                    activeY={activeY}
                    onCommitOrder={handleCommitOrder}
                    onDelete={handleDelete}
                  />
                ))
              : customResolutions.map((item, index) => (
                  <View
                    key={item.id}
                    style={[
                      styles.staticCustomRow,
                      { top: index * ROW_HEIGHT },
                    ]}
                  >
                    <ResolutionOptionRow
                      resolution={{
                        label: "Custom Resolution",
                        width: item.width,
                        height: item.height,
                      }}
                      selected={
                        resolutionKey(item.width, item.height) === selectedValue
                      }
                      showDivider={false}
                      onSelect={() =>
                        setResolution({
                          label: "Custom Resolution",
                          width: item.width,
                          height: item.height,
                        })
                      }
                    />
                  </View>
                ))}
            {displayedCustomItems.map((item, index) => (
              <View
                key={`divider-${item.id}`}
                pointerEvents="none"
                style={[
                  styles.customListDivider,
                  { top: (index + 1) * ROW_HEIGHT - 1 },
                ]}
              />
            ))}
          </View>

          <TapFeedbackPressable
            accessibilityRole="button"
            accessibilityLabel="해상도 추가"
            onPress={() => open("resolutionCustom")}
            style={styles.addRow}
            contentStyle={styles.addRowTapContent}
          >
            <Ionicons name="add" size={21} color={tokens.color.accent} />
            <Text style={styles.addLabel}>해상도 추가</Text>
          </TapFeedbackPressable>
        </View>

        <Text style={styles.description}>
          해상도가 높을수록 디테일이 좋아지지만 Anlas 소모와 생성 시간이
          늘어납니다.
        </Text>
      </ScrollView>

      <View
        pointerEvents="box-none"
        style={[styles.header, { top: insets.top + 8 }]}
      >
        <IconButton
          icon="chevron-back"
          label="뒤로"
          size={40}
          onPress={requestBack}
          style={styles.backButton}
        />
        <View pointerEvents="none" style={styles.titleContainer}>
          <Text style={styles.title}>Resolution</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isEditing ? "변경사항 저장" : "해상도 편집"}
          onPress={isEditing ? commitDraft : enterEditMode}
          style={({ pressed }) => [
            styles.headerAction,
            pressed && styles.controlPressed,
          ]}
        >
          <Text
            style={[
              styles.headerActionLabel,
              isEditing && styles.headerActionLabelEditing,
            ]}
          >
            {isEditing ? "저장" : "편집"}
          </Text>
        </Pressable>
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
    paddingHorizontal: tokens.space[6],
  },
  header: {
    position: "absolute",
    right: tokens.space[8],
    left: tokens.space[8],
    zIndex: 2,
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    borderWidth: 0,
    backgroundColor: tokens.color.card,
  },
  titleContainer: {
    position: "absolute",
    top: 0,
    right: 72,
    bottom: 0,
    left: 72,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: 17,
    letterSpacing: tokens.tracking.tight,
  },
  headerAction: {
    minWidth: 58,
    height: 40,
    paddingHorizontal: tokens.space[7],
    alignItems: "center",
    justifyContent: "center",
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.card,
  },
  headerActionLabel: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type.md,
  },
  headerActionLabelEditing: {
    color: tokens.color.accent,
  },
  selectionCard: {
    overflow: "hidden",
    borderRadius: tokens.radius.settings,
    backgroundColor: tokens.color.card,
  },
  optionRow: {
    minHeight: ROW_HEIGHT,
    paddingRight: tokens.space[9],
    flexDirection: "row",
    alignItems: "center",
  },
  optionRowTapContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  radioSlot: {
    width: OPTION_TEXT_OFFSET,
    height: ROW_HEIGHT,
    paddingLeft: tokens.space[9],
    alignItems: "flex-start",
    justifyContent: "center",
  },
  radio: {
    width: 19,
    height: 19,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9.5,
    borderWidth: 1.5,
    borderColor: tokens.color.textMuted,
  },
  radioSelected: {
    borderWidth: 2,
    borderColor: tokens.color.accent,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 14,
    backgroundColor: tokens.color.accent,
  },
  optionContent: {
    minHeight: ROW_HEIGHT,
    flex: 1,
    justifyContent: "center",
  },
  optionLabel: {
    flexShrink: 1,
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.regular,
    fontSize: 17,
    lineHeight: 22,
  },
  selectedLabel: {
    color: tokens.color.accent,
  },
  rowDivider: {
    position: "absolute",
    right: tokens.space[9],
    bottom: 0,
    left: OPTION_TEXT_OFFSET,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  customListDivider: {
    position: "absolute",
    right: tokens.space[9],
    left: OPTION_TEXT_OFFSET,
    zIndex: 1,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  sectionDividerRow: {
    paddingHorizontal: tokens.space[9],
    paddingVertical: tokens.space[3],
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space[7],
  },
  sectionLabel: {
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.bold,
    fontSize: tokens.type["3xs"],
    lineHeight: 14,
    letterSpacing: tokens.tracking.wide,
  },
  sectionDivider: {
    flex: 1,
    height: 1,
  },
  editDefaultRow: {
    minHeight: ROW_HEIGHT,
    paddingLeft: OPTION_TEXT_OFFSET,
    paddingRight: tokens.space[9],
    justifyContent: "center",
  },
  customList: {
    position: "relative",
    width: "100%",
  },
  staticCustomRow: {
    position: "absolute",
    right: 0,
    left: 0,
    height: ROW_HEIGHT,
  },
  dragRowContainer: {
    position: "absolute",
    top: 0,
    right: 0,
    left: 0,
    height: ROW_HEIGHT,
  },
  dragRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tokens.color.card,
  },
  dragHandle: {
    width: OPTION_TEXT_OFFSET,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  dragRowContent: {
    minHeight: ROW_HEIGHT,
    flex: 1,
    justifyContent: "center",
  },
  deleteButton: {
    width: 52,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  addRow: {
    minHeight: ROW_HEIGHT,
    paddingHorizontal: tokens.space[9],
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space[6],
  },
  addRowTapContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space[6],
  },
  addLabel: {
    color: tokens.color.accent,
    fontFamily: tokens.font.semibold,
    fontSize: 17,
  },
  description: {
    marginTop: tokens.space[10],
    paddingHorizontal: tokens.space[7],
    color: tokens.color.textSecondary,
    fontFamily: tokens.font.regular,
    fontSize: tokens.type.base,
    lineHeight: 24,
  },
  controlPressed: {
    opacity: 0.65,
  },
});
