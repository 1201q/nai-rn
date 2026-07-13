import { useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { DetailPillHeader } from "../../components/DetailPillHeader";
import { ScreenEdgeFade } from "../../components/ScreenEdgeFade";
import {
  renderOptionRoute,
  type OptionRoute,
} from "../home/OptionsSheet";
import { tokens } from "../../styles/tokens";

export function ImageSettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scrollY = useRef(new Animated.Value(0)).current;

  const openDetail = (route: OptionRoute) => {
    router.push({ pathname: "/option-detail", params: { route } });
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ScreenEdgeFade topHeight={insets.top + 64} />
      <DetailPillHeader
        title="Image Settings"
        scrollY={scrollY}
        topInset={insets.top}
        onBack={() => router.back()}
      />
      <KeyboardAwareScrollView
        bottomOffset={72}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false },
        )}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 64,
            paddingBottom: insets.bottom + 40,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {renderOptionRoute("menu", {
          back: () => router.back(),
          close: () => router.back(),
          push: openDetail,
        })}
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: tokens.color.app,
  },
  content: {
    paddingHorizontal: 16,
  },
});
