import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
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
import { light } from "./home/styles";

// 옵션 상세 선택 화면. 옵션 탭에서 router.push 로 진입 — CharacterEditScreen 처럼
// 별도 스크린으로 넘어간다(Stack ios_from_right).
export function OptionDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ route?: string }>();
  const route = params.route as OptionRoute | undefined;

  const [header, setHeader] = useState<OptionDetailHeaderState>(null);

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
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <StatusBar style="light" />

        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerPillButton}
            activeOpacity={0.78}
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={back}
          >
            <Ionicons name="chevron-back" size={22} color={light.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{DETAIL_TITLES[route] ?? ""}</Text>
            {header?.subtitle ? (
              <Text style={styles.headerSubtitle}>{header.subtitle}</Text>
            ) : null}
          </View>
          {action ? (
            <TouchableOpacity
              style={[
                styles.headerPillButton,
                (action.disabled || action.busy) && styles.headerActionDisabled,
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
          ) : (
            <View style={styles.headerSpacer} />
          )}
        </View>

        <KeyboardAwareScrollView
          bottomOffset={72}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + 48 },
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
  // CharacterEditScreen 헤더 복제.
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  headerPillButton: {
    width: 46,
    height: 46,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: light.surface,
    shadowColor: "#000000",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: light.textPrimary,
  },
  headerSubtitle: {
    marginTop: -1,
    fontSize: 12,
    fontWeight: "700",
    color: light.textHint,
  },
  headerActionDisabled: {
    opacity: 0.5,
  },
  headerSpacer: {
    width: 46,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
});
