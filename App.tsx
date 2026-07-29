import "react-native-gesture-handler";

import { useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import { PortalProvider } from "@gorhom/portal";
import { useFonts } from "expo-font";
import * as ExpoLinking from "expo-linking";
import { NavigationHandler } from "navigation-react";
import { NavigationStack, Scene } from "navigation-react-native";
import { ActivityIndicator, LogBox, useWindowDimensions } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Toaster, toast } from "sonner-native";

import { AppSheetProvider } from "./src/context/AppSheetContext";
import { GenerationOptionsProvider } from "./src/context/GenerationOptionsContext";
import {
  appStateNavigator,
  type AppRoute,
} from "./src/navigation/appNavigation";
import { GenerationScreen } from "./src/screens/generation/GenerationScreen";
import { HistoryScreen } from "./src/screens/history/HistoryScreen";
import { MetadataExtractScreen } from "./src/screens/metadata/MetadataExtractScreen";
import { ImageToImageScreen } from "./src/screens/references/ImageToImageScreen";
import { PreciseReferenceScreen } from "./src/screens/references/PreciseReferenceScreen";
import { VibeTransferScreen } from "./src/screens/references/VibeTransferScreen";
import { AppSettingsScreen } from "./src/screens/settings/AppSettingsScreen";
import { ImageSettingsScreen } from "./src/screens/settings/ImageSettingsScreen";
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

const DEEP_LINK_ROUTES: Record<string, AppRoute> = {
  "": "home",
  history: "history",
  "image-settings": "imageSettings",
  "image-to-image": "imageToImage",
  "metadata-extract": "metadataExtract",
  "precise-reference": "preciseReference",
  settings: "settings",
  "vibe-transfer": "vibeTransfer",
};

applyGlobalFont();

LogBox.ignoreLogs([
  "InteractionManager has been deprecated and will be removed in a future release.",
]);

function getRouteFromUrl(url: string): AppRoute | null {
  const parsed = ExpoLinking.parse(url);
  const path = [parsed.hostname, parsed.path]
    .filter(Boolean)
    .join("/")
    .replace(/^\/+|\/+$/g, "");

  return DEEP_LINK_ROUTES[path] ?? null;
}

function navigateToDeepLink(route: AppRoute) {
  const { state, crumbs } = appStateNavigator.stateContext;

  if (!state) {
    requestAnimationFrame(() => navigateToDeepLink(route));
    return;
  }

  if (route === "home") {
    if (crumbs.length > 0) {
      appStateNavigator.navigateBack(crumbs.length);
    } else if (state.key !== "home") {
      appStateNavigator.navigate("home");
    }
    return;
  }

  if (state.key !== route) {
    appStateNavigator.navigate(route);
  }
}

function AppNavigationStack() {
  useEffect(() => {
    let active = true;

    void ExpoLinking.getInitialURL().then((url) => {
      if (!active || !url) return;
      const route = getRouteFromUrl(url);
      if (route) navigateToDeepLink(route);
    });

    const subscription = ExpoLinking.addEventListener("url", ({ url }) => {
      const route = getRouteFromUrl(url);
      if (route) navigateToDeepLink(route);
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return (
    <NavigationStack
      backgroundColor={() => tokens.color.app}
      underlayColor={tokens.color.app}
    >
      <Scene stateKey="home">
        <GenerationScreen />
      </Scene>
      <Scene stateKey="history">
        <HistoryScreen />
      </Scene>
      <Scene stateKey="imageSettings">
        <ImageSettingsScreen />
      </Scene>
      <Scene stateKey="imageToImage">
        <ImageToImageScreen />
      </Scene>
      <Scene stateKey="metadataExtract">
        <MetadataExtractScreen />
      </Scene>
      <Scene stateKey="preciseReference">
        <PreciseReferenceScreen />
      </Scene>
      <Scene stateKey="settings">
        <AppSettingsScreen />
      </Scene>
      <Scene stateKey="vibeTransfer">
        <VibeTransferScreen />
      </Scene>
    </NavigationStack>
  );
}

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
                <NavigationHandler stateNavigator={appStateNavigator}>
                  <AppNavigationStack />
                </NavigationHandler>
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
