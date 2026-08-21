import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
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
import Reanimated, {
  cancelAnimation,
  Easing as ReanimatedEasing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Gallery } from "react-native-zoom-toolkit";

import { useAppSheet } from "../../context/AppSheetContext";
import { DETAIL_HEADER_TOP_OFFSET } from "../common/DetailScrollHeader";
import { tokens } from "../../styles/tokens";
import { styles } from "./styles";

const GALLERY_SNAP_TIMING_CONFIG = {
  duration: 150,
  easing: ReanimatedEasing.out(ReanimatedEasing.cubic),
};

const HERO_DURATION = 200;
const HERO_EASING = ReanimatedEasing.bezier(0.32, 0.72, 0, 1);

export type ImagePreviewRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ImagePreviewModalHandle = {
  close: () => void;
};

export type ImagePreviewHeroTransition = {
  initialRect: ImagePreviewRect;
  resolveTargetRect: (index: number) => Promise<ImagePreviewRect | null>;
  getAspectRatio?: (index: number) => number | undefined;
  getTransitionUri?: (index: number) => string | undefined;
};

function containRect(
  viewportWidth: number,
  viewportHeight: number,
  aspectRatio: number,
): ImagePreviewRect {
  if (aspectRatio <= 0) {
    return { x: 0, y: 0, width: viewportWidth, height: viewportHeight };
  }

  let imageWidth = viewportWidth;
  let imageHeight = imageWidth / aspectRatio;
  if (imageHeight > viewportHeight) {
    imageHeight = viewportHeight;
    imageWidth = imageHeight * aspectRatio;
  }

  return {
    x: (viewportWidth - imageWidth) / 2,
    y: (viewportHeight - imageHeight) / 2,
    width: imageWidth,
    height: imageHeight,
  };
}

