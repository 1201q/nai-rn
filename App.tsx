import { useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { ActivityIndicator, LogBox, useWindowDimensions } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { PortalProvider } from "@gorhom/portal";
import { Toaster, toast } from "sonner-native";

import { GenerationOptionsProvider } from "./src/context/GenerationOptionsContext";
import { AppSheetProvider } from "./src/context/AppSheetContext";
import { AppNavigator } from "./src/navigation/AppNavigator";
import { useGenerationStore } from "./src/store/generationStore";
import { applyGlobalFont } from "./src/styles/applyGlobalFont";
import { tokens } from "./src/styles/tokens";

const PRETENDARD_FONTS = {
  [tokens.font.regular]: require("./assets/fonts/Pretendard-Regular.otf"),
  [tokens.font.medium]: require("./assets/fonts/Pretendard-Medium.otf"),
  [tokens.font.semibold]: require("./assets/fonts/Pretendard-SemiBold.otf"),
  [tokens.font.bold]: require("./assets/fonts/Pretendard-Bold.otf"),
  [tokens.font.extrabold]: require("./assets/fonts/Pretendard-ExtraBold.otf"),
};

applyGlobalFont();

LogBox.ignoreLogs([
  "InteractionManager has been deprecated and will be removed in a future release.",
]);

export default function App() {
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
              <PortalProvider>
                <AppNavigator />
              </PortalProvider>
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
