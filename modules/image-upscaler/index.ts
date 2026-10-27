import { requireOptionalNativeModule } from "expo-modules-core";
import { Platform } from "react-native";

export type UpscaleModel = "realcugan-se" | "realcugan-pro" | "waifu2x-cunet";

export type UpscaleFormat = "png" | "jpg" | "webp";

export type UpscaleAdvancedOptions = {
  ttaMode: boolean;
  syncGap: 0 | 1 | 2 | 3;
  limitGpuPerformance: boolean;
  useGpu: boolean;
  // 0 = automatic; native clamps explicit values to the selected cluster.
  cpuThreads: number;
  // 0 = all, 1 = little, 2 = big.
  cpuPolicy: 0 | 1 | 2;
};

export type UpscaleCpuInfo = {
  all: number;
  little: number;
  big: number;
};

export type UpscaleInputInfo = {
  width: number;
  height: number;
  filename: string | null;
};

export type UpscaleGpuInfo = {
  available: boolean;
  heapBudgetMiB: number | null;
};

export type UpscaleResult = {
  uri: string;
  width: number;
  height: number;
  bytes: number;
  // 추론 시간만 포함 (디코딩/파일 저장 제외)
  elapsedMs: number;
  usedGpu: boolean;
  tileSize: number;
  cpuThreads: number;
  cpuPolicy: 0 | 1 | 2;
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
          // 1~100. PNG에서는 무시된다.
          quality: number,
          advanced: UpscaleAdvancedOptions,
        ): Promise<UpscaleResult>;
        getGpuInfo(): Promise<UpscaleGpuInfo>;
        getCpuInfo(): Promise<UpscaleCpuInfo>;
        getInputInfo(uri: string): Promise<UpscaleInputInfo>;
        // 처리 중인 작업을 다음 타일 줄에서 멈춘다. upscale은 UPSCALE_CANCELLED로 거부된다.
        cancel(): void;
        // 처리 중인 장의 진행률 (0~1). Real-CUGAN의 사전 패스는 포함하지 않는다.
        addListener(
          name: "progress",
          listener: (event: { fraction: number }) => void,
        ): { remove(): void };
      }>("ImageUpscaler")
    : null;
