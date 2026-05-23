import "react-native-gesture-handler";

import { DarkTheme, NavigationContainer } from "@react-navigation/native";
import {
  createStackNavigator,
  TransitionPresets,
} from "@react-navigation/stack";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { GenerationOptionsProvider } from "./src/context/GenerationOptionsContext";
import { CreateScreen } from "./src/screens/CreateScreen";
import { OptionScreen } from "./src/screens/OptionScreen";
import type { RootStackParamList } from "./src/navigation/types";
import { colors } from "./src/styles/colors";

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
              headerShown: false,
              cardStyle: { backgroundColor: colors.grey900 },
              ...TransitionPresets.SlideFromRightIOS,
            }}
          >
            <Stack.Screen name="Create" component={CreateScreen} />
            <Stack.Screen name="Option" component={OptionScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </GenerationOptionsProvider>
    </GestureHandlerRootView>
  );
}
