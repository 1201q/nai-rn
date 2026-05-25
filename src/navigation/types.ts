import type { StackNavigationProp } from "@react-navigation/stack";

export type RootStackParamList = {
  Main: undefined;
  Option: undefined;
};

export type MainScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "Main"
>;

export type OptionScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "Option"
>;
