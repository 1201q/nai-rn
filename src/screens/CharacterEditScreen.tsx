import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  type SharedValue,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import {
  type CharacterPrompt,
  useGenerationStore,
} from "../store/generationStore";
import type { CharacterEditScreenNavigationProp } from "../navigation/types";
import { triggerSelectionHaptic, BADGE_COLORS } from "./option/helpers";
import { light } from "./home/styles";

const ROW_HEIGHT = 68;
const DELETE_COLOR = "#e5484d";

type Positions = Record<string, number>;

function buildPositions(items: CharacterPrompt[]): Positions {
  const positions: Positions = {};
  items.forEach((item, index) => {
    positions[item.id] = index;
  });
  return positions;
}

function clamp(value: number, min: number, max: number) {
  "worklet";
  return Math.min(Math.max(value, min), max);
}

// 한 항목을 from 위치에서 to 위치로 옮길 때 나머지 항목 인덱스를 재배치한다.
function objectMove(positions: Positions, from: number, to: number): Positions {
  "worklet";
  const next: Positions = Object.assign({}, positions);
  for (const id in positions) {
    if (positions[id] === from) {
      next[id] = to;
    } else if (from < to && positions[id] > from && positions[id] <= to) {
      next[id] = positions[id] - 1;
    } else if (from > to && positions[id] < from && positions[id] >= to) {
      next[id] = positions[id] + 1;
    }
  }
  return next;
}

function DraggableRow({
  item,
  index,
  count,
  positions,
  activeId,
  activeY,
  selected,
  onToggleSelect,
  onCommitOrder,
}: {
  item: CharacterPrompt;
  index: number;
  count: number;
  positions: SharedValue<Positions>;
  activeId: SharedValue<string | null>;
  activeY: SharedValue<number>;
  selected: boolean;
  onToggleSelect: () => void;
  onCommitOrder: () => void;
}) {
  const startY = useSharedValue(0);
  const badgeColor = BADGE_COLORS[index % BADGE_COLORS.length];
  const title = item.prompt.trim() || `Character ${index + 1}`;

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .onStart(() => {
          startY.value = (positions.value[item.id] ?? index) * ROW_HEIGHT;
          activeY.value = startY.value;
          activeId.value = item.id;
        })
        .onUpdate((event) => {
          activeY.value = startY.value + event.translationY;
          const newIndex = clamp(
            Math.round(activeY.value / ROW_HEIGHT),
            0,
            count - 1,
          );
          const currentIndex = positions.value[item.id];
          if (newIndex !== currentIndex) {
            positions.value = objectMove(
              positions.value,
              currentIndex,
              newIndex,
            );
          }
        })
        .onEnd(() => {
          activeId.value = null;
          runOnJS(onCommitOrder)();
        }),
    [item.id, index, count, positions, activeId, activeY, startY, onCommitOrder],
  );

  const animatedStyle = useAnimatedStyle(() => {
    const isActive = activeId.value === item.id;
    const order = positions.value[item.id] ?? index;
    return {
      position: "absolute",
      left: 0,
      right: 0,
      top: 0,
      zIndex: isActive ? 10 : 0,
      elevation: isActive ? 10 : 0,
      transform: [
        {
          translateY: isActive
            ? activeY.value
            : withTiming(order * ROW_HEIGHT, { duration: 180 }),
        },
        { scale: withTiming(isActive ? 1.03 : 1, { duration: 120 }) },
      ],
    };
  });

  return (
    <Animated.View style={[styles.rowContainer, animatedStyle]}>
      <View style={[styles.rowCard, !item.enabled && styles.rowCardDisabled]}>
        <Pressable style={styles.checkbox} hitSlop={8} onPress={onToggleSelect}>
          <View
            style={[styles.checkboxCircle, selected && styles.checkboxChecked]}
          >
            {selected ? (
              <Ionicons name="checkmark" size={16} color={light.bg} />
            ) : null}
          </View>
        </Pressable>
        <View style={[styles.badge, { backgroundColor: badgeColor }]}>
          <Text style={styles.badgeText}>{index + 1}</Text>
        </View>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        <GestureDetector gesture={panGesture}>
          <View style={styles.dragHandle} hitSlop={8}>
            <Ionicons name="reorder-three" size={26} color={light.textHint} />
          </View>
        </GestureDetector>
      </View>
    </Animated.View>
  );
}

