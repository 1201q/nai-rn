import type { StackNavigationProp } from "@react-navigation/stack";

export type RootStackParamList = {
  Main: undefined;
  Option: undefined;
  CharacterEdit: undefined;
  ImageSetting: undefined;
  Settings: undefined;
  Assistant: undefined;
};

export type MainScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "Main"
>;

export type OptionScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "Option"
>;

export type CharacterEditScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "CharacterEdit"
>;

export type ImageSettingScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "ImageSetting"
>;

export type SettingsScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "Settings"
>;

export type AssistantScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "Assistant"
>;
