import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Image as ExpoImage } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { BlurView } from "expo-blur";
import * as MediaLibrary from "expo-media-library";

import { useGenerationStore } from "../store/generationStore";
import {
  type GenerationRecord,
  resolveGenerationImageUri,
  resolveGenerationThumbnailUri,
} from "../lib/generationHistory";
import { ImagePreviewModal } from "./main/ImagePreviewModal";
import { FloatingPillHeader } from "../components/FloatingPillHeader";
import { ScreenEdgeFade } from "../components/ScreenEdgeFade";
import { light } from "./home/styles";

const HistoryTile = memo(function HistoryTile({
  item,
  index,
  itemSize,
  gap,
  isSelectionMode,
  isSelected,
  onOpenPreview,
  onEnterSelectionMode,
  onToggleSelection,
}: {
  item: GenerationRecord;
  index: number;
  itemSize: number;
  gap: number;
  isSelectionMode: boolean;
  isSelected: boolean;
  onOpenPreview: (index: number) => void;
  onEnterSelectionMode: (id: string) => void;
  onToggleSelection: (id: string) => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.86}
      onPress={() => {
        if (isSelectionMode) {
          onToggleSelection(item.id);
          return;
        }
        onOpenPreview(index);
      }}
      onLongPress={() => onEnterSelectionMode(item.id)}
      style={[
        styles.tile,
        {
          width: itemSize,
          height: itemSize,
          marginRight: index % 3 === 2 ? 0 : gap,
          marginBottom: gap,
        },
      ]}
    >
      <ExpoImage
        source={{
          uri:
            resolveGenerationThumbnailUri(item) ??
            resolveGenerationImageUri(item),
        }}
        contentFit="cover"
        recyclingKey={item.id}
        transition={120}
        style={styles.tileImage}
      />
      {isSelectionMode ? (
        <View
          style={[
            styles.selectionCircle,
            isSelected && styles.selectionCircleSelected,
          ]}
        >
          {isSelected ? (
            <Ionicons name="checkmark" size={14} color="#1c1c1c" />
          ) : null}
        </View>
      ) : null}
    </TouchableOpacity>
  );
});

