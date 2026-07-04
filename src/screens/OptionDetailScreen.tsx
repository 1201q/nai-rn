import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import {
  DETAIL_TITLES,
  renderOptionRoute,
  type OptionRoute,
} from "./home/OptionsSheet";
import {
  OptionDetailHeaderProvider,
  type OptionDetailHeaderState,
} from "./optionDetailHeader";
import { DetailPillHeader } from "../components/DetailPillHeader";
import { ScreenEdgeFade } from "../components/ScreenEdgeFade";
import { light } from "./home/styles";

// 옵션 상세 선택 화면. 옵션 탭에서 router.push 로 진입 — CharacterEditScreen 처럼
// 별도 스크린으로 넘어간다(Stack ios_from_right).
export function OptionDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ route?: string }>();
  const route = params.route as OptionRoute | undefined;

  const [header, setHeader] = useState<OptionDetailHeaderState>(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  const back = useCallback(() => router.back(), [router]);
  const push = useCallback(
    (r: OptionRoute) =>
      router.push({ pathname: "/option-detail", params: { route: r } }),
    [router],
  );

  // 잘못된 진입(파라미터 없음/메뉴) 방어.
  if (!route || route === "menu") return null;

  const action = header?.action ?? null;

  return (
    <OptionDetailHeaderProvider value={setHeader}>
      <View style={styles.screen}>
        <StatusBar style="light" />

        <ScreenEdgeFade topHeight={insets.top + 64} />

        <DetailPillHeader
          title={DETAIL_TITLES[route] ?? ""}
          subtitle={header?.subtitle ?? undefined}
          scrollY={scrollY}
          topInset={insets.top}
          onBack={back}
          right={
            action ? (
              <TouchableOpacity
                style={[
                  styles.headerAction,
                  (action.disabled || action.busy) &&
                    styles.headerActionDisabled,
                ]}
                activeOpacity={0.78}
                disabled={action.disabled || action.busy}
                accessibilityRole="button"
                accessibilityLabel={action.label}
                onPress={action.onPress}
              >
                {action.busy ? (
                  <ActivityIndicator size="small" color={light.textPrimary} />
                ) : (
                  <Ionicons name="add" size={24} color={light.textPrimary} />
                )}
              </TouchableOpacity>
            ) : undefined
          }
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
            { paddingTop: insets.top + 56 + 8, paddingBottom: insets.bottom + 48 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {renderOptionRoute(route, { back, close: back, push })}
        </KeyboardAwareScrollView>
      </View>
    </OptionDetailHeaderProvider>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: light.bg,
  },
  // pill 내부 액션 아이콘 — 배경은 DetailPillHeader 의 Pill 이 담당. pillHeader 와 동일 30.
  headerAction: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  headerActionDisabled: {
    opacity: 0.5,
  },
  content: {
    paddingHorizontal: 16,
  },
});
