import {
  Animated,
  FlatList,
  Image,
  Modal,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

import { styles } from "./styles";

export function ImagePreviewModal({
  visible,
  images,
  initialIndex,
  animation,
  onClose,
}: {
  visible: boolean;
  images: string[];
  initialIndex: number;
  animation: Animated.Value;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="fade"
      onRequestClose={onClose}
    >
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
        <FlatList
          data={images}
          keyExtractor={(_, i) => String(i)}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, index) => ({
            length: width,
            offset: width * index,
            index,
          })}
          renderItem={({ item }) => (
            <View style={{ width, height }}>
              <Image
                source={{ uri: item }}
                resizeMode="contain"
                style={{ width, height }}
              />
            </View>
          )}
        />
        <TouchableOpacity style={styles.previewCloseButton} onPress={onClose}>
          <Text style={styles.previewCloseText}>✕</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}