export function CharacterEditScreen() {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<CharacterEditScreenNavigationProp>();
  const characterPrompts = useGenerationStore((s) => s.characterPrompts);
  const setCharacterPrompts = useGenerationStore((s) => s.setCharacterPrompts);

  const [items, setItems] = useState<CharacterPrompt[]>(() => characterPrompts);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const positions = useSharedValue<Positions>(buildPositions(items));
  const activeId = useSharedValue<string | null>(null);
  const activeY = useSharedValue(0);

  // 드래그 커밋(setItems) 이후 shared value를 새 순서 기준으로 재동기화한다.
  useEffect(() => {
    positions.value = buildPositions(items);
  }, [items, positions]);

  // 드래그를 놓으면 새 순서를 바로 저장한다.
  function commitOrder() {
    const snapshot = positions.value;
    const reordered = [...items].sort(
      (a, b) => (snapshot[a.id] ?? 0) - (snapshot[b.id] ?? 0),
    );
    setItems(reordered);
    setCharacterPrompts(reordered);
    triggerSelectionHaptic();
  }

  function toggleSelect(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    triggerSelectionHaptic();
  }

  const hasDeletions = selectedIds.size > 0;

  function handleDelete() {
    setCharacterPrompts(items.filter((item) => !selectedIds.has(item.id)));
    triggerSelectionHaptic();
    navigation.goBack();
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

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
        <Text style={styles.headerTitle}>캐릭터 편집</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.listWrap}>
        <View style={{ height: items.length * ROW_HEIGHT }}>
          {items.map((item, index) => (
            <DraggableRow
              key={item.id}
              item={item}
              index={index}
              count={items.length}
              positions={positions}
              activeId={activeId}
              activeY={activeY}
              selected={selectedIds.has(item.id)}
              onToggleSelect={() => toggleSelect(item.id)}
              onCommitOrder={commitOrder}
            />
          ))}
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 18 }]}>
        <TouchableOpacity
          style={[
            styles.footerButton,
            hasDeletions ? styles.deleteButton : styles.doneButton,
          ]}
          activeOpacity={0.85}
          onPress={hasDeletions ? handleDelete : () => navigation.goBack()}
        >
          <Text
            style={[
              styles.footerText,
              hasDeletions ? styles.deleteText : styles.doneText,
            ]}
          >
            {hasDeletions ? `${selectedIds.size}개 삭제` : "완료"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: light.bg,
  },
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  headerCircleButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: light.surface,
  },
  headerTitle: {
    fontFamily: "serif",
    fontSize: 20,
    fontWeight: "600",
    color: light.textPrimary,
  },
  headerSpacer: {
    width: 44,
  },
  listWrap: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  rowContainer: {
    height: ROW_HEIGHT,
    justifyContent: "center",
  },
  rowCard: {
    height: ROW_HEIGHT - 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: light.surface,
  },
  rowCardDisabled: {
    opacity: 0.5,
  },
  checkbox: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: light.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    borderColor: light.accent,
    backgroundColor: light.accent,
  },
  badge: {
    minWidth: 26,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 7,
    paddingHorizontal: 6,
  },
  badgeText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
  rowTitle: {
    flex: 1,
    color: light.textPrimary,
    fontSize: 16,
    fontWeight: "800",
  },
  dragHandle: {
    width: 36,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 18,
    backgroundColor: light.bg,
  },
  footerButton: {
    height: 60,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  doneButton: {
    backgroundColor: light.surface,
  },
  deleteButton: {
    backgroundColor: light.surface,
  },
  footerText: {
    fontSize: 18,
    fontWeight: "800",
  },
  doneText: {
    color: light.textSecondary,
  },
  deleteText: {
    color: DELETE_COLOR,
  },
});
