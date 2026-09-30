import { memo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";

import {
  type GenerationRecord,
  resolveGenerationThumbnailUri,
} from "../../../lib/generationHistory";
import { tokens } from "../../../styles/tokens";

export const GRID_GAP = 8;

export const ActiveGenerationTile = memo(function ActiveGenerationTile({
  index,
  size,
  previewUri,
  selected,
  disabled,
  onPress,
}: {
  index: number;
  size: number;
  previewUri: string | null;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        marginRight: index % 3 === 2 ? 0 : GRID_GAP,
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
          <View pointerEvents="none" style={styles.currentRing} />
        ) : null}
      </Pressable>
    </View>
  );
});

export const HistorySheetTile = memo(function HistorySheetTile({
  item,
  index,
  size,
  selectionMode,
  selected,
  isCurrent,
  disabled,
  onPress,
  onLongPress,
}: {
  item: GenerationRecord;
  index: number;
  size: number;
  selectionMode: boolean;
  selected: boolean;
  isCurrent: boolean;
  disabled: boolean;
  onPress: (item: GenerationRecord) => void;
  onLongPress: (id: string) => void;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        marginRight: index % 3 === 2 ? 0 : GRID_GAP,
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
        disabled={disabled}
        delayLongPress={180}
        onPress={() => onPress(item)}
        onLongPress={() => onLongPress(item.id)}
        style={({ pressed }) => [
          StyleSheet.absoluteFill,
          styles.tile,
          pressed && styles.pressed,
        ]}
      >
        <ExpoImage
          source={{
            uri: resolveGenerationThumbnailUri(item),
          }}
          contentFit="contain"
          recyclingKey={item.id}
          transition={120}
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
              selected && styles.selectionIndicatorSelected,
            ]}
          >
            {selected ? (
              <Ionicons
                name="checkmark"
                size={14}
                color={tokens.color.onAccent}
              />
            ) : null}
          </View>
        ) : null}
        {isCurrent ? (
          <View pointerEvents="none" style={styles.currentRing} />
        ) : null}
        {selected ? (
          <View pointerEvents="none" style={styles.selectedRing} />
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
  selectionIndicatorSelected: {
    borderColor: tokens.color.accent,
    backgroundColor: tokens.color.accent,
  },
  pressed: {
    opacity: tokens.opacity.pressed,
  },
});
