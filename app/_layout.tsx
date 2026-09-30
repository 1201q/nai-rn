import "react-native-gesture-handler";

import { useEffect } from "react";
import { Stack } from "expo-router";
import { LogBox, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { PortalProvider } from "@gorhom/portal";
import { toast } from "sonner-native";

import { AppToaster } from "../src/components/common/AppToaster";
import { GenerationOptionsProvider } from "../src/context/GenerationOptionsContext";
import { AppSheetProvider } from "../src/context/AppSheetContext";
import { PredictiveBackScreen } from "../src/components/navigation/PredictiveBackScreen";
import { initializePredictiveBack } from "../src/native/predictiveBack";
import { useGenerationStore } from "../src/store/generationStore";
import { applyGlobalFont } from "../src/styles/applyGlobalFont";
import { tokens } from "../src/styles/tokens";

// Pretendard 를 앱 전역 기본 폰트로 적용
applyGlobalFont();

LogBox.ignoreLogs([
  "InteractionManager has been deprecated and will be removed in a future release.",
]);

export default function RootLayout() {
  const message = useGenerationStore((state) => state.message);
  const setMessage = useGenerationStore((state) => state.setMessage);

  useEffect(() => {
    if (!message) return;
    toast.error(message);
    setMessage(null);
  }, [message, setMessage]);

  useEffect(() => {
    initializePredictiveBack();
  }, []);

  return (
    <GestureHandlerRootView
      style={{ flex: 1, backgroundColor: tokens.color.app }}
    >
      <SafeAreaProvider>
        <KeyboardProvider>
          <GenerationOptionsProvider>
            <AppSheetProvider>
              {/* Keep portal content below the global option sheets. */}
              <PortalProvider>
                <Stack
                  screenLayout={({ children }) =>
                    Platform.OS === "android" ? (
                      <PredictiveBackScreen>{children}</PredictiveBackScreen>
                    ) : (
                      children
                    )
                  }
                  screenOptions={{
                    headerShown: false,
                    animation: Platform.OS === "android" ? "none" : "default",
                    presentation:
                      Platform.OS === "android" ? "transparentModal" : "card",
                    contentStyle: {
                      backgroundColor:
                        Platform.OS === "android"
                          ? "transparent"
                          : tokens.color.app,
                    },
                  }}
                />
              </PortalProvider>
              {/* Render notifications after portal content. */}
              <AppToaster />
            </AppSheetProvider>
          </GenerationOptionsProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
