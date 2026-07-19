import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Reanimated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Image as ExpoImage } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { BlurView } from "expo-blur";
import * as MediaLibrary from "expo-media-library";
import * as Clipboard from "expo-clipboard";
import { File } from "expo-file-system";

import { useGenerationStore } from "../../store/generationStore";
import {
  type GenerationRecord,
  resolveGenerationImageUri,
  resolveGenerationThumbnailUri,
} from "../../lib/generationHistory";
import { ImagePreviewModal } from "../../components/image-preview/ImagePreviewModal";
import { useAppSheet } from "../../context/AppSheetContext";
import { ScreenEdgeFade } from "../../components/common/ScreenEdgeFade";
import {
  DETAIL_HEADER_TOP_OFFSET,
  DetailHeaderOverlay,
  DetailScrollTitle,
} from "../../components/common/DetailScrollHeader";
import { useScalePress } from "../../hooks/useScalePress";
import { tokens } from "../../styles/tokens";

const AnimatedPressable = Reanimated.createAnimatedComponent(Pressable);

const TileImage = memo(function TileImage({
  item,
}: {
  item: GenerationRecord;
}) {
  return (
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
  );
});

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
  const { onPressIn, onPressOut, scaleStyle } = useScalePress({
    scaleTo: 0.97,
  });
  return (
    <AnimatedPressable
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={() => {
        if (isSelectionMode) {
          onToggleSelection(item.id);
          return;
        }
        onOpenPreview(index);
      }}
      onLongPress={() => onEnterSelectionMode(item.id)}
      delayLongPress={180}
      style={[
        styles.tile,
        scaleStyle,
        {
          width: itemSize,
          height: itemSize,
          marginRight: index % 3 === 2 ? 0 : gap,
          marginBottom: gap,
        },
      ]}
    >
      <TileImage item={item} />
      {isSelected ? (
        <View pointerEvents="none" style={styles.selectedDim} />
      ) : null}
      {isSelectionMode ? (
        <>
          <View
            style={[
              styles.selectionCircle,
              isSelected && styles.selectionCircleSelected,
            ]}
          >
            {isSelected ? (
              <Ionicons
                name="checkmark"
                size={14}
                color={tokens.color.onAccent}
              />
            ) : null}
          </View>
          <Pressable
            style={styles.expandButton}
            onPress={() => onOpenPreview(index)}
            hitSlop={4}
          >
            <Ionicons
              name="expand-outline"
              size={12}
              color={tokens.color.textPrimary}
            />
          </Pressable>
        </>
      ) : null}
    </AnimatedPressable>
  );
});

function HistorySelectionHeader({
  topInset,
  scrollY,
  selectedCount,
  allSelected,
  onToggleSelectAll,
  onCancelSelection,
}: {
  topInset: number;
  scrollY: Animated.Value;
  selectedCount: number;
  allSelected: boolean;
  onToggleSelectAll: () => void;
  onCancelSelection: () => void;
}) {
  const fadeOpacity = scrollY.interpolate({
    inputRange: [0, 24],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const buttonBackgroundOpacity = scrollY.interpolate({
    inputRange: [0, 30],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[styles.selectionHeaderFade, { opacity: fadeOpacity }]}
      >
        <ScreenEdgeFade
          topHeight={topInset + 70}
          color={tokens.color.app}
          transparentColor="rgba(10,10,11,0)"
        />
      </Animated.View>

      <View
        pointerEvents="box-none"
        style={[
          styles.selectionHeader,
          { top: topInset + DETAIL_HEADER_TOP_OFFSET + 6 },
        ]}
      >
        <View style={styles.selectionHeaderContent}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.selectionHeaderButtonBackground,
              { opacity: buttonBackgroundOpacity },
            ]}
          />
          <Pressable
            accessibilityRole="checkbox"
            accessibilityLabel="전체 선택"
            accessibilityState={{ checked: allSelected }}
            hitSlop={6}
            onPress={onToggleSelectAll}
            style={[
              styles.selectionHeaderCheckbox,
              allSelected && styles.selectionHeaderCheckboxSelected,
            ]}
          >
            {allSelected ? (
              <Ionicons
                name="checkmark"
                size={12}
                color={tokens.color.onAccent}
              />
            ) : null}
          </Pressable>
          <Text style={styles.selectionHeaderCount}>
            {selectedCount}개 선택
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="선택 취소"
          hitSlop={6}
          onPress={onCancelSelection}
          style={({ pressed }) => [
            styles.selectionHeaderCancel,
            pressed && styles.pressed,
          ]}
        >
          <Animated.View
            pointerEvents="none"
            style={[
              styles.selectionHeaderButtonBackground,
              { opacity: buttonBackgroundOpacity },
            ]}
          />
          <Text style={styles.selectionHeaderCancelText}>취소</Text>
        </Pressable>
      </View>
    </>
  );
}

