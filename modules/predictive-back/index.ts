import { requireOptionalNativeModule } from "expo-modules-core";
import { Platform } from "react-native";

export type PredictiveBackEvent = {
  progress: number;
  swipeEdge: number;
  touchX: number;
  touchY: number;
};

type PredictiveBackNativeModule = {
  progressAvailable: boolean;
  setMode: (mode: "app" | "system") => void;
  addListener: (
    eventName: string,
    listener: (event: PredictiveBackEvent) => void,
  ) => { remove: () => void };
};

export const predictiveBackNativeModule =
  Platform.OS === "android"
    ? requireOptionalNativeModule<PredictiveBackNativeModule>("PredictiveBack")
    : null;
