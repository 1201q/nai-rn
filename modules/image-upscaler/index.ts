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
        // 처리 중인 작업을 다음 타일 줄에서 멈춘다. upscale은 UPSCALE_CANCELLED로 거부된다.
        cancel(): void;
        // 처리 중인 장의 진행률 (0~1). Real-CUGAN의 사전 패스는 포함하지 않는다.
        addListener(
          name: "progress",
          listener: (event: { fraction: number }) => void,
        ): { remove(): void };
      }>("ImageUpscaler")
    : null;