export function HistoryScreen({
  onSelectionModeChange,
  onBack,
}: {
  onSelectionModeChange?: (isSelectionMode: boolean) => void;
  onBack?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const generationHistory = useGenerationStore((s) => s.generationHistory);
  const deleteGenerations = useGenerationStore((s) => s.deleteGenerations);
  const { isOpen: isSheetOpen } = useAppSheet();

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
  const bgUI = useRef(new Animated.Value(0)).current;
  const barUI = useRef(new Animated.Value(0)).current;
  const [bgMounted, setBgMounted] = useState(false);
  const [barMounted, setBarMounted] = useState(false);
  const previewImages = useMemo(
    () => generationHistory.map(resolveGenerationImageUri),
    [generationHistory],
  );
  const selectedCount = selectedIds.size;
  const hasSelection = selectedCount > 0;
  const allSelected =
    generationHistory.length > 0 && selectedCount === generationHistory.length;

  const openPreview = useCallback(
    (index: number) => {
      setPreviewIndex(index);
      setIsPreviewOpen(true);
      previewAnimation.setValue(0);
      Animated.timing(previewAnimation, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
    },
    [previewAnimation],
  );

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
          MediaLibrary.Asset.create(resolveGenerationImageUri(record)),
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

  async function handleSavePreview(index: number) {
    const record = generationHistory[index];
    if (!record) return;

    const permission = await MediaLibrary.requestPermissionsAsync(true, [
      "photo",
    ]);
    if (!permission.granted) {
      Alert.alert("저장 실패", "사진 저장 권한이 필요합니다.");
      return;
    }

    try {
      await MediaLibrary.Asset.create(resolveGenerationImageUri(record));
      Alert.alert("저장됨", "이미지를 휴대폰 저장소에 저장했습니다.");
    } catch {
      Alert.alert("저장 실패", "이미지를 휴대폰 저장소에 저장하지 못했습니다.");
    }
  }

  async function handleCopyPreview(index: number) {
    const record = generationHistory[index];
    if (!record) return;

    try {
      const base64 = await new File(resolveGenerationImageUri(record)).base64();
      await Clipboard.setImageAsync(base64);
      Alert.alert("복사됨", "이미지를 클립보드에 복사했습니다.");
    } catch {
      Alert.alert("복사 실패", "이미지를 클립보드에 복사하지 못했습니다.");
    }
  }

  async function handleDeletePreview(index: number) {
    const record = generationHistory[index];
    if (!record) return;

    try {
      await deleteGenerations([record.id]);
      closePreview();
    } catch {
      Alert.alert("삭제 실패", "이미지를 history에서 삭제하지 못했습니다.");
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
      Alert.alert(
        "삭제 실패",
        "선택한 이미지를 history에서 삭제하지 못했습니다.",
      );
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

  // 미리보기 하드웨어 백(이전 RN Modal onRequestClose 대체). 시트가 preview 위에
  // 떠 있으면 시트가 먼저 닫히도록 양보(전역 호스트 핸들러로 넘김).
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (isPreviewOpen && !isSheetOpen) {
          closePreview();
          return true;
        }
        return false;
      },
    );
    return () => subscription.remove();
  }, [isPreviewOpen, isSheetOpen]);

  useEffect(() => {
    onSelectionModeChange?.(isSelectionMode);
    return () => onSelectionModeChange?.(false);
  }, [isSelectionMode, onSelectionModeChange]);

  // 배경 페이드: 선택 모드 동안 유지 (선택 개수 0 이어도 흐림 유지).
  useEffect(() => {
    if (isSelectionMode) {
      setBgMounted(true);
      Animated.timing(bgUI, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(bgUI, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setBgMounted(false);
      });
    }
  }, [isSelectionMode, bgUI]);

  // 컨트롤 메뉴: 선택 개수 > 0 일 때만. 진입 시 배경보다 살짝 늦게 등장.
  useEffect(() => {
    if (hasSelection) {
      setBarMounted(true);
      Animated.timing(barUI, {
        toValue: 1,
        duration: 220,
        delay: 120,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(barUI, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setBarMounted(false);
      });
    }
  }, [hasSelection, barUI]);

  const barTranslateY = barUI.interpolate({
    inputRange: [0, 1],
    outputRange: [16, 0],
  });

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      <Animated.FlatList
        data={generationHistory}
        keyExtractor={(item) => item.id}
        numColumns={3}
        showsVerticalScrollIndicator={false}
        style={styles.list}
        removeClippedSubviews
        initialNumToRender={15}
        maxToRenderPerBatch={9}
        windowSize={7}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        contentContainerStyle={[
          generationHistory.length === 0 && styles.emptyGrid,
          {
            paddingTop: insets.top + DETAIL_HEADER_TOP_OFFSET,
            paddingBottom: insets.bottom + (selectedCount > 0 ? 80 : 18),
          },
        ]}
        ListHeaderComponent={
          <View style={styles.scrollHeader}>
            {isSelectionMode ? (
              <View style={styles.scrollHeaderSpacer} />
            ) : (
              <DetailScrollTitle title="History" scrollY={scrollY} />
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>아직 생성한 이미지가 없어요</Text>
            <Text style={styles.emptyText}>
              이미지를 생성하면 여기에 기록이 쌓입니다
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

      {bgMounted ? (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { opacity: bgUI }]}
        >
          <ScreenEdgeFade
            bottomHeight={insets.bottom + 140}
            color={tokens.color.app}
            transparentColor="rgba(10,10,11,0)"
          />
        </Animated.View>
      ) : null}

      {isSelectionMode ? (
        <HistorySelectionHeader
          topInset={insets.top}
          scrollY={scrollY}
          selectedCount={selectedCount}
          allSelected={allSelected}
          onToggleSelectAll={toggleSelectAll}
          onCancelSelection={exitSelectionMode}
        />
      ) : onBack ? (
        <DetailHeaderOverlay
          scrollY={scrollY}
          topInset={insets.top}
          onBack={onBack}
        />
      ) : null}

      {barMounted ? (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.selectionActionWrap,
            {
              bottom: insets.bottom + 16,
              opacity: barUI,
              transform: [{ translateY: barTranslateY }],
            },
          ]}
        >
          <View style={styles.selectionActionShadow}>
            <BlurView
              intensity={60}
              tint="dark"
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
                  <ActivityIndicator
                    color={tokens.color.textPrimary}
                    size="small"
                  />
                ) : (
                  <Ionicons
                    name="download-outline"
                    size={20}
                    color={tokens.color.textPrimary}
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
                  <ActivityIndicator
                    color={tokens.color.negative}
                    size="small"
                  />
                ) : (
                  <Ionicons
                    name="trash-outline"
                    size={20}
                    color={tokens.color.negative}
                  />
                )}
                <Text
                  style={[
                    styles.selectionActionText,
                    styles.selectionActionTextNegative,
                  ]}
                >
                  삭제
                </Text>
              </Pressable>
            </BlurView>
          </View>
        </Animated.View>
      ) : null}

      <ImagePreviewModal
        visible={isPreviewOpen}
        closeButtonVariant="header"
        images={previewImages}
        initialIndex={previewIndex}
        animation={previewAnimation}
        onClose={closePreview}
        onSaveCurrent={isSelectionMode ? undefined : handleSavePreview}
        onCopyCurrent={isSelectionMode ? undefined : handleCopyPreview}
        onDeleteCurrent={isSelectionMode ? undefined : handleDeletePreview}
        metadataRecords={isSelectionMode ? undefined : generationHistory}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: tokens.color.app,
  },
  list: {
    flex: 1,
  },
  emptyGrid: {
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.space[3],
    paddingHorizontal: tokens.space[16],
    paddingBottom: 48,
  },
  emptyTitle: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type.md,
  },
  emptyText: {
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.regular,
    fontSize: tokens.type.xs,
    lineHeight: 19,
    textAlign: "center",
  },
  tile: {
    overflow: "hidden",
    backgroundColor: tokens.color.card,
  },
  tileImage: {
    width: "100%",
    height: "100%",
  },
  selectedDim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(10,10,11,0.58)",
  },
  selectionCircle: {
    position: "absolute",
    top: 8,
    left: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: tokens.color.textPrimary,
    backgroundColor: "rgba(10,10,11,0.42)",
    alignItems: "center",
    justifyContent: "center",
  },
  selectionCircleSelected: {
    backgroundColor: tokens.color.accent,
    borderColor: tokens.color.onAccent,
  },
  expandButton: {
    position: "absolute",
    bottom: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.color.overlay,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.borderSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollHeader: {
    width: "100%",
    paddingHorizontal: tokens.space[8],
  },
  scrollHeaderSpacer: {
    height: 48,
  },
  selectionHeaderFade: {
    ...StyleSheet.absoluteFill,
    zIndex: 8,
    elevation: 8,
  },
  selectionHeader: {
    position: "absolute",
    left: tokens.space[8],
    right: tokens.space[8],
    zIndex: 10,
    elevation: 10,
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectionHeaderContent: {
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space[3],
    paddingHorizontal: tokens.space[6],
    borderRadius: tokens.radius.pill,
  },
  selectionHeaderButtonBackground: {
    ...StyleSheet.absoluteFill,
    borderRadius: tokens.radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.borderSubtle,
    backgroundColor: tokens.color.overlay,
    ...tokens.shadow.floatSm,
  },
  selectionHeaderCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: tokens.color.textSecondary,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  selectionHeaderCheckboxSelected: {
    backgroundColor: tokens.color.accent,
    borderColor: tokens.color.onAccent,
  },
  selectionHeaderCount: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type.xs,
  },
  selectionHeaderCancel: {
    height: 36,
    minWidth: 58,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: tokens.space[5],
    borderRadius: tokens.radius.pill,
  },
  selectionHeaderCancelText: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type.sm,
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
    borderRadius: tokens.radius.pill,
    ...tokens.shadow.floatMd,
  },
  selectionActionBar: {
    flexDirection: "row",
    borderRadius: tokens.radius.pill,
    padding: tokens.space[2],
    gap: tokens.space[2],
    overflow: "hidden",
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    backgroundColor: tokens.color.overlay,
  },
  selectionActionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space[3],
    paddingVertical: 10,
    paddingHorizontal: tokens.space[9],
    borderRadius: tokens.radius.pill,
  },
  selectionActionButtonDisabled: {
    opacity: 0.55,
  },
  selectionActionText: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type.xs,
  },
  selectionActionTextNegative: {
    color: tokens.color.negative,
  },
  pressed: {
    opacity: 0.68,
  },
});
