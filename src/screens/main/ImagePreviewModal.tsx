import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { Gallery } from "react-native-zoom-toolkit";

import { light } from "../home/styles";
import { styles } from "./styles";

export function ImagePreviewModal({
  visible,
  images,
  initialIndex,
  animation,
  onClose,
  onSaveCurrent,
  onCopyCurrent,
  onDeleteCurrent,
}: {
  visible: boolean;
  images: string[];
  initialIndex: number;
  animation: Animated.Value;
  onClose: () => void;
  onSaveCurrent?: (index: number) => void | Promise<void>;
  onCopyCurrent?: (index: number) => void | Promise<void>;
  onDeleteCurrent?: (index: number) => void | Promise<void>;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [controlsVisible, setControlsVisible] = useState(true);
  const controlsAnim = useRef(new Animated.Value(1)).current;
  const controlsVisibleRef = useRef(true);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isSaving, setIsSaving] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const busy = isSaving || isCopying || isDeleting;

  useEffect(() => {
    if (visible) {
      controlsVisibleRef.current = true;
      setControlsVisible(true);
      controlsAnim.setValue(1);
      setCurrentIndex(initialIndex);
    }
  }, [visible, initialIndex, controlsAnim]);

  const handleSave = async () => {
    if (busy || !onSaveCurrent) return;
    try {
      setIsSaving(true);
      await onSaveCurrent(currentIndex);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = async () => {
    if (busy || !onCopyCurrent) return;
    try {
      setIsCopying(true);
      await onCopyCurrent(currentIndex);
    } finally {
      setIsCopying(false);
    }
  };

  const handleDelete = async () => {
    if (busy || !onDeleteCurrent) return;
    try {
      setIsDeleting(true);
      await onDeleteCurrent(currentIndex);
    } finally {
      setIsDeleting(false);
    }
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

  const handleIndexChange = useCallback((index: number) => {
    setCurrentIndex(index);
  }, []);

  const renderItem = useCallback(
    (item: string) => (
      <View style={{ width, height }}>
        <Image
          source={{ uri: item }}
          resizeMode="contain"
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
        tapOnEdgeToItem={false}
        onTap={toggleControls}
        onIndexChange={handleIndexChange}
        renderItem={renderItem}
      />
    ),
    [images, initialIndex, toggleControls, handleIndexChange, renderItem],
  );

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="fade"
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.previewGestureRoot}>
        <Animated.View
          style={[
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
          {visible ? gallery : null}
          <Animated.View
            style={[
              styles.previewCloseButton,
              { top: insets.top + 5, opacity: controlsAnim },
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
              <Ionicons name="close" size={22} color={light.textPrimary} />
            </TouchableOpacity>
          </Animated.View>

          {onSaveCurrent || onCopyCurrent || onDeleteCurrent ? (
            <Animated.View
              pointerEvents={controlsVisible ? "box-none" : "none"}
              style={[
                styles.previewActionWrap,
                {
                  bottom: insets.bottom + 16,
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
                <BlurView
                  intensity={60}
                  tint="dark"
                  style={styles.previewActionBar}
                >
                  {onSaveCurrent ? (
                    <Pressable
                      style={[
                        styles.previewActionButton,
                        busy && styles.previewActionButtonDisabled,
                      ]}
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={handleSave}
                    >
                      {isSaving ? (
                        <ActivityIndicator
                          color={light.textPrimary}
                          size="small"
                        />
                      ) : (
                        <Ionicons
                          name="arrow-down-outline"
                          size={20}
                          color={light.textPrimary}
                        />
                      )}
                    </Pressable>
                  ) : null}
                  {onCopyCurrent ? (
                    <Pressable
                      style={[
                        styles.previewActionButton,
                        busy && styles.previewActionButtonDisabled,
                      ]}
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={handleCopy}
                    >
                      {isCopying ? (
                        <ActivityIndicator
                          color={light.textPrimary}
                          size="small"
                        />
                      ) : (
                        <Ionicons
                          name="copy-outline"
                          size={20}
                          color={light.textPrimary}
                        />
                      )}
                    </Pressable>
                  ) : null}
                  {onDeleteCurrent ? (
                    <Pressable
                      style={[
                        styles.previewActionButton,
                        busy && styles.previewActionButtonDisabled,
                      ]}
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={handleDelete}
                    >
                      {isDeleting ? (
                        <ActivityIndicator
                          color={light.textPrimary}
                          size="small"
                        />
                      ) : (
                        <Ionicons
                          name="trash-outline"
                          size={20}
                          color={light.textPrimary}
                        />
                      )}
                    </Pressable>
                  ) : null}
                </BlurView>
              </View>
            </Animated.View>
          ) : null}
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}
