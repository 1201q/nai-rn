import { memo, useCallback, type ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Reanimated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const PRESS_IN_TIMING = {
  duration: 90,
  easing: Easing.out(Easing.cubic),
};
const PRESS_OUT_TIMING = {
  duration: 140,
  easing: Easing.out(Easing.cubic),
};
const DEFAULT_PRESSED_SCALE = 0.99;
export const TAP_FEEDBACK_OVERLAY_COLOR = "rgba(255,255,255,0.08)";

type TapFeedbackPressableProps = Omit<PressableProps, "children" | "style"> & {
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  decoration?: ReactNode;
  overlayPlacement?: "background" | "foreground";
  pressedBackgroundColor?: string;
  pressedScale?: number;
  style?: StyleProp<ViewStyle>;
};

export function useTapFeedback(pressedScale = DEFAULT_PRESSED_SCALE) {
  const progress = useSharedValue(0);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));
  const contentAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - progress.value * (1 - pressedScale) }],
  }));

  const startFeedback = useCallback(() => {
    progress.value = withTiming(1, PRESS_IN_TIMING);
  }, [progress]);
  const endFeedback = useCallback(() => {
    progress.value = withTiming(0, PRESS_OUT_TIMING);
  }, [progress]);

  return {
    contentAnimatedStyle,
    endFeedback,
    overlayStyle,
    startFeedback,
  };
}

export const TapFeedbackPressable = memo(function TapFeedbackPressable({
  children,
  contentStyle,
  decoration,
  disabled = false,
  onPressIn,
  onPressOut,
  overlayPlacement = "background",
  pressedBackgroundColor = TAP_FEEDBACK_OVERLAY_COLOR,
  pressedScale = DEFAULT_PRESSED_SCALE,
  style,
  ...pressableProps
}: TapFeedbackPressableProps) {
  const {
    contentAnimatedStyle,
    endFeedback,
    overlayStyle,
    startFeedback,
  } = useTapFeedback(pressedScale);

  const handlePressIn = useCallback(
    (event: GestureResponderEvent) => {
      startFeedback();
      onPressIn?.(event);
    },
    [onPressIn, startFeedback],
  );
  const handlePressOut = useCallback(
    (event: GestureResponderEvent) => {
      endFeedback();
      onPressOut?.(event);
    },
    [endFeedback, onPressOut],
  );
  const overlay = (
    <Reanimated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: pressedBackgroundColor },
        overlayStyle,
      ]}
    />
  );

  return (
    <Pressable
      {...pressableProps}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={style}
    >
      {overlayPlacement === "background" ? overlay : null}
      <Reanimated.View
        pointerEvents="box-none"
        style={[styles.content, contentStyle, contentAnimatedStyle]}
      >
        {children}
      </Reanimated.View>
      {decoration}
      {overlayPlacement === "foreground" ? overlay : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
});
