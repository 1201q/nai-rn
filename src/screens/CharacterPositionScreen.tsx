import { useEffect, useRef, useState } from "react";
import {
  LayoutChangeEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Reanimated, {
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  type CharacterPrompt,
  useGenerationStore,
} from "../store/generationStore";
import { BADGE_COLORS, triggerSelectionHaptic } from "./option/helpers";
import { DetailPillHeader } from "../components/DetailPillHeader";
import { ScreenEdgeFade } from "../components/ScreenEdgeFade";
import { light } from "./home/styles";

type CanvasMetrics = {
  width: number;
  height: number;
  pageX: number;
  pageY: number;
};

const ZONES = [
  { label: "LT", x: 0.17, y: 0.15 },
  { label: "T", x: 0.5, y: 0.15 },
  { label: "RT", x: 0.83, y: 0.15 },
  { label: "L", x: 0.17, y: 0.5 },
  { label: "C", x: 0.5, y: 0.5 },
  { label: "R", x: 0.83, y: 0.5 },
  { label: "LB", x: 0.17, y: 0.85 },
  { label: "B", x: 0.5, y: 0.85 },
  { label: "RB", x: 0.83, y: 0.85 },
];

function clamp01(value: number) {
  "worklet";
  return Math.max(0, Math.min(1, value));
}

function characterTitle(item: CharacterPrompt, index: number) {
  const promptTitle = item.prompt.split(",")[0]?.trim();
  return promptTitle || `Character ${index + 1}`;
}

function ToggleSwitch({ value }: { value: boolean }) {
  const progress = useDerivedValue(() =>
    withTiming(value ? 1 : 0, { duration: 180 }),
  );
  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [light.surfaceAlt, light.accent],
    ),
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * 18 }],
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      ["#FFFFFF", light.accentText],
    ),
  }));
  return (
    <Reanimated.View style={[styles.toggleTrack, trackStyle]}>
      <Reanimated.View style={[styles.toggleThumb, thumbStyle]} />
    </Reanimated.View>
  );
}

function CharacterMarker({
  item,
  index,
  metrics,
  selected,
  onSelect,
  onPositionChange,
}: {
  item: CharacterPrompt;
  index: number;
  metrics: CanvasMetrics | null;
  selected: boolean;
  onSelect: () => void;
  onPositionChange: (id: string, x: number, y: number) => void;
}) {
  const color = BADGE_COLORS[index % BADGE_COLORS.length];

  const x = useSharedValue(item.position.x);
  const y = useSharedValue(item.position.y);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  // 스토어에서 좌표가 바뀌면 shared value 동기화 (드래그 중엔 미발생)
  useEffect(() => {
    x.value = item.position.x;
    y.value = item.position.y;
  }, [item.position.x, item.position.y, x, y]);

  const handleGrant = () => {
    onSelect();
    triggerSelectionHaptic();
  };

  const width = metrics?.width ?? 0;
  const height = metrics?.height ?? 0;

  const pan = Gesture.Pan()
    .onBegin(() => {
      startX.value = x.value;
      startY.value = y.value;
      runOnJS(handleGrant)();
    })
    .onUpdate((event) => {
      x.value = clamp01(startX.value + event.translationX / width);
      y.value = clamp01(startY.value + event.translationY / height);
    })
    .onEnd(() => {
      runOnJS(onPositionChange)(item.id, x.value, y.value);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value * width - 18 },
      { translateY: y.value * height - 18 },
      { scale: selected ? 1.08 : 1 },
    ],
  }));

  if (!metrics) return null;

  return (
    <GestureDetector gesture={pan}>
      <Reanimated.View
        style={[
          styles.marker,
          selected && styles.markerSelected,
          { backgroundColor: color },
          animatedStyle,
        ]}
      >
        <Text style={styles.markerText}>{index + 1}</Text>
      </Reanimated.View>
    </GestureDetector>
  );
}

