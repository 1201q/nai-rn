import {
  DarkTheme,
  NavigationContainer,
  type LinkingOptions,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import * as Linking from "expo-linking";

import { GenerationScreen } from "../screens/generation/GenerationScreen";
import { HistoryScreen } from "../screens/history/HistoryScreen";
import { MetadataExtractScreen } from "../screens/metadata/MetadataExtractScreen";
import { ImageToImageScreen } from "../screens/references/ImageToImageScreen";
import { PreciseReferenceScreen } from "../screens/references/PreciseReferenceScreen";
import { VibeTransferScreen } from "../screens/references/VibeTransferScreen";
import { AppSettingsScreen } from "../screens/settings/AppSettingsScreen";
import { ImageSettingsScreen } from "../screens/settings/ImageSettingsScreen";
import { tokens } from "../styles/tokens";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [Linking.createURL("/"), "nairn://"],
  config: {
    screens: {
      Generation: "",
      AppSettings: "settings",
      ImageSettings: "image-settings",
      History: "history",
      ImageToImage: "image-to-image",
      VibeTransfer: "vibe-transfer",
      PreciseReference: "precise-reference",
      MetadataExtract: "metadata-extract",
    },
  },
};

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: tokens.color.app,
    card: tokens.color.app,
  },
};

export function AppNavigator() {
  return (
    <NavigationContainer linking={linking} theme={navigationTheme}>
      <Stack.Navigator
        initialRouteName="Generation"
        screenOptions={{
          headerShown: false,
          animation: "default",
          contentStyle: { backgroundColor: tokens.color.app },
        }}
        screenListeners={({ route }) => ({
          focus: () => {
            if (__DEV__) {
              console.log("[navigation] focus", { route: route.name });
            }
          },
          blur: () => {
            if (__DEV__) {
              console.log("[navigation] blur", { route: route.name });
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
      >
        <Stack.Screen name="Generation" component={GenerationScreen} />
        <Stack.Screen name="AppSettings" component={AppSettingsScreen} />
        <Stack.Screen name="ImageSettings" component={ImageSettingsScreen} />
        <Stack.Screen name="History" component={HistoryScreen} />
        <Stack.Screen name="ImageToImage" component={ImageToImageScreen} />
        <Stack.Screen name="VibeTransfer" component={VibeTransferScreen} />
        <Stack.Screen
          name="PreciseReference"
          component={PreciseReferenceScreen}
        />
        <Stack.Screen
          name="MetadataExtract"
          component={MetadataExtractScreen}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
