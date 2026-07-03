import { useRef } from "react";
import { Animated as RNAnimated, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import {
  KeyboardAwareScrollView,
  type KeyboardAwareScrollViewRef,
} from "react-native-keyboard-controller";

import { FloatingPillHeader } from "../../components/FloatingPillHeader";
import { ScreenEdgeFade } from "../../components/ScreenEdgeFade";
import { renderOptionRoute, type OptionRoute } from "../home/OptionsSheet";
import { light } from "../home/styles";

// 프롬프트 페이지의 옵션 탭 = 옵션 메뉴만. 항목 탭 시 별도 상세 스크린으로 push.
// batchCount 만 예외로 전역 시트를 연다.
export function OptionsTab() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scrollY = useRef(new RNAnimated.Value(0)).current;
  const scrollRef = useRef<KeyboardAwareScrollViewRef>(null);

  const push = (r: OptionRoute) => {
    router.push({ pathname: "/option-detail", params: { route: r } });
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <KeyboardAwareScrollView
        ref={scrollRef}
        bottomOffset={72}
        scrollEventThrottle={16}
        onScroll={RNAnimated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false },
        )}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 96 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {renderOptionRoute("menu", {
          back: () => {},
          close: () => {},
          push,
        })}
      </KeyboardAwareScrollView>

      <ScreenEdgeFade
        topHeight={insets.top + 64}
        bottomHeight={insets.bottom + 140}
      />

      <FloatingPillHeader
        title="Options"
        scrollY={scrollY}
        topInset={insets.top}
        variant="solid"
        onTitlePress={() =>
          scrollRef.current?.scrollTo({ y: 0, animated: true })
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: light.bg,
  },
  content: {
    paddingHorizontal: 16,
  },
});
