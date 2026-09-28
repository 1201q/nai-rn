import { requireOptionalNativeModule } from "expo-modules-core";
import { Platform } from "react-native";

export type NativeImageEvent = {
  requestId: string;
  type: "intermediate" | "final";
  imageUri?: string;
  step: number | null;
  generationId: number | null;
};

type NativePipelineEvents = {
  image: NativeImageEvent;
  pipAction: { action: "cancel" };
};

export const generationImagePipeline = Platform.OS === "android"
  ? requireOptionalNativeModule<{
    prepare(requestId: string, previewEnabled: boolean): void;
    generate(requestId: string, token: string, body: string, originalUri: string, thumbnailUri: string): Promise<{
      originalUri: string;
      thumbnailUri: string | null;
      metadata: Record<string, string>;
    }>;
    cancel(requestId: string): void;
    setPreviewEnabled(requestId: string, enabled: boolean): void;
    releasePreviews(requestId: string): Promise<void>;
    retainPreviews(requestId: string): void;
    isPipSupported(): boolean;
    setPipState(autoEnter: boolean, generating: boolean): void;
    setPipSourceRect(x: number, y: number, width: number, height: number): void;
    enterPip(): void;
    addListener<E extends keyof NativePipelineEvents>(
      name: E, listener: (event: NativePipelineEvents[E]) => void,
    ): { remove(): void };
  }>("GenerationImagePipeline")
  : null;

export function previewRequestId(uri: string | null) {
  return uri?.match(/\/nai-stream-previews\/(gen_[a-zA-Z0-9_]+)\//)?.[1] ?? null;
}

export function releaseNativePreviews(requestId: string) {
  void generationImagePipeline?.releasePreviews(requestId).catch(() => {});
}
