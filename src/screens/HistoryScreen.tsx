import { useRef, useState } from "react";
import {
  Animated,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Image as ExpoImage } from "expo-image";

import { useGenerationStore } from "../store/generationStore";
import {
  resolveGenerationImageUri,
  resolveGenerationThumbnailUri,
} from "../lib/generationHistory";
import { ImagePreviewModal } from "./main/ImagePreviewModal";
import { FloatingPillHeader } from "../components/FloatingPillHeader";
import { light } from "./home/styles";

export function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const generationHistory = useGenerationStore((s) => s.generationHistory);

  const { width } = useWindowDimensions();
  const gap = 2;
  const itemSize = (width - gap * 2) / 3;

  const previewAnimation = useRef(new Animated.Value(0)).current;
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);

  const scrollY = useRef(new Animated.Value(0)).current;

  function openPreview(index: number) {
    setPreviewIndex(index);
    setIsPreviewOpen(true);
    previewAnimation.setValue(0);
    Animated.timing(previewAnimation, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }

  function closePreview() {
    Animated.timing(previewAnimation, {
      toValue: 0,
      duration: 140,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setIsPreviewOpen(false);
    });
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      <Animated.FlatList
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
          { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 18 },
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
          <TouchableOpacity
            activeOpacity={0.86}
            onPress={() => openPreview(index)}
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
          </TouchableOpacity>
        )}
      />

      <FloatingPillHeader title="History" scrollY={scrollY} topInset={insets.top} />

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
});
