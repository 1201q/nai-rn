import { requireOptionalNativeModule } from "expo-modules-core";
import { Platform } from "react-native";

export type UpscaleEngine = "realcugan" | "waifu2x";

// jpg는 품질 95, webp는 손실 품질 90
export type UpscaleFormat = "png" | "jpg" | "webp";

export type UpscaleResult = {
  uri: string;
  width: number;
  height: number;
  bytes: number;
  // 추론 시간만 포함 (디코딩/파일 저장 제외)
  elapsedMs: number;
  usedGpu: boolean;
  tileSize: number;
};

export const imageUpscaler =
  Platform.OS === "android"
    ? requireOptionalNativeModule<{
        // tileSize 0 = 자동
        upscale(
          inputUri: string,
          engine: UpscaleEngine,
          model: string,
          tileSize: number,
          format: UpscaleFormat,
        ): Promise<UpscaleResult>;
      }>("ImageUpscaler")
    : null;