export function CharacterPositionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const canvasRef = useRef<View>(null);
  const [canvasMetrics, setCanvasMetrics] = useState<CanvasMetrics | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const resolution = useGenerationStore((s) => s.resolution);
  const characterPrompts = useGenerationStore((s) => s.characterPrompts);
  const positionEnabled = useGenerationStore((s) => s.characterPositionEnabled);
  const setPositionEnabled = useGenerationStore(
    (s) => s.setCharacterPositionEnabled,
  );
  const setCharacterPromptPosition = useGenerationStore(
    (s) => s.setCharacterPromptPosition,
  );
  const setCharacterPrompts = useGenerationStore((s) => s.setCharacterPrompts);

  const activeCharacters = characterPrompts.filter((item) => item.enabled);
  const aspectRatio = resolution.width / resolution.height;

  const measureCanvas = () => {
    requestAnimationFrame(() => {
      canvasRef.current?.measureInWindow((pageX, pageY, width, height) => {
        if (width > 0 && height > 0) {
          setCanvasMetrics({ pageX, pageY, width, height });
        }
      });
    });
  };

  const handleCanvasLayout = (_event: LayoutChangeEvent) => {
    measureCanvas();
  };

  const toggleCharacterEnabled = (id: string) => {
    setCharacterPrompts(
      useGenerationStore
        .getState()
        .characterPrompts.map((item) =>
          item.id === id ? { ...item, enabled: !item.enabled } : item,
        ),
    );
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ScreenEdgeFade topHeight={insets.top + 64} />

      <DetailPillHeader
        title="캐릭터 위치"
        topInset={insets.top}
        onBack={() => router.back()}
      />

      <View style={[styles.content, { paddingTop: insets.top + 56 }]}>
        <View style={styles.summaryRow}>
          <View>
            <Text style={styles.summaryLabel}>Coordinate Prompting</Text>
            <Text style={styles.summaryText}>
              {positionEnabled
                ? "생성 시 캐릭터 좌표를 NovelAI에 전달합니다."
                : "좌표는 저장되지만 생성에는 아직 쓰지 않습니다."}
            </Text>
          </View>
          <View style={styles.summaryAction}>
            <TouchableOpacity
              activeOpacity={0.7}
              hitSlop={8}
              accessibilityRole="switch"
              accessibilityState={{ checked: positionEnabled }}
              accessibilityLabel="Coordinate Prompting"
              onPress={() => {
                triggerSelectionHaptic();
                setPositionEnabled(!positionEnabled);
              }}
            >
              <ToggleSwitch value={positionEnabled} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.canvasShell}>
          <View
            ref={canvasRef}
            onLayout={handleCanvasLayout}
            style={[styles.canvas, { aspectRatio }]}
          >
            <View pointerEvents="none" style={styles.grid}>
              {Array.from({ length: 9 }).map((_, index) => (
                <View key={index} style={styles.gridCell} />
              ))}
            </View>
            {canvasMetrics
              ? ZONES.map((zone) => (
                  <Text
                    key={zone.label}
                    pointerEvents="none"
                    style={[
                      styles.zoneLabel,
                      {
                        left: zone.x * canvasMetrics.width - 14,
                        top: zone.y * canvasMetrics.height - 9,
                      },
                    ]}
                  >
                    {zone.label}
                  </Text>
                ))
              : null}
            {activeCharacters.map((item) => {
              const index = characterPrompts.findIndex(
                (character) => character.id === item.id,
              );
              return (
                <CharacterMarker
                  key={item.id}
                  item={item}
                  index={index}
                  metrics={canvasMetrics}
                  selected={selectedId === item.id}
                  onSelect={() => setSelectedId(item.id)}
                  onPositionChange={setCharacterPromptPosition}
                />
              );
            })}
            {activeCharacters.length === 0 ? (
              <View pointerEvents="none" style={styles.emptyCanvas}>
                <Ionicons
                  name="location-outline"
                  size={36}
                  color={light.textHint}
                />
                <Text style={styles.emptyCanvasText}>활성 캐릭터가 없습니다</Text>
              </View>
            ) : null}
          </View>
        </View>

        <ScrollView
          style={styles.list}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 18 },
          ]}
        >
          {characterPrompts.map((item, index) => {
            const color = BADGE_COLORS[index % BADGE_COLORS.length];
            const selected = selectedId === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.78}
                style={[
                  styles.characterRow,
                  selected && styles.characterRowSelected,
                  !item.enabled && styles.characterRowDisabled,
                ]}
                onPress={() => setSelectedId(item.id)}
              >
                <View
                  style={[
                    styles.rowBadge,
                    positionEnabled
                      ? { backgroundColor: color }
                      : styles.rowBadgeMuted,
                  ]}
                >
                  <Text
                    style={[
                      styles.rowBadgeText,
                      !positionEnabled && styles.rowBadgeTextMuted,
                    ]}
                  >
                    {index + 1}
                  </Text>
                </View>
                <View style={styles.rowMain}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {characterTitle(item, index)}
                  </Text>
                  <Text style={styles.rowCoords}>
                    X {item.position.x.toFixed(2)} / Y{" "}
                    {item.position.y.toFixed(2)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.rowIconButton}
                  activeOpacity={0.78}
                  accessibilityRole="button"
                  accessibilityLabel={
                    item.enabled ? "캐릭터 비활성화" : "캐릭터 활성화"
                  }
                  onPress={() => toggleCharacterEnabled(item.id)}
                >
                  <Ionicons
                    name={item.enabled ? "eye-outline" : "eye-off-outline"}
                    size={20}
                    color={item.enabled ? light.textPrimary : light.textHint}
                  />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: light.bg,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    gap: 14,
  },
  summaryRow: {
    minHeight: 68,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: light.surface,
  },
  summaryLabel: {
    color: light.textPrimary,
    fontSize: 14,
    fontWeight: "800",
  },
  summaryText: {
    marginTop: 4,
    maxWidth: 260,
    color: light.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  summaryAction: {
    flexDirection: "row",
    alignItems: "center",
  },
  toggleTrack: {
    width: 44,
    height: 26,
    borderRadius: 13,
    padding: 3,
    justifyContent: "center",
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  canvasShell: {
    flex: 1,
    minHeight: 320,
    alignItems: "center",
    justifyContent: "center",
  },
  canvas: {
    width: "100%",
    maxHeight: "100%",
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: light.input,
    borderWidth: 1,
    borderColor: light.border,
  },
  grid: {
    ...StyleSheet.absoluteFill,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  gridCell: {
    width: "33.3333%",
    height: "33.3333%",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(247,247,247,0.12)",
  },
  zoneLabel: {
    position: "absolute",
    width: 28,
    color: "rgba(247,247,247,0.28)",
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
  },
  marker: {
    position: "absolute",
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  markerSelected: {
    borderWidth: 2,
    borderColor: light.textPrimary,
  },
  markerText: {
    color: light.accentText,
    fontSize: 14,
    fontWeight: "900",
  },
  emptyCanvas: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyCanvasText: {
    color: light.textHint,
    fontSize: 13,
    fontWeight: "700",
  },
  list: {
    maxHeight: 220,
  },
  listContent: {
    gap: 8,
  },
  characterRow: {
    minHeight: 58,
    borderRadius: 15,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: light.surface,
    borderWidth: 1,
    borderColor: "transparent",
  },
  characterRowSelected: {
    borderColor: light.accent,
    backgroundColor: "rgba(245,243,194,0.08)",
  },
  characterRowDisabled: {
    opacity: 0.55,
  },
  rowBadge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  rowBadgeMuted: {
    backgroundColor: light.surfaceAlt,
  },
  rowBadgeText: {
    color: light.accentText,
    fontSize: 12,
    fontWeight: "900",
  },
  rowBadgeTextMuted: {
    color: light.textHint,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    color: light.textPrimary,
    fontSize: 14,
    fontWeight: "800",
  },
  rowCoords: {
    marginTop: 4,
    color: light.textHint,
    fontSize: 12,
    fontWeight: "700",
  },
  rowIconButton: {
    width: 40,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
