import { Animated, Modal, TouchableOpacity } from "react-native";

import { styles } from "./styles";

export function ImagePreviewModal({
  visible,
  imageUri,
  animation,
  onClose,
}: {
  visible: boolean;
  imageUri: string | null;
  animation: Animated.Value;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.previewBackdrop, { opacity: animation }]}>
        <TouchableOpacity
          activeOpacity={1}
          style={styles.previewPressArea}
          onPress={onClose}
        >
          {imageUri ? (
            <Animated.Image
              source={{ uri: imageUri }}
              resizeMode="contain"
              style={[
                styles.previewImage,
                {
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
            />
          ) : null}
          <Animated.Text style={[styles.previewHint, { opacity: animation }]}>
            Tap to close
          </Animated.Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}
