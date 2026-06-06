import "react-native-gesture-handler";

import { DarkTheme, NavigationContainer } from "@react-navigation/native";
import {
  createStackNavigator,
  TransitionPresets,
} from "@react-navigation/stack";
import { LogBox } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { KeyboardProvider } from "react-native-keyboard-controller";

import { GenerationOptionsProvider } from "./src/context/GenerationOptionsContext";
import { MainScreen } from "./src/screens/MainScreen";
import { CharacterScreen } from "./src/screens/CharacterScreen";
import { CharacterEditScreen } from "./src/screens/CharacterEditScreen";
import { HistoryScreen } from "./src/screens/HistoryScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import type { RootStackParamList } from "./src/navigation/types";
import { colors } from "./src/styles/colors";

LogBox.ignoreLogs([
  "InteractionManager has been deprecated and will be removed in a future release.",
]);

const Stack = createStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <GestureHandlerRootView
      style={{ flex: 1, backgroundColor: colors.appBackground }}
    >
      <SafeAreaProvider>
      <KeyboardProvider>
        <GenerationOptionsProvider>
          <NavigationContainer
            theme={{
              ...DarkTheme,
              colors: { ...DarkTheme.colors, background: colors.appBackground },
            }}
          >
            <Stack.Navigator
              screenOptions={{
                // animation: "none",
                headerShown: false,
                cardStyle: { backgroundColor: colors.appBackground },
                ...TransitionPresets.SlideFromRightIOS,
              }}
            >
              <Stack.Screen name="Main" component={MainScreen} />
              <Stack.Screen name="Character" component={CharacterScreen} />
              <Stack.Screen
                name="CharacterEdit"
                component={CharacterEditScreen}
              />
              <Stack.Screen name="History" component={HistoryScreen} />
              <Stack.Screen name="Settings" component={SettingsScreen} />
            </Stack.Navigator>
          </NavigationContainer>
        </GenerationOptionsProvider>
      </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
