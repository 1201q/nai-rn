import "react-native-gesture-handler";

import { DarkTheme, NavigationContainer } from "@react-navigation/native";
import {
  createStackNavigator,
  TransitionPresets,
} from "@react-navigation/stack";
import { LogBox } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { GenerationOptionsProvider } from "./src/context/GenerationOptionsContext";
import { MainScreen } from "./src/screens/MainScreen";
import { OptionScreen } from "./src/screens/OptionScreen";
import type { RootStackParamList } from "./src/navigation/types";
import { colors } from "./src/styles/colors";

LogBox.ignoreLogs([
  "InteractionManager has been deprecated and will be removed in a future release.",
]);

const Stack = createStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <GestureHandlerRootView
      style={{ flex: 1, backgroundColor: colors.grey900 }}
    >
      <GenerationOptionsProvider>
        <NavigationContainer
          theme={{
            ...DarkTheme,
            colors: { ...DarkTheme.colors, background: colors.grey900 },
          }}
        >
          <Stack.Navigator
            screenOptions={{
              // animation: "none",
              headerShown: false,
              cardStyle: { backgroundColor: colors.grey900 },
              ...TransitionPresets.SlideFromRightIOS,
            }}
          >
            <Stack.Screen name="Main" component={MainScreen} />
            <Stack.Screen name="Option" component={OptionScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </GenerationOptionsProvider>
    </GestureHandlerRootView>
  );
}
