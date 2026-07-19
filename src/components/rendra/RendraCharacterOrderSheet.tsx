import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
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
  type CharacterPrompt,
  useGenerationStore,
} from "../../store/generationStore";
import { tokens } from "../../styles/tokens";
import { RENDRA_CHARACTER_BADGE_COLORS } from "./RendraCharacterCard";
import {
  type RegisterRendraSheetDraft,
  type RendraSheetDraftController,
} from "./RendraSheetDraft";

const ROW_HEIGHT = 68;

type Positions = Record<string, number>;

function buildPositions(items: CharacterPrompt[]): Positions {
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

function orderSignature(items: CharacterPrompt[]) {
  return items.map((item) => item.id).join("|");
}

const DraggableCharacterRow = memo(function DraggableCharacterRow({
  item,
  index,
  count,
  positions,
  activeId,
  activeY,
  onCommitOrder,
}: {
  item: CharacterPrompt;
  index: number;
  count: number;
  positions: SharedValue<Positions>;
  activeId: SharedValue<string | null>;
  activeY: SharedValue<number>;
  onCommitOrder: () => void;
}) {
  const startY = useSharedValue(index * ROW_HEIGHT);
  const mounted = useSharedValue(false);
  const displayName = item.name?.trim() || `Character ${index + 1}`;
  const promptPreview = item.prompt.trim() || "프롬프트 없음";

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
      <View style={[styles.row, !item.enabled && styles.rowDisabled]}>
        <GestureDetector gesture={panGesture}>
          <View
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={`${displayName} 순서 변경`}
            style={styles.dragHandle}
          >
            <Ionicons
              name="reorder-three-outline"
              size={24}
              color={tokens.color.textTertiary}
            />
          </View>
        </GestureDetector>
        <View
          style={[
            styles.badge,
            {
              backgroundColor:
                RENDRA_CHARACTER_BADGE_COLORS[
                  index % RENDRA_CHARACTER_BADGE_COLORS.length
                ],
            },
          ]}
        >
          <Text style={styles.badgeText}>{index + 1}</Text>
        </View>
        <View style={styles.copy}>
          <Text style={styles.title} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {promptPreview}
          </Text>
        </View>
      </View>
    </Reanimated.View>
  );
});

export const RendraCharacterOrderSheet = memo(
  function RendraCharacterOrderSheet({
    registerDraft,
  }: {
    registerDraft: RegisterRendraSheetDraft;
  }) {
    const characterPrompts = useGenerationStore(
      (state) => state.characterPrompts,
    );
    const setCharacterPrompts = useGenerationStore(
      (state) => state.setCharacterPrompts,
    );
    const initialSignature = useRef(orderSignature(characterPrompts)).current;
    const [items, setItems] = useState<CharacterPrompt[]>(characterPrompts);
    const positions = useSharedValue<Positions>(buildPositions(items));
    const activeId = useSharedValue<string | null>(null);
    const activeY = useSharedValue(0);

    useEffect(() => {
      positions.value = buildPositions(items);
    }, [items, positions]);

    const dirty = orderSignature(items) !== initialSignature;

    const commitDraft = useCallback(() => {
      if (!dirty) return false;
      setCharacterPrompts(items);
      return true;
    }, [dirty, items, setCharacterPrompts]);

    const commitDraftRef = useRef(commitDraft);
    useEffect(() => {
      commitDraftRef.current = commitDraft;
    }, [commitDraft]);

    const draftController = useMemo<RendraSheetDraftController>(
      () => ({
        id: "characterOrder",
        dirty,
        canSave: dirty,
        promptTitle: "순서 변경을 저장할까요?",
        promptMessage: "저장하지 않은 캐릭터 순서 변경 사항이 있습니다.",
        save: () => commitDraftRef.current(),
      }),
      [dirty],
    );

    useEffect(() => {
      registerDraft(draftController);
      return () => registerDraft(null);
    }, [draftController, registerDraft]);

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
        <Text style={styles.description}>
          핸들을 드래그하여 생성에 사용할 캐릭터 순서를 변경합니다.
        </Text>
        <View style={listStyle}>
          {items.map((item, index) => (
            <DraggableCharacterRow
              key={item.id}
              item={item}
              index={index}
              count={items.length}
              positions={positions}
              activeId={activeId}
              activeY={activeY}
              onCommitOrder={handleCommitOrder}
            />
          ))}
        </View>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  content: {
    width: "100%",
  },
  description: {
    marginHorizontal: tokens.space[4],
    marginBottom: tokens.space[6],
    color: tokens.color.textMuted,
    fontFamily: tokens.font.regular,
    fontSize: tokens.type["2xs"],
    lineHeight: 17,
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
    paddingVertical: tokens.space[2],
  },
  row: {
    flex: 1,
    paddingRight: tokens.space[4],
    flexDirection: "row",
    alignItems: "center",
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.sunken,
  },
  rowDisabled: {
    opacity: 0.55,
  },
  dragHandle: {
    width: 48,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    width: 34,
    height: 34,
    marginRight: tokens.space[4],
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  badgeText: {
    color: tokens.color.onAccent,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type.sm,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type.sm,
    lineHeight: 18,
  },
  subtitle: {
    marginTop: 1,
    color: tokens.color.textMuted,
    fontFamily: tokens.font.regular,
    fontSize: tokens.type["2xs"],
    lineHeight: 15,
  },
});
