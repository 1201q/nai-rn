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
  pipChange: { active: boolean };
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
    openPip(width: number, height: number): void;
    closePip(): void;
    setPipSession(generating: boolean, autoEnter: boolean, width: number, height: number): void;
    setAutoPipSuppressed(suppressed: boolean): void;
    addListener<E extends keyof NativePipelineEvents>(
      name: E, listener: (event: NativePipelineEvents[E]) => void,
    ): { remove(): void };
  }>("GenerationImagePipeline")
  : null;

export function previewRequestId(uri: string | null) {
  return uri?.match(/\/nai-stream-previews\/(gen_[a-zA-Z0-9_]+)\//)?.[1] ?? null;
}

let autoPipSuppressions = 0;

// 앱이 직접 다른 Activity(권한 창, 이미지 선택기)를 띄우면 onUserLeaveHint가 와서 자동 PiP가 켜지므로 그동안 막는다.
export async function withAutoPipSuppressed<T>(task: () => Promise<T>): Promise<T> {
  if (autoPipSuppressions++ === 0) generationImagePipeline?.setAutoPipSuppressed(true);
  try {
    return await task();
  } finally {
    if (--autoPipSuppressions === 0) generationImagePipeline?.setAutoPipSuppressed(false);
  }
}

export function releaseNativePreviews(requestId: string) {
  void generationImagePipeline?.releasePreviews(requestId).catch(() => {});
}
