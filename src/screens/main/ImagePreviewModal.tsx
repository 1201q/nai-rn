import {
  Animated,
  Image,
  Modal,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Gallery } from "react-native-zoom-toolkit";

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
          {visible ? (
            <Gallery
              data={images}
              initialIndex={initialIndex}
              keyExtractor={(item, index) => `${item}-${index}`}
              maxScale={4}
              renderItem={(item) => (
                <View style={{ width, height }}>
                  <Image
                    source={{ uri: item }}
                    resizeMode="contain"
                    style={{ width, height }}
                  />
                </View>
              )}
            />
          ) : null}
          <TouchableOpacity style={styles.previewCloseButton} onPress={onClose}>
            <Text style={styles.previewCloseText}>✕</Text>
          </TouchableOpacity>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}
