import { requireOptionalNativeModule } from "expo-modules-core";
import { Platform } from "react-native";

const GENERATION_WAKE_LOCK_TIMEOUT_MS = 60 * 60 * 1000;

type GenerationWakeLockNativeModule = {
  acquire(timeoutMs: number): Promise<boolean>;
  release(): Promise<boolean>;
  isHeld(): Promise<boolean>;
};

const nativeModule =
  Platform.OS === "android"
    ? requireOptionalNativeModule<GenerationWakeLockNativeModule>(
        "GenerationWakeLock",
      )
    : null;

export async function acquireGenerationWakeLock(): Promise<boolean> {
  if (!nativeModule) return false;

  try {
    return await nativeModule.acquire(GENERATION_WAKE_LOCK_TIMEOUT_MS);
  } catch {
    return false;
  }
}

export async function releaseGenerationWakeLock(): Promise<boolean> {
  if (!nativeModule) return false;

  try {
    return await nativeModule.release();
  } catch {
    return false;
  }
}

export async function isGenerationWakeLockHeld(): Promise<boolean> {
  if (!nativeModule) return false;

  try {
    return await nativeModule.isHeld();
  } catch {
    return false;
  }
}
