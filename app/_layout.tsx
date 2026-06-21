import "react-native-gesture-handler";

import { Stack } from "expo-router";
import { LogBox } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { KeyboardProvider } from "react-native-keyboard-controller";

import { GenerationOptionsProvider } from "../src/context/GenerationOptionsContext";
import { AppSheetProvider } from "../src/context/AppSheetContext";
import { colors } from "../src/styles/colors";

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
              <Stack
                screenOptions={{
                  headerShown: false,
                  animation: "ios_from_right",
                  contentStyle: { backgroundColor: colors.appBackground },
                }}
              />
            </AppSheetProvider>
          </GenerationOptionsProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
