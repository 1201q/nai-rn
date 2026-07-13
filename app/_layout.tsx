import "react-native-gesture-handler";

import { Stack } from "expo-router";
import { LogBox } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { PortalProvider } from "@gorhom/portal";

import { GenerationOptionsProvider } from "../src/context/GenerationOptionsContext";
import { AppSheetProvider } from "../src/context/AppSheetContext";
import { colors } from "../src/styles/colors";
import { applyGlobalFont } from "../src/styles/applyGlobalFont";

// Pretendard 를 앱 전역 기본 폰트로 적용
applyGlobalFont();

LogBox.ignoreLogs([
  "InteractionManager has been deprecated and will be removed in a future release.",
]);

export default function RootLayout() {
  return (
    <GestureHandlerRootView
      style={{ flex: 1, backgroundColor: colors.appBackground }}
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
                    animation: "ios_from_right",
                    contentStyle: { backgroundColor: colors.appBackground },
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
