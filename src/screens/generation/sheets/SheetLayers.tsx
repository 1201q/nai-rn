import type { ReactNode } from "react";
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import Reanimated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";

const PREDICTIVE_BACK_SCALE_STOP = 0.6;
const PREDICTIVE_BACK_MIN_SCALE = 0.94;

export function PredictiveBackSheetLayer({
  progress,
  zIndex,
  children,
}: {
  progress: SharedValue<number>;
  zIndex: number;
  children: ReactNode;
}) {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(
          progress.value,
          [0, PREDICTIVE_BACK_SCALE_STOP],
          [1, PREDICTIVE_BACK_MIN_SCALE],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  return (
    <Reanimated.View
      pointerEvents="box-none"
      style={[
        styles.predictiveBackSheetLayer,
        { zIndex, elevation: zIndex },
        animatedStyle,
      ]}
    >
      {children}
    </Reanimated.View>
  );
}

export function FixedSheetBackdrop({
  animatedIndex,
  appearsOnIndex,
  disappearsOnIndex,
  visible,
  zIndex,
  accessibilityLabel,
  onPress,
}: {
  animatedIndex: SharedValue<number>;
  appearsOnIndex: number;
  disappearsOnIndex: number;
  visible: boolean;
  zIndex: number;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      animatedIndex.value,
      [disappearsOnIndex, appearsOnIndex],
      [0, 0.62],
      Extrapolation.CLAMP,
    ),
  }));

  return (
    <Reanimated.View
      pointerEvents={visible ? "auto" : "none"}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? "auto" : "no-hide-descendants"}
      style={[
        styles.fixedSheetBackdrop,
        { zIndex, elevation: zIndex },
        animatedStyle,
      ]}
    >
      <Pressable
        accessible={visible}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={styles.fixedSheetBackdropPressable}
      />
    </Reanimated.View>
  );
}

export function PressableSurface({
  accessibilityLabel,
  disabled = false,
  onPress,
  style,
  children,
}: {
  accessibilityLabel: string;
  disabled?: boolean;
  onPress: () => void;
  style: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        style,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fixedSheetBackdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "#0A0A0C",
  },
  fixedSheetBackdropPressable: {
    flex: 1,
  },
  predictiveBackSheetLayer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    transformOrigin: "center bottom",
  },
  pressed: {
    opacity: 0.65,
  },
  disabled: {
    opacity: 0.35,
  },
});