export const ImagePreviewModal = forwardRef<ImagePreviewModalHandle, {
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
  heroTransition?: ImagePreviewHeroTransition;
}>(function ImagePreviewModal({
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
  heroTransition,
}, ref) {
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
  const [isHeroImageReady, setIsHeroImageReady] = useState(false);
  const [closingIndex, setClosingIndex] = useState<number | null>(null);
  const [closingTarget, setClosingTarget] = useState<ImagePreviewRect | null>(
    null,
  );
  const busy = isSaving || isCopying || isDeleting;
  const usesHeaderCloseButton = closeButtonVariant === "header";
  const closingRef = useRef(false);
  const isHeroTransition = heroTransition != null;

  const initialRecord = metadataRecords?.[initialIndex];
  const initialAspectRatio =
    heroTransition?.getAspectRatio?.(initialIndex) ??
    (initialRecord ? initialRecord.width / initialRecord.height : width / height);
  const initialDestination = containRect(width, height, initialAspectRatio);

  const heroProgress = useSharedValue(0);
  const heroPhase = useSharedValue(0); // 0 opening, 1 open, 2 closing
  const heroHasCloseTarget = useSharedValue(0);
  const heroStartX = useSharedValue(heroTransition?.initialRect.x ?? 0);
  const heroStartY = useSharedValue(heroTransition?.initialRect.y ?? 0);
  const heroStartWidth = useSharedValue(
    heroTransition?.initialRect.width ?? width,
  );
  const heroStartHeight = useSharedValue(
    heroTransition?.initialRect.height ?? height,
  );
  const heroEndX = useSharedValue(initialDestination.x);
  const heroEndY = useSharedValue(initialDestination.y);
  const heroEndWidth = useSharedValue(initialDestination.width);
  const heroEndHeight = useSharedValue(initialDestination.height);
  const heroBaseX = useSharedValue(initialDestination.x);
  const heroBaseY = useSharedValue(initialDestination.y);
  const heroBaseWidth = useSharedValue(initialDestination.width);
  const heroBaseHeight = useSharedValue(initialDestination.height);

  useEffect(() => {
    if (visible) {
      controlsVisibleRef.current = !isHeroTransition;
      setControlsVisible(!isHeroTransition);
      controlsAnim.setValue(isHeroTransition ? 0 : 1);
      currentIndexRef.current = initialIndex;
      closingRef.current = false;
      setClosingIndex(null);
      setClosingTarget(null);
    }
  }, [visible, initialIndex, controlsAnim, isHeroTransition]);

  const showControls = useCallback(() => {
    controlsVisibleRef.current = true;
    setControlsVisible(true);
    Animated.timing(controlsAnim, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [controlsAnim]);

  useEffect(() => {
    if (!visible || !heroTransition || !isHeroImageReady) return;

    const source = heroTransition.initialRect;
    heroStartX.value = source.x;
    heroStartY.value = source.y;
    heroStartWidth.value = source.width;
    heroStartHeight.value = source.height;
    heroEndX.value = initialDestination.x;
    heroEndY.value = initialDestination.y;
    heroEndWidth.value = initialDestination.width;
    heroEndHeight.value = initialDestination.height;
    heroBaseX.value = initialDestination.x;
    heroBaseY.value = initialDestination.y;
    heroBaseWidth.value = initialDestination.width;
    heroBaseHeight.value = initialDestination.height;
    heroPhase.value = 0;
    heroProgress.value = 0;

    let completionTimer: ReturnType<typeof setTimeout> | undefined;
    const frame = requestAnimationFrame(() => {
      heroProgress.value = withTiming(1, {
        duration: HERO_DURATION,
        easing: HERO_EASING,
      });
      completionTimer = setTimeout(() => {
        heroPhase.value = 1;
        showControls();
      }, HERO_DURATION);
    });

    return () => {
      cancelAnimationFrame(frame);
      if (completionTimer) clearTimeout(completionTimer);
      cancelAnimation(heroProgress);
    };
  }, [
    visible,
    heroTransition,
    isHeroImageReady,
    initialDestination.x,
    initialDestination.y,
    initialDestination.width,
    initialDestination.height,
    heroStartX,
    heroStartY,
    heroStartWidth,
    heroStartHeight,
    heroEndX,
    heroEndY,
    heroEndWidth,
    heroEndHeight,
    heroBaseX,
    heroBaseY,
    heroBaseWidth,
    heroBaseHeight,
    heroPhase,
    heroProgress,
    showControls,
  ]);

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

  // ref 만 갱신 — 리렌더 없음. Gallery(windowSize=3)가 ±1 이웃을 마운트/디코딩함.
  const handleIndexChange = useCallback((index: number) => {
    currentIndexRef.current = index;
  }, []);

  const requestClose = useCallback(async () => {
    if (closingRef.current) return;
    if (!heroTransition) {
      onClose();
      return;
    }

    closingRef.current = true;
    controlsVisibleRef.current = false;
    setControlsVisible(false);
    Animated.timing(controlsAnim, {
      toValue: 0,
      duration: 120,
      useNativeDriver: true,
    }).start();

    const index = currentIndexRef.current;
    const target = await heroTransition.resolveTargetRect(index);
    setClosingTarget(target);
    setClosingIndex(index);
  }, [controlsAnim, heroTransition, onClose]);

  useImperativeHandle(ref, () => ({ close: requestClose }), [requestClose]);

  useEffect(() => {
    if (closingIndex == null || !heroTransition) return;

    const record = metadataRecords?.[closingIndex];
    const aspectRatio =
      heroTransition.getAspectRatio?.(closingIndex) ??
      (record ? record.width / record.height : width / height);
    const destination = containRect(width, height, aspectRatio);
    const target = closingTarget ?? destination;

    heroStartX.value = destination.x;
    heroStartY.value = destination.y;
    heroStartWidth.value = destination.width;
    heroStartHeight.value = destination.height;
    heroEndX.value = target.x;
    heroEndY.value = target.y;
    heroEndWidth.value = target.width;
    heroEndHeight.value = target.height;
    heroBaseX.value = destination.x;
    heroBaseY.value = destination.y;
    heroBaseWidth.value = destination.width;
    heroBaseHeight.value = destination.height;
    heroHasCloseTarget.value = closingTarget ? 1 : 0;
    heroPhase.value = 2;
    heroProgress.value = 0;

    const duration = closingTarget ? HERO_DURATION : 180;
    let completionTimer: ReturnType<typeof setTimeout> | undefined;
    const frame = requestAnimationFrame(() => {
      heroProgress.value = withTiming(1, {
        duration,
        easing: HERO_EASING,
      });
      completionTimer = setTimeout(onClose, duration);
    });

    return () => {
      cancelAnimationFrame(frame);
      if (completionTimer) clearTimeout(completionTimer);
      cancelAnimation(heroProgress);
    };
  }, [
    closingIndex,
    closingTarget,
    heroTransition,
    metadataRecords,
    width,
    height,
    heroStartX,
    heroStartY,
    heroStartWidth,
    heroStartHeight,
    heroEndX,
    heroEndY,
    heroEndWidth,
    heroEndHeight,
    heroBaseX,
    heroBaseY,
    heroBaseWidth,
    heroBaseHeight,
    heroHasCloseTarget,
    heroPhase,
    heroProgress,
    onClose,
  ]);

  const heroBackdropStyle = useAnimatedStyle(() => {
    const opacity =
      heroPhase.value === 0
        ? heroProgress.value
        : heroPhase.value === 2
          ? 1 - heroProgress.value
          : 1;
    return { opacity };
  });

  const heroGalleryStyle = useAnimatedStyle(() => {
    return { opacity: heroPhase.value === 1 ? 1 : 0 };
  });

  const heroImageLayoutStyle = useAnimatedStyle(() => {
    return {
      left: Math.round(heroBaseX.value),
      top: Math.round(heroBaseY.value),
      width: Math.max(1, Math.round(heroBaseWidth.value)),
      height: Math.max(1, Math.round(heroBaseHeight.value)),
    };
  });

  const heroImageTransformStyle = useAnimatedStyle(() => {
    const progress = heroProgress.value;
    const currentX = Math.round(
      interpolate(progress, [0, 1], [heroStartX.value, heroEndX.value]),
    );
    const currentY = Math.round(
      interpolate(progress, [0, 1], [heroStartY.value, heroEndY.value]),
    );
    const currentWidth = Math.max(
      1,
      Math.round(
        interpolate(
          progress,
          [0, 1],
          [heroStartWidth.value, heroEndWidth.value],
        ),
      ),
    );
    const currentHeight = Math.max(
      1,
      Math.round(
        interpolate(
          progress,
          [0, 1],
          [heroStartHeight.value, heroEndHeight.value],
        ),
      ),
    );
    const baseX = Math.round(heroBaseX.value);
    const baseY = Math.round(heroBaseY.value);
    const baseWidth = Math.max(1, Math.round(heroBaseWidth.value));
    const baseHeight = Math.max(1, Math.round(heroBaseHeight.value));
    const closingOpacity = heroHasCloseTarget.value
      ? 1
      : 1 - progress;

    return {
      transform: [
        {
          translateX:
            currentX + currentWidth / 2 - (baseX + baseWidth / 2),
        },
        {
          translateY:
            currentY + currentHeight / 2 - (baseY + baseHeight / 2),
        },
        { scaleX: currentWidth / baseWidth },
        { scaleY: currentHeight / baseHeight },
      ],
      opacity:
        heroPhase.value === 0
          ? 1
          : heroPhase.value === 2
            ? closingOpacity
            : 0,
    };
  });

  const heroImageContentStyle = useAnimatedStyle(() => {
    const progress = heroProgress.value;
    const currentWidth = Math.max(
      1,
      Math.round(
        interpolate(
          progress,
          [0, 1],
          [heroStartWidth.value, heroEndWidth.value],
        ),
      ),
    );
    const currentHeight = Math.max(
      1,
      Math.round(
        interpolate(
          progress,
          [0, 1],
          [heroStartHeight.value, heroEndHeight.value],
        ),
      ),
    );
    const baseWidth = Math.max(1, Math.round(heroBaseWidth.value));
    const baseHeight = Math.max(1, Math.round(heroBaseHeight.value));
    const frameScaleX = currentWidth / baseWidth;
    const frameScaleY = currentHeight / baseHeight;
    const coverScale = Math.max(frameScaleX, frameScaleY);

    return {
      transform: [
        { scaleX: coverScale / frameScaleX },
        { scaleY: coverScale / frameScaleY },
      ],
    };
  });

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
        windowSize={3}
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

  const heroImageIndex = closingIndex ?? initialIndex;
  const heroImageUri =
    heroTransition?.getTransitionUri?.(heroImageIndex) ??
    images[heroImageIndex] ??
    images[initialIndex];

  if (!visible) return null;

  return (
    // RN Modal 대신 전역 Portal 오버레이 — pager 위로 탈출하되 같은 트리(hero/시트
    // 호스트와 좌표계 공유). 전역 호스트(metadataView 시트)가 이 위에 뜬다.
    <Portal>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          !isHeroTransition && styles.previewBackdrop,
          !isHeroTransition && {
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
        {isHeroTransition ? (
          <Reanimated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              styles.previewBackdrop,
              heroBackdropStyle,
            ]}
          />
        ) : null}
        <Reanimated.View
          style={[
            StyleSheet.absoluteFill,
            isHeroTransition && heroGalleryStyle,
          ]}
        >
          {gallery}
        </Reanimated.View>
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
            onPress={requestClose}
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
        {isHeroTransition && heroImageUri ? (
          <Reanimated.View
            pointerEvents="none"
            style={[
              styles.heroImageFrame,
              heroImageLayoutStyle,
              heroImageTransformStyle,
            ]}
          >
            <Reanimated.View
              renderToHardwareTextureAndroid={!controlsVisible}
              shouldRasterizeIOS={!controlsVisible}
              style={[StyleSheet.absoluteFill, heroImageContentStyle]}
            >
              <ExpoImage
                source={{ uri: heroImageUri }}
                contentFit="fill"
                cachePolicy="memory-disk"
                recyclingKey={heroImageUri}
                transition={0}
                onLoad={() => setIsHeroImageReady(true)}
                style={StyleSheet.absoluteFill}
              />
            </Reanimated.View>
          </Reanimated.View>
        ) : null}
      </Animated.View>
    </Portal>
  );
});
