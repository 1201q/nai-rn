import { memo, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image as ExpoImage } from "expo-image";
import * as Haptics from "expo-haptics";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Reanimated, {
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";

import { isNearPosition } from "../../lib/characterPosition";
import { resolveGenerationImageUri } from "../../lib/generationHistory";
import {
  type CharacterPrompt,
  useGenerationStore,
} from "../../store/generationStore";
import { tokens } from "../../styles/tokens";

const MARKER_SIZE = 34;
// GenerationCanvas의 메인 이미지 블러와 같은 값.
const BACKDROP_BLUR_RADIUS = 28;

type Point = { id: string; enabled: boolean; x: number; y: number };

function clamp01(value: number) {
  "worklet";
  return Math.max(0, Math.min(1, value));
}

function selectCharacter(id: string, onSelect: (id: string) => void) {
  onSelect(id);
  Haptics.selectionAsync().catch(() => {});
}

// 공식 웹과 같이 소수 3자리로 저장한다.
function commitPosition(id: string, x: number, y: number) {
  useGenerationStore
    .getState()
    .setCharacterPromptPosition(
      id,
      Math.round(x * 1000) / 1000,
      Math.round(y * 1000) / 1000,
    );
}

const PositionMarker = memo(function PositionMarker({
  id,
  label,
  name,
  x,
  y,
  boardWidth,
  boardHeight,
  selected,
  enabled,
  points,
  dragging,
  onSelect,
}: {
  id: string;
  label: number;
  name: string;
  x: number;
  y: number;
  boardWidth: number;
  boardHeight: number;
  selected: boolean;
  enabled: boolean;
  points: Point[];
  // 드래그 중인 마커의 현재 좌표. 다른 마커가 겹침 표시를 바로 바꾸는 데 쓴다.
  dragging: SharedValue<{ id: string; x: number; y: number } | null>;
  onSelect: (id: string) => void;
}) {
  // 드래그 중에는 UI 스레드의 shared value만 바꾸고, 손을 뗄 때 store에 한 번 쓴다.
  const currentX = useSharedValue(x);
  const currentY = useSharedValue(y);
  const startX = useSharedValue(x);
  const startY = useSharedValue(y);

  useEffect(() => {
    currentX.value = x;
    currentY.value = y;
  }, [currentX, currentY, x, y]);

  const pan = Gesture.Pan()
    .maxPointers(1)
    .onBegin(() => {
      startX.value = currentX.value;
      startY.value = currentY.value;
      runOnJS(selectCharacter)(id, onSelect);
    })
    .onUpdate((event) => {
      currentX.value = clamp01(startX.value + event.translationX / boardWidth);
      currentY.value = clamp01(startY.value + event.translationY / boardHeight);
      dragging.value = { id, x: currentX.value, y: currentY.value };
    })
    .onEnd(() => {
      runOnJS(commitPosition)(id, currentX.value, currentY.value);
    });

  const markerStyle = useAnimatedStyle(() => {
    const position = { x: currentX.value, y: currentY.value };
    const dragged = dragging.value;
    const overlapping =
      enabled &&
      points.some(
        (point) =>
          point.id !== id &&
          point.enabled &&
          isNearPosition(position, dragged?.id === point.id ? dragged : point),
      );
    return {
      borderColor: overlapping
        ? tokens.color.negative
        : selected
          ? tokens.color.textPrimary
          : tokens.color.borderSubtleStrong,
      transform: [
        { translateX: position.x * boardWidth - MARKER_SIZE / 2 },
        { translateY: position.y * boardHeight - MARKER_SIZE / 2 },
      ],
    };
  });

  return (
    <GestureDetector gesture={pan}>
      <Reanimated.View
        accessible
        accessibilityLabel={`${name} 위치`}
        accessibilityState={{ selected }}
        hitSlop={6}
        style={[
          styles.marker,
          selected && styles.markerSelected,
          !enabled && styles.characterDisabled,
          markerStyle,
        ]}
      >
        <Text
          style={[styles.markerText, selected && styles.markerTextSelected]}
        >
          {label}
        </Text>
      </Reanimated.View>
    </GestureDetector>
  );
});

export function CharacterPositionBoard({
  characters,
  selectedId,
  onSelect,
}: {
  characters: CharacterPrompt[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}) {
  const resolution = useGenerationStore((state) => state.resolution);
  const currentGeneration = useGenerationStore(
    (state) => state.currentGeneration,
  );
  const blurred = useGenerationStore((state) => state.mainImageBlurred);
  const [areaSize, setAreaSize] = useState({ width: 0, height: 0 });
  const dragging = useSharedValue<{ id: string; x: number; y: number } | null>(
    null,
  );
  const points = useMemo(
    () =>
      characters.map(({ id, enabled, position }) => ({
        id,
        enabled,
        x: position.x,
        y: position.y,
      })),
    [characters],
  );

  const aspectRatio = resolution.width / resolution.height;
  let boardWidth = areaSize.width;
  let boardHeight = boardWidth / aspectRatio;
  if (boardHeight > areaSize.height) {
    boardHeight = areaSize.height;
    boardWidth = boardHeight * aspectRatio;
  }

  // 해상도가 다른 이미지는 좌표 기준이 어긋나므로 빈 사각형으로 둔다.
  const backdropUri =
    currentGeneration &&
    currentGeneration.width === resolution.width &&
    currentGeneration.height === resolution.height
      ? resolveGenerationImageUri(currentGeneration)
      : null;

  return (
    <View
      testID="position-area"
      style={styles.area}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setAreaSize((current) =>
          current.width === width && current.height === height
            ? current
            : { width, height },
        );
      }}
    >
      {boardWidth > 0 && boardHeight > 0 ? (
        <View
          testID="position-board"
          style={{ width: boardWidth, height: boardHeight }}
        >
          <View style={styles.backdrop}>
            {backdropUri ? (
              <ExpoImage
                source={{ uri: backdropUri }}
                blurRadius={blurred ? BACKDROP_BLUR_RADIUS : 0}
                contentFit="cover"
                transition={0}
                style={styles.backdropImage}
              />
            ) : null}
          </View>
          {characters.map((item, index) => (
            <PositionMarker
              key={item.id}
              id={item.id}
              label={index + 1}
              name={item.name?.trim() || `Character ${index + 1}`}
              x={item.position.x}
              y={item.position.y}
              boardWidth={boardWidth}
              boardHeight={boardHeight}
              selected={item.id === selectedId}
              enabled={item.enabled}
              points={points}
              dragging={dragging}
              onSelect={onSelect}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  area: {
    flex: 1,
    minHeight: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: tokens.color.promptBorder,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.sunken,
  },
  backdropImage: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    opacity: 0.4,
  },
  marker: {
    position: "absolute",
    top: 0,
    left: 0,
    width: MARKER_SIZE,
    height: MARKER_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderRadius: MARKER_SIZE / 2,
    backgroundColor: tokens.color.card,
  },
  markerSelected: {
    zIndex: 1,
    backgroundColor: tokens.color.textPrimary,
  },
  markerText: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type.sm,
  },
  markerTextSelected: {
    color: tokens.color.app,
  },
  characterDisabled: {
    opacity: 0.45,
  },
});
