import {
  FlatList,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Image as ExpoImage } from "expo-image";

import type { GenerationRecord } from "../../lib/generationHistory";
import { styles } from "./styles";

export function HistoryPage({
  images,
  resolveImageUri,
  resolveThumbnailUri,
}: {
  images: GenerationRecord[];
  resolveImageUri: (record: GenerationRecord) => string;
  resolveThumbnailUri: (record: GenerationRecord) => string | null;
}) {
  const { width } = useWindowDimensions();
  const padding = 2;
  const gap = 2;
  const itemSize = (width - padding * 2 - gap * 2) / 3;

  return (
    <FlatList
      data={images}
      keyExtractor={(item) => item.id}
      numColumns={3}
      showsVerticalScrollIndicator={false}
      style={styles.historyList}
      contentContainerStyle={[
        styles.historyGrid,
        images.length === 0 && styles.historyEmptyGrid,
      ]}
      ListEmptyComponent={
        <View style={styles.historyEmptyState}>
          <Text style={styles.historyEmptyTitle}>No history yet</Text>
          <Text style={styles.historyEmptyText}>
            Generated images will appear here.
          </Text>
        </View>
      }
      renderItem={({ item, index }) => (
        <TouchableOpacity
          activeOpacity={0.86}
          style={[
            styles.historyTile,
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
              uri: resolveThumbnailUri(item) ?? resolveImageUri(item),
            }}
            contentFit="cover"
            recyclingKey={item.id}
            transition={120}
            style={styles.historyImage}
          />
        </TouchableOpacity>
      )}
    />
  );
}
