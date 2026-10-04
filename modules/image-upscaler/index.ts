import { requireOptionalNativeModule } from "expo-modules-core";
import { Platform } from "react-native";

export type UpscaleModel = "realcugan-se" | "realcugan-pro" | "waifu2x-cunet";

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
          model: UpscaleModel,
          scale: number,
          // -1 ~ 3. 모델과 배율마다 번들된 값이 다르다.
          noise: number,
          tileSize: number,
          format: UpscaleFormat,
        ): Promise<UpscaleResult>;
      }>("ImageUpscaler")
    : null;
