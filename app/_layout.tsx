import "react-native-gesture-handler";

import { useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import {
  ActivityIndicator,
  LogBox,
  Platform,
  useWindowDimensions,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { PortalProvider } from "@gorhom/portal";
import { Toaster, toast } from "sonner-native";

import { GenerationOptionsProvider } from "../src/context/GenerationOptionsContext";
import { AppSheetProvider } from "../src/context/AppSheetContext";
import { PredictiveBackScreen } from "../src/components/navigation/PredictiveBackScreen";
import { initializePredictiveBack } from "../src/native/predictiveBack";
import { useGenerationStore } from "../src/store/generationStore";
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
  const { width: windowWidth } = useWindowDimensions();
  const toastMaxWidth = Math.min(windowWidth * 0.9, 420);
  const [fontsLoaded, fontError] = useFonts(PRETENDARD_FONTS);
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
                  screenListeners={({ route }) => ({
                    focus: () => {
                      if (__DEV__) {
                        console.log("[navigation] focus", {
                          route: route.name,
                        });
                      }
                    },
                    blur: () => {
                      if (__DEV__) {
                        console.log("[navigation] blur", {
                          route: route.name,
                        });
                      }
                    },
                    transitionStart: (event) => {
                      if (__DEV__) {
                        console.log("[navigation] transitionStart", {
                          route: route.name,
                          closing: event.data.closing,
                        });
                      }
                    },
                    transitionEnd: (event) => {
                      if (__DEV__) {
                        console.log("[navigation] transitionEnd", {
                          route: route.name,
                          closing: event.data.closing,
                        });
                      }
                    },
                  })}
                />
              </PortalProvider>
              {/* PortalHost보다 뒤에 렌더링해 preview 위에 표시한다. */}
              <Toaster
                position="bottom-center"
                theme="dark"
                duration={2000}
                offset={84}
                icons={{
                  success: (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={tokens.color.accent}
                    />
                  ),
                  error: (
                    <Ionicons
                      name="close-circle-outline"
                      size={20}
                      color={tokens.color.negative}
                    />
                  ),
                  warning: (
                    <Ionicons
                      name="warning-outline"
                      size={20}
                      color={tokens.color.accent}
                    />
                  ),
                  info: (
                    <Ionicons
                      name="information-circle-outline"
                      size={20}
                      color={tokens.color.textSecondary}
                    />
                  ),
                  loading: (
                    <ActivityIndicator
                      size="small"
                      color={tokens.color.accent}
                    />
                  ),
                }}
                toastOptions={{
                  toastContainerStyle: {
                    width: "auto",
                    maxWidth: toastMaxWidth,
                    alignSelf: "center",
                  },
                  style: {
                    width: "auto",
                    maxWidth: toastMaxWidth,
                    marginHorizontal: 0,
                    padding: tokens.space[8],
                    borderRadius: tokens.radius.pill,
                    // borderWidth: 1,
                    // borderColor: tokens.color.borderSubtle,
                    backgroundColor: tokens.color.toast,
                    ...tokens.shadow.floatMd,
                  },
                  toastContentStyle: {
                    gap: tokens.space[6],
                  },
                  textContainerStyle: {
                    flex: 0,
                    flexShrink: 1,
                  },
                  titleStyle: {
                    color: tokens.color.textPrimary,
                    fontFamily: tokens.font.semibold,
                    fontSize: tokens.type.base,
                    lineHeight: 20,
                  },
                  descriptionStyle: {
                    color: tokens.color.textSecondary,
                    fontFamily: tokens.font.regular,
                    fontSize: tokens.type.sm,
                    lineHeight: 20,
                  },
                  actionButtonStyle: {
                    paddingHorizontal: tokens.space[7],
                    paddingVertical: tokens.space[3],
                    borderWidth: 0,
                    backgroundColor: tokens.color.accent,
                  },
                  actionButtonTextStyle: {
                    color: tokens.color.onAccent,
                    fontFamily: tokens.font.semibold,
                    fontSize: tokens.type.sm,
                  },
                  cancelButtonTextStyle: {
                    color: tokens.color.textTertiary,
                    fontFamily: tokens.font.semibold,
                    fontSize: tokens.type.sm,
                  },
                  error: {
                    borderColor: tokens.color.borderNegative,
                  },
                }}
              />
            </AppSheetProvider>
          </GenerationOptionsProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
