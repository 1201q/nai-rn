import type { StackNavigationProp } from "@react-navigation/stack";

export type RootStackParamList = {
  Main: undefined;
  Character: undefined;
  CharacterEdit: undefined;
  Settings: undefined;
};

export type MainScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "Main"
>;

export type CharacterScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "Character"
>;

export type CharacterEditScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "CharacterEdit"
>;

export type SettingsScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "Settings"
>;
