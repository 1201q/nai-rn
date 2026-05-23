import type { StackNavigationProp } from "@react-navigation/stack";

export type RootStackParamList = {
  Create: undefined;
  Option: undefined;
};

export type CreateScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "Create"
>;

export type OptionScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "Option"
>;
