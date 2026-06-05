import type { StackNavigationProp } from "@react-navigation/stack";

export type RootStackParamList = {
  Main: undefined;
  Option: undefined;
  CharacterEdit: undefined;
  ImageSetting: undefined;
  Settings: undefined;
  Assistant: undefined;
  AssistantCharacter: undefined;
  AssistantCharacterEdit: undefined;
  AssistantHistory: undefined;
  AssistantSettings: undefined;
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

export type AssistantCharacterScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "AssistantCharacter"
>;

export type AssistantCharacterEditScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "AssistantCharacterEdit"
>;

export type AssistantHistoryScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "AssistantHistory"
>;

export type AssistantSettingsScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "AssistantSettings"
>;
