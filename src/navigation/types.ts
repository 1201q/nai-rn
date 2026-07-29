import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

export type RootStackParamList = {
  Generation: undefined;
  AppSettings: undefined;
  ImageSettings: undefined;
  History: undefined;
  ImageToImage: undefined;
  VibeTransfer: undefined;
  PreciseReference: undefined;
  MetadataExtract: undefined;
};

export type AppNavigation = NativeStackNavigationProp<RootStackParamList>;
