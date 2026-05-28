import type { StackNavigationProp } from "@react-navigation/stack";

export type RootStackParamList = {
  Main: undefined;
  Option: undefined;
  Settings: undefined;
};

export type MainScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "Main"
>;

export type OptionScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "Option"
>;

export type SettingsScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "Settings"
>;
