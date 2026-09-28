import { useEffect } from "react";
import { useSharedValue, withSpring } from "react-native-reanimated";

import {
  PIP_BACK_MIN_SCALE,
  PIP_BACK_RESET_DELAY_MS,
  subscribePipBack,
} from "../lib/pipLayout";

// 루트 뒤로가기(-> PiP) 제스처 진행률만큼 이미지를 줄인다. 시스템 예측 애니메이션 대신 주는 피드백.
export function usePipBackScale(enabled: boolean) {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (!enabled) return;
    let reset: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribePipBack((progress, phase) => {
      clearTimeout(reset);
      if (phase === "progress") {
        scale.value = 1 - (1 - PIP_BACK_MIN_SCALE) * progress;
      } else if (phase === "cancel") {
        scale.value = withSpring(1);
      } else {
        // PiP 창으로 넘어간 뒤 원래 크기로 되돌린다 (확장 시 원래 화면).
        reset = setTimeout(() => {
          scale.value = 1;
        }, PIP_BACK_RESET_DELAY_MS);
      }
    });
    return () => {
      unsubscribe();
      clearTimeout(reset);
      scale.value = 1;
    };
  }, [enabled, scale]);

  return scale;
}
