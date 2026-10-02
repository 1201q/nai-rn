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
import { PredictiveBackScreen } from "../src/components/navigation/PredictiveBackScreen";
import {
  initializePredictiveBack,
  setPredictiveBackPreviewEnabled,
} from "../src/native/predictiveBack";
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
  const predictiveBackPreview = useGenerationStore(
    (state) => state.predictiveBackPreview,
  );

  useEffect(() => {
    if (!message) return;
    toast.error(message);
    setMessage(null);
  }, [message, setMessage]);

  useEffect(() => {
    initializePredictiveBack();
  }, []);

  useEffect(() => {
    setPredictiveBackPreviewEnabled(predictiveBackPreview);
  }, [predictiveBackPreview]);

  return (
    <GestureHandlerRootView
      style={{ flex: 1, backgroundColor: tokens.color.app }}
    >
      <SafeAreaProvider>
        <KeyboardProvider>
          <GenerationOptionsProvider>
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
          </GenerationOptionsProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