export function HistoryScreen({
  onSelectionModeChange,
}: {
  onSelectionModeChange?: (isSelectionMode: boolean) => void;
}) {
  const insets = useSafeAreaInsets();
  const generationHistory = useGenerationStore((s) => s.generationHistory);
  const deleteGenerations = useGenerationStore((s) => s.deleteGenerations);

  const { width } = useWindowDimensions();
  const gap = 2;
  const itemSize = (width - gap * 2) / 3;

  const previewAnimation = useRef(new Animated.Value(0)).current;
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [isSavingSelected, setIsSavingSelected] = useState(false);
  const [isDeletingSelected, setIsDeletingSelected] = useState(false);

  const scrollY = useRef(new Animated.Value(0)).current;
  const listRef = useRef<FlatList>(null);
  const selectedCount = selectedIds.size;
  const allSelected =
    generationHistory.length > 0 && selectedCount === generationHistory.length;

  const openPreview = useCallback((index: number) => {
    setPreviewIndex(index);
    setIsPreviewOpen(true);
    previewAnimation.setValue(0);
    Animated.timing(previewAnimation, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [previewAnimation]);

  function closePreview() {
    Animated.timing(previewAnimation, {
      toValue: 0,
      duration: 140,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setIsPreviewOpen(false);
    });
  }

  function exitSelectionMode() {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  }

  const enterSelectionMode = useCallback((id: string) => {
    Haptics.selectionAsync().catch(() => {});
    setIsSelectionMode(true);
    setSelectedIds(new Set([id]));
  }, []);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  function toggleSelectAll() {
    Haptics.selectionAsync().catch(() => {});
    if (allSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(generationHistory.map((item) => item.id)));
  }

  async function handleSaveSelected() {
    if (selectedCount === 0 || isSavingSelected || isDeletingSelected) return;

    const selectedRecords = generationHistory.filter((item) =>
      selectedIds.has(item.id),
    );

    try {
      setIsSavingSelected(true);
      const permission = await MediaLibrary.requestPermissionsAsync(true, [
        "photo",
      ]);

      if (!permission.granted) {
        Alert.alert("저장 실패", "사진 저장 권한이 필요합니다.");
        return;
      }

      await Promise.all(
        selectedRecords.map((record) =>
          MediaLibrary.saveToLibraryAsync(resolveGenerationImageUri(record)),
        ),
      );
      Alert.alert(
        "저장됨",
        `${selectedRecords.length}개의 이미지를 휴대폰 저장소에 저장했습니다.`,
      );
    } catch {
      Alert.alert(
        "저장 실패",
        "선택한 이미지를 휴대폰 저장소에 저장하지 못했습니다.",
      );
    } finally {
      setIsSavingSelected(false);
    }
  }

  async function handleDeleteSelected() {
    if (selectedCount === 0 || isSavingSelected || isDeletingSelected) return;

    const ids = [...selectedIds];

    try {
      setIsDeletingSelected(true);
      await deleteGenerations(ids);
      exitSelectionMode();
    } catch {
      Alert.alert("삭제 실패", "선택한 이미지를 history에서 삭제하지 못했습니다.");
    } finally {
      setIsDeletingSelected(false);
    }
  }

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (!isSelectionMode) return false;
        exitSelectionMode();
        return true;
      },
    );
    return () => subscription.remove();
  }, [isSelectionMode]);

  useEffect(() => {
    onSelectionModeChange?.(isSelectionMode);
    return () => onSelectionModeChange?.(false);
  }, [isSelectionMode, onSelectionModeChange]);

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      <Animated.FlatList
        ref={listRef}
        data={generationHistory}
        keyExtractor={(item) => item.id}
        numColumns={3}
        showsVerticalScrollIndicator={false}
        style={styles.list}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false },
        )}
        contentContainerStyle={[
          generationHistory.length === 0 && styles.emptyGrid,
          {
            paddingTop: insets.top + 56,
            paddingBottom: insets.bottom + (selectedCount > 0 ? 126 : 18),
          },
        ]}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No history yet</Text>
            <Text style={styles.emptyText}>
              Generated images will appear here.
            </Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <HistoryTile
            item={item}
            index={index}
            itemSize={itemSize}
            gap={gap}
            isSelectionMode={isSelectionMode}
            isSelected={selectedIds.has(item.id)}
            onOpenPreview={openPreview}
            onEnterSelectionMode={enterSelectionMode}
            onToggleSelection={toggleSelection}
          />
        )}
      />

      {selectedCount > 0 ? (
        <ScreenEdgeFade bottomHeight={insets.bottom + 140} />
      ) : null}

      <FloatingPillHeader
        title="History"
        titleNode={
          isSelectionMode ? (
            <View style={styles.selectionHeaderContent}>
              <Pressable
                style={[
                  styles.selectionHeaderCheckbox,
                  allSelected && styles.selectionHeaderCheckboxSelected,
                ]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: allSelected }}
                onPress={toggleSelectAll}
              >
                {allSelected ? (
                  <Ionicons name="checkmark" size={14} color="#1c1c1c" />
                ) : null}
              </Pressable>
              <Text style={styles.selectionHeaderCount}>{selectedCount}</Text>
            </View>
          ) : (
            <Text style={styles.historyHeaderTitle}>History</Text>
          )
        }
        scrollY={scrollY}
        topInset={insets.top}
        right={
          isSelectionMode ? (
            <Pressable
              style={styles.selectionHeaderCancel}
              accessibilityRole="button"
              onPress={exitSelectionMode}
            >
              <Text style={styles.selectionHeaderCancelText}>취소</Text>
            </Pressable>
          ) : undefined
        }
        rightCircle={false}
        onTitlePress={
          isSelectionMode
            ? undefined
            : () =>
                listRef.current?.scrollToOffset({ offset: 0, animated: true })
        }
      />

      {selectedCount > 0 ? (
        <View
          pointerEvents="box-none"
          style={[styles.selectionActionWrap, { bottom: insets.bottom + 16 }]}
        >
          <View style={styles.selectionActionShadow}>
            <BlurView
              intensity={60}
              tint="light"
              style={styles.selectionActionBar}
            >
              <Pressable
                style={[
                  styles.selectionActionButton,
                  (isSavingSelected || isDeletingSelected) &&
                    styles.selectionActionButtonDisabled,
                ]}
                accessibilityRole="button"
                disabled={isSavingSelected || isDeletingSelected}
                onPress={handleSaveSelected}
              >
                {isSavingSelected ? (
                  <ActivityIndicator color={light.textPrimary} size="small" />
                ) : (
                  <Ionicons
                    name="arrow-down-outline"
                    size={20}
                    color={light.textPrimary}
                  />
                )}
                <Text style={styles.selectionActionText}>저장</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.selectionActionButton,
                  (isSavingSelected || isDeletingSelected) &&
                    styles.selectionActionButtonDisabled,
                ]}
                accessibilityRole="button"
                disabled={isSavingSelected || isDeletingSelected}
                onPress={handleDeleteSelected}
              >
                {isDeletingSelected ? (
                  <ActivityIndicator color={light.textPrimary} size="small" />
                ) : (
                  <Ionicons
                    name="trash-outline"
                    size={20}
                    color={light.textPrimary}
                  />
                )}
                <Text style={styles.selectionActionText}>삭제</Text>
              </Pressable>
            </BlurView>
          </View>
        </View>
      ) : null}

      <ImagePreviewModal
        visible={isPreviewOpen}
        images={generationHistory.map(resolveGenerationImageUri)}
        initialIndex={previewIndex}
        animation={previewAnimation}
        onClose={closePreview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: light.bg,
  },
  list: {
    flex: 1,
  },
  emptyGrid: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    alignItems: "center",
    gap: 6,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: light.textPrimary,
  },
  emptyText: {
    fontSize: 13,
    color: light.textSecondary,
  },
  tile: {
    backgroundColor: light.surface,
  },
  tileImage: {
    width: "100%",
    height: "100%",
  },
  selectionCircle: {
    position: "absolute",
    top: 8,
    left: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#ffffff",
    backgroundColor: "rgba(0,0,0,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  selectionCircleSelected: {
    backgroundColor: "#ffffff",
    borderColor: "rgba(0,0,0,0.28)",
  },
  historyHeaderTitle: {
    height: 30,
    fontSize: 20,
    lineHeight: 30,
    fontWeight: "600",
    color: light.textPrimary,
  },
  selectionHeaderContent: {
    height: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  selectionHeaderCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#ffffff",
    backgroundColor: "rgba(0,0,0,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  selectionHeaderCheckboxSelected: {
    backgroundColor: "#ffffff",
    borderColor: "rgba(0,0,0,0.18)",
  },
  selectionHeaderCount: {
    minWidth: 18,
    fontSize: 20,
    lineHeight: 30,
    fontWeight: "700",
    color: light.textPrimary,
  },
  selectionHeaderCancel: {
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  selectionHeaderCancelText: {
    fontSize: 17,
    lineHeight: 30,
    fontWeight: "700",
    color: light.textPrimary,
  },
  selectionActionWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 30,
    elevation: 30,
  },
  selectionActionShadow: {
    borderRadius: 999,
    shadowColor: "#00000076",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  selectionActionBar: {
    flexDirection: "row",
    borderRadius: 999,
    padding: 4,
    gap: 4,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,1)",
  },
  selectionActionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
  },
  selectionActionButtonDisabled: {
    opacity: 0.55,
  },
  selectionActionText: {
    fontSize: 13,
    fontWeight: "600",
    color: light.textPrimary,
  },
});
