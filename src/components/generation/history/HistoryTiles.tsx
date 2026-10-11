import { memo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { useStore } from "zustand";

import {
  type GenerationRecord,
  resolveGenerationThumbnailUri,
} from "../../../lib/generationHistory";
import { tokens } from "../../../styles/tokens";
import type { HistorySelectionStore } from "./historySelection";

export const GRID_GAP = 8;
// 길게 누르기는 그리드의 드래그 선택 제스처가 처리한다. 스크린리더용 진입 경로만 남긴다.
const LONG_PRESS_ACTIONS = [{ name: "longpress" as const }];

// 타일이 작아지는 5열부터는 모서리와 선택 표시를 줄인다.
const COMPACT_COLUMNS = 5;

export const ActiveGenerationTile = memo(function ActiveGenerationTile({
  index,
  columns,
  size,
  previewUri,
  selected,
  disabled,
  onPress,
}: {
  index: number;
  columns: number;
  size: number;
  previewUri: string | null;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const compact = columns >= COMPACT_COLUMNS;

  return (
    <View
      style={{
        width: size,
        height: size,
        marginRight: index % columns === columns - 1 ? 0 : GRID_GAP,
        marginBottom: GRID_GAP,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="생성 중인 이미지 보기"
        accessibilityState={{ selected, disabled }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          StyleSheet.absoluteFill,
          styles.tile,
          compact && styles.compactRadius,
          pressed && styles.pressed,
        ]}
      >
        {previewUri ? (
          <ExpoImage
            source={{ uri: previewUri }}
            contentFit="contain"
            transition={0}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <View pointerEvents="none" style={styles.generatingIndicator}>
          <ActivityIndicator color={tokens.color.textPrimary} />
        </View>
        {selected ? (
          <View
            pointerEvents="none"
            style={[styles.currentRing, compact && styles.compactRadius]}
          />
        ) : null}
      </Pressable>
    </View>
  );
});

export const HistorySheetTile = memo(function HistorySheetTile({
  item,
  index,
  columns,
  size,
  selectionMode,
  selection,
  isCurrent,
  disabled,
  onPress,
  onLongPress,
}: {
  item: GenerationRecord;
  index: number;
  columns: number;
  size: number;
  selectionMode: boolean;
  selection: HistorySelectionStore;
  isCurrent: boolean;
  disabled: boolean;
  onPress: (item: GenerationRecord) => void;
  onLongPress: (id: string) => void;
}) {
  const selected = useStore(selection, (state) => state.ids.has(item.id));
  const compact = columns >= COMPACT_COLUMNS;

  return (
    <View
      style={{
        width: size,
        height: size,
        marginRight: index % columns === columns - 1 ? 0 : GRID_GAP,
        marginBottom: GRID_GAP,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          selectionMode
            ? selected
              ? "History 이미지 선택 해제"
              : "History 이미지 선택"
            : "메인 이미지로 표시"
        }
        accessibilityHint={
          isCurrent ? "현재 메인에 표시 중인 이미지" : undefined
        }
        accessibilityState={{
          selected: selectionMode ? selected : undefined,
          disabled,
        }}
        accessibilityActions={LONG_PRESS_ACTIONS}
        onAccessibilityAction={() => onLongPress(item.id)}
        disabled={disabled}
        onPress={() => onPress(item)}
        style={({ pressed }) => [
          StyleSheet.absoluteFill,
          styles.tile,
          compact && styles.compactRadius,
          pressed && styles.pressed,
        ]}
      >
        <ExpoImage
          source={{
            uri: resolveGenerationThumbnailUri(item),
          }}
          contentFit="contain"
          recyclingKey={item.id}
          transition={0}
          style={StyleSheet.absoluteFill}
        />
        {selected ? (
          <View pointerEvents="none" style={styles.selectedDim} />
        ) : null}
        {selectionMode ? (
          <View
            pointerEvents="none"
            style={[
              styles.selectionIndicator,
              compact && styles.selectionIndicatorCompact,
              selected && styles.selectionIndicatorSelected,
            ]}
          >
            {selected ? (
              <Ionicons
                name="checkmark"
                size={compact ? 11 : 14}
                color={tokens.color.onAccent}
              />
            ) : null}
          </View>
        ) : null}
        {isCurrent ? (
          <View
            pointerEvents="none"
            style={[styles.currentRing, compact && styles.compactRadius]}
          />
        ) : null}
        {selected ? (
          <View
            pointerEvents="none"
            style={[styles.selectedRing, compact && styles.compactRadius]}
          />
        ) : null}
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  tile: {
    overflow: "hidden",
    borderRadius: 12,
    backgroundColor: tokens.color.sunken,
  },
  compactRadius: {
    borderRadius: 8,
  },
  generatingIndicator: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 42,
    height: 42,
    marginTop: -21,
    marginLeft: -21,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10,10,12,0.62)",
  },
  selectedDim: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(10,10,12,0.38)",
  },
  selectedRing: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderWidth: 2,
    borderColor: tokens.color.accent,
    borderRadius: 12,
  },
  currentRing: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderWidth: 2,
    borderColor: tokens.color.accent,
    borderRadius: 12,
  },
  selectionIndicator: {
    position: "absolute",
    top: 7,
    left: 7,
    width: 22,
    height: 22,
    borderWidth: 1.5,
    borderColor: tokens.color.textPrimary,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10,10,12,0.42)",
  },
  selectionIndicatorCompact: {
    top: 4,
    left: 4,
    width: 17,
    height: 17,
  },
  selectionIndicatorSelected: {
    borderColor: tokens.color.accent,
    backgroundColor: tokens.color.accent,
  },
  pressed: {
    opacity: tokens.opacity.pressed,
  },
});
