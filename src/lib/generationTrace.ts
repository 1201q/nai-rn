import { requireOptionalNativeModule } from "expo-modules-core";
import { Platform } from "react-native";

// Older APKs and other platforms still support the JSON timeline.
export const generationTrace = Platform.OS === "android"
  ? requireOptionalNativeModule<{
    anchor(name: string): { beforeBootMs: number; afterBootMs: number; enabled: boolean };
    beginSection(name: string): boolean;
    endSection(): void;
  }>("GenerationTrace")
  : null;
