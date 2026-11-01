import { Animated, StyleSheet } from "react-native";
import { useIsFocused } from "expo-router";
import {
  KeyboardAwareScrollView,
  type KeyboardAwareScrollViewProps,
} from "react-native-keyboard-controller";

// Preserve native Animated header scroll events while the keyboard controller
// tracks focused inputs and extends the page's scrollable area.
const AnimatedKeyboardAwareScrollView = Animated.createAnimatedComponent(
  KeyboardAwareScrollView,
);

export function SettingsPageScrollView({
  style,
  ...props
}: KeyboardAwareScrollViewProps) {
  const focused = useIsFocused();
  return (
    <AnimatedKeyboardAwareScrollView
      {...props}
      style={[styles.scroll, style]}
      enabled={focused}
      mode="insets"
      bottomOffset={24}
      automaticallyAdjustKeyboardInsets={false}
    />
  );
}

const styles = StyleSheet.create({ scroll: { flex: 1 } });
