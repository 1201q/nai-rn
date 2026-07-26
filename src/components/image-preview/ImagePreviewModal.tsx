import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GenerationRecord } from "../../lib/generationHistory";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Portal } from "@gorhom/portal";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image as ExpoImage } from "expo-image";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { Easing as ReanimatedEasing } from "react-native-reanimated";
import { Gallery } from "react-native-zoom-toolkit";

import { useAppSheet } from "../../context/AppSheetContext";
import { DETAIL_HEADER_TOP_OFFSET } from "../common/DetailScrollHeader";
import { tokens } from "../../styles/tokens";
import { styles } from "./styles";

const GALLERY_SNAP_TIMING_CONFIG = {
  duration: 150,
  easing: ReanimatedEasing.out(ReanimatedEasing.cubic),
};

export function ImagePreviewModal({
  visible,
  images,
  initialIndex,
  animation,
  onClose,
  onSaveCurrent,
  onCopyCurrent,
  onDeleteCurrent,
  metadataRecords,
  closeButtonVariant = "default",
}: {
  visible: boolean;
  images: string[];
  initialIndex: number;
  animation: Animated.Value;
  onClose: () => void;
  onSaveCurrent?: (index: number) => void | Promise<void>;
  onCopyCurrent?: (index: number) => void | Promise<void>;
  onDeleteCurrent?: (index: number) => void | Promise<void>;
  metadataRecords?: GenerationRecord[];
  closeButtonVariant?: "default" | "header";
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const { open: openSheet } = useAppSheet();
  const [controlsVisible, setControlsVisible] = useState(true);
  const controlsAnim = useRef(new Animated.Value(1)).current;
  const controlsVisibleRef = useRef(true);
  // 인덱스는 스와이프마다 바뀌지만 JSX가 읽지 않음(액션 호출 시점에만 참조).
  // state 로 두면 매 스와이프 모달 전체 리렌더 → 프레임 드랍. ref 로 고정.
  const currentIndexRef = useRef(initialIndex);
  const [isSaving, setIsSaving] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const busy = isSaving || isCopying || isDeleting;
  const usesHeaderCloseButton = closeButtonVariant === "header";

  useEffect(() => {
    if (visible) {
      controlsVisibleRef.current = true;
      setControlsVisible(true);
      controlsAnim.setValue(1);
      currentIndexRef.current = initialIndex;
    }
  }, [visible, initialIndex, controlsAnim]);

  const handleSave = async () => {
    if (busy || !onSaveCurrent) return;
    try {
      setIsSaving(true);
      await onSaveCurrent(currentIndexRef.current);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = async () => {
    if (busy || !onCopyCurrent) return;
    try {
      setIsCopying(true);
      await onCopyCurrent(currentIndexRef.current);
    } finally {
      setIsCopying(false);
    }
  };

  const handleDelete = async () => {
    if (busy || !onDeleteCurrent) return;
    try {
      setIsDeleting(true);
      await onDeleteCurrent(currentIndexRef.current);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleMetadata = () => {
    const record = metadataRecords?.[currentIndexRef.current];
    if (!record) return;
    // 전역 호스트의 metadataView 라우트로 — preview 위에 시트가 뜬다(뒤로 시 preview 복귀).
    openSheet("metadataView", record);
  };

  // 안정 ref: Gallery 의 React.memo(onTap 비교) 때문에 매 렌더 새 함수면
  // 제스처 트리가 재생성되며 줌이 풀림. useCallback 으로 고정.
  const toggleControls = useCallback(() => {
    const next = !controlsVisibleRef.current;
    controlsVisibleRef.current = next;
    setControlsVisible(next);
    Animated.timing(controlsAnim, {
      toValue: next ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [controlsAnim]);

  // ref 만 갱신 — 리렌더 없음. Gallery(windowSize=5)가 이미 ±2 이웃을 마운트/디코딩함.
  const handleIndexChange = useCallback((index: number) => {
    currentIndexRef.current = index;
  }, []);

  const renderItem = useCallback(
    (item: string) => (
      <View style={{ width, height }}>
        <ExpoImage
          source={{ uri: item }}
          contentFit="contain"
          cachePolicy="memory-disk"
          recyclingKey={item}
          style={{ width, height }}
        />
      </View>
    ),
    [width, height],
  );

  const gallery = useMemo(
    () => (
      <Gallery
        data={images}
        initialIndex={initialIndex}
        keyExtractor={(item, index) => `${item}-${index}`}
        maxScale={4}
        snapTimingConfig={GALLERY_SNAP_TIMING_CONFIG}
        tapOnEdgeToItem={false}
        onTap={toggleControls}
        onIndexChange={handleIndexChange}
        renderItem={renderItem}
      />
    ),
    [images, initialIndex, toggleControls, handleIndexChange, renderItem],
  );

  if (!visible) return null;

  return (
    // RN Modal 대신 전역 Portal 오버레이 — pager 위로 탈출하되 같은 트리(hero/시트
    // 호스트와 좌표계 공유). 전역 호스트(metadataView 시트)가 이 위에 뜬다.
    <Portal>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.previewBackdrop,
          {
            opacity: animation,
            transform: [
              {
                scale: animation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.94, 1],
                }),
              },
            ],
          },
        ]}
      >
        {gallery}
        <Animated.View
          style={[
            styles.previewCloseButton,
            usesHeaderCloseButton && styles.previewCloseButtonHeader,
            {
              top:
                insets.top +
                (usesHeaderCloseButton ? DETAIL_HEADER_TOP_OFFSET : 12),
              opacity: controlsAnim,
            },
          ]}
          pointerEvents={controlsVisible ? "auto" : "none"}
        >
          <View style={styles.previewCloseBg}>
            <BlurView
              intensity={50}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
          </View>
          <TouchableOpacity
            style={styles.previewCloseTouch}
            activeOpacity={0.78}
            accessibilityRole="button"
            accessibilityLabel="닫기"
            onPress={onClose}
          >
            <Ionicons
              name="close"
              size={usesHeaderCloseButton ? 18 : 20}
              color={tokens.color.textPrimary}
            />
          </TouchableOpacity>
        </Animated.View>

        {onSaveCurrent ||
        onCopyCurrent ||
        onDeleteCurrent ||
        metadataRecords ? (
          <Animated.View
            pointerEvents={controlsVisible ? "box-none" : "none"}
            style={[
              styles.previewActionWrap,
              {
                bottom: insets.bottom + tokens.space[6],
                opacity: controlsAnim,
                transform: [
                  {
                    translateY: controlsAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [8, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.previewActionShadow}>
              <View style={styles.previewActionBar}>
                {onSaveCurrent ? (
                  <Pressable
                    style={[
                      styles.previewActionButton,
                      busy && styles.previewActionButtonDisabled,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="이미지 저장"
                    disabled={busy}
                    onPress={handleSave}
                  >
                    {isSaving ? (
                      <ActivityIndicator
                        color={tokens.color.textSecondary}
                        size="small"
                      />
                    ) : (
                      <Ionicons
                        name="download-outline"
                        size={18}
                        color={tokens.color.textSecondary}
                      />
                    )}
                    <Text style={styles.previewActionText}>저장</Text>
                  </Pressable>
                ) : null}
                {onCopyCurrent ? (
                  <Pressable
                    style={[
                      styles.previewActionButton,
                      busy && styles.previewActionButtonDisabled,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="이미지 복사"
                    disabled={busy}
                    onPress={handleCopy}
                  >
                    {isCopying ? (
                      <ActivityIndicator
                        color={tokens.color.textSecondary}
                        size="small"
                      />
                    ) : (
                      <Ionicons
                        name="copy-outline"
                        size={18}
                        color={tokens.color.textSecondary}
                      />
                    )}
                    <Text style={styles.previewActionText}>복사</Text>
                  </Pressable>
                ) : null}
                {onDeleteCurrent ? (
                  <Pressable
                    style={[
                      styles.previewActionButton,
                      busy && styles.previewActionButtonDisabled,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="이미지 삭제"
                    disabled={busy}
                    onPress={handleDelete}
                  >
                    {isDeleting ? (
                      <ActivityIndicator
                        color={tokens.color.textSecondary}
                        size="small"
                      />
                    ) : (
                      <Ionicons
                        name="trash-outline"
                        size={18}
                        color={tokens.color.textSecondary}
                      />
                    )}
                    <Text style={[styles.previewActionText]}>삭제</Text>
                  </Pressable>
                ) : null}
                {metadataRecords ? (
                  <Pressable
                    style={[
                      styles.previewActionButton,
                      busy && styles.previewActionButtonDisabled,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="메타데이터 보기"
                    disabled={busy}
                    onPress={handleMetadata}
                  >
                    <Ionicons
                      name="information-circle-outline"
                      size={18}
                      color={tokens.color.textSecondary}
                    />
                    <Text style={styles.previewActionText}>정보</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </Animated.View>
        ) : null}
      </Animated.View>
    </Portal>
  );
}
