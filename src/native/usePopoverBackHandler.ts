import { useCallback } from "react";
import {
  cancelAnimation,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import type { PredictiveBackEvent } from "./predictiveBack";
import {
  PREDICTIVE_BACK_CANCEL_SPRING,
  PREDICTIVE_BACK_MIN_SCALE,
  PREDICTIVE_BACK_SCALE_STOP,
} from "./predictiveBackStyle";
import { useBackHandler } from "./useBackHandler";

// 떠 있는 목록/메뉴 공용: 뒤로가기로 닫고, 예측 뒤로가기 제스처 동안 살짝 줄인다.
export function usePopoverBackHandler(open: boolean, onClose: () => void) {
  const progress = useSharedValue(0);

  const trackPredictiveBack = useCallback(
    (event: PredictiveBackEvent) => {
      cancelAnimation(progress);
      progress.value = event.progress;
    },
    [progress],
  );
  const cancelPredictiveBack = useCallback(() => {
    progress.value = withSpring(0, PREDICTIVE_BACK_CANCEL_SPRING);
  }, [progress]);
  // 다시 열 때 이전 제스처의 축소가 남지 않게 한다.
  const resetPredictiveBack = useCallback(() => {
    cancelAnimation(progress);
    progress.value = 0;
  }, [progress]);
  const popoverStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(
          progress.value,
          [0, PREDICTIVE_BACK_SCALE_STOP],
          [1, PREDICTIVE_BACK_MIN_SCALE],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  useBackHandler(open, {
    onBack: onClose,
    onStart: trackPredictiveBack,
    onProgress: trackPredictiveBack,
    onCancel: cancelPredictiveBack,
  });

  return { popoverStyle, resetPredictiveBack };
}
