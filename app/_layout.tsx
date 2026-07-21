import "react-native-gesture-handler";

import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { LogBox } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { PortalProvider } from "@gorhom/portal";

import { GenerationOptionsProvider } from "../src/context/GenerationOptionsContext";
import { AppSheetProvider } from "../src/context/AppSheetContext";
import { applyGlobalFont } from "../src/styles/applyGlobalFont";
import { tokens } from "../src/styles/tokens";

const PRETENDARD_FONTS = {
  [tokens.font.regular]: require("../assets/fonts/Pretendard-Regular.otf"),
  [tokens.font.medium]: require("../assets/fonts/Pretendard-Medium.otf"),
  [tokens.font.semibold]: require("../assets/fonts/Pretendard-SemiBold.otf"),
  [tokens.font.bold]: require("../assets/fonts/Pretendard-Bold.otf"),
  [tokens.font.extrabold]: require("../assets/fonts/Pretendard-ExtraBold.otf"),
};

// Pretendard 를 앱 전역 기본 폰트로 적용
applyGlobalFont();

LogBox.ignoreLogs([
  "InteractionManager has been deprecated and will be removed in a future release.",
]);

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(PRETENDARD_FONTS);

  if (fontError) throw fontError;
  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView
      style={{ flex: 1, backgroundColor: tokens.color.app }}
    >
      <SafeAreaProvider>
        <KeyboardProvider>
          <GenerationOptionsProvider>
            <AppSheetProvider>
              {/* PortalProvider 는 AppSheetProvider 안쪽 — 기본 호스트가 옵션
                  시트(BottomSheet)보다 먼저 그려져 z 순서: 시트 > preview > pager. */}
              <PortalProvider>
                <Stack
                  screenOptions={{
                    headerShown: false,
                    animation: "default",
                    animationDuration: 0.1,
                    contentStyle: { backgroundColor: tokens.color.app },
                  }}
                />
              </PortalProvider>
            </AppSheetProvider>
          </GenerationOptionsProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
