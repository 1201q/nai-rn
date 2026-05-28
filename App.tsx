import "react-native-gesture-handler";

import { DarkTheme, NavigationContainer } from "@react-navigation/native";
import {
  createStackNavigator,
  TransitionPresets,
} from "@react-navigation/stack";
import { LogBox } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";

import { GenerationOptionsProvider } from "./src/context/GenerationOptionsContext";
import { MainScreen } from "./src/screens/MainScreen";
import { OptionScreen } from "./src/screens/OptionScreen";
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
              <Stack.Screen name="Option" component={OptionScreen} />
              <Stack.Screen name="Settings" component={SettingsScreen} />
            </Stack.Navigator>
          </NavigationContainer>
        </GenerationOptionsProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
