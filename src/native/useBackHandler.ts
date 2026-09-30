import { useEffect, useRef } from "react";
import { BackHandler, Platform } from "react-native";

import {
  PREDICTIVE_BACK_SUPPORTED,
  usePredictiveBackHandler,
  type PredictiveBackEvent,
} from "./predictiveBack";

export type BackHandlers = {
  onBack: () => void;
  onStart?: (event: PredictiveBackEvent) => void;
  onProgress?: (event: PredictiveBackEvent) => void;
  onCancel?: () => void;
};

// 뒤로가기 한 번에 한 단계만 닫히도록 등록 규칙을 한 곳에 둔다.
// PredictiveBack 네이티브 모듈이 있으면 app 모드에서 뒤로가기를 가로채고
// system 모드에서는 RN 콜백을 꺼 두므로 hardwareBackPress는 오지 않는다.
// 모듈이 없는 빌드에서만 hardwareBackPress로 대신 처리한다.
export function useBackHandler(enabled: boolean, handlers: BackHandlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  usePredictiveBackHandler(enabled, {
    onStart: (event) => handlersRef.current.onStart?.(event),
    onProgress: (event) => handlersRef.current.onProgress?.(event),
    onCancel: () => handlersRef.current.onCancel?.(),
    onCommit: () => handlersRef.current.onBack(),
  });

  useEffect(() => {
    if (!enabled || Platform.OS !== "android" || PREDICTIVE_BACK_SUPPORTED) {
      return;
    }

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        handlersRef.current.onBack();
        return true;
      },
    );
    return () => subscription.remove();
  }, [enabled]);
}
