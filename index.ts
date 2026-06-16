import notifee, { EventType } from "react-native-notify-kit";

import { CANCEL_ACTION_ID } from "./src/lib/foregroundService";
import { useGenerationStore } from "./src/store/generationStore";

// Foreground service 작업 러너 등록 (top-level 필수).
// 실제 큐 루프를 이 태스크 안에서 구동해야 백그라운드에서도 JS 실행이 보장된다.
// 루프 끝나면 runQueueTask 내부 finally에서 stopForegroundService() 호출.
notifee.registerForegroundService(async () => {
  await useGenerationStore.getState().runQueueTask();
});

// 앱이 백그라운드일 때 알림 "취소" 액션 → 큐 중단
notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (
    type === EventType.ACTION_PRESS &&
    detail.pressAction?.id === CANCEL_ACTION_ID
  ) {
    useGenerationStore.getState().requestQueueCancel();
  }
});

// expo-router/entry가 AppRegistry 등록 및 파일 기반 라우팅 초기화를 담당한다.
// notifee foreground-service 등록은 위에서 top-level로 먼저 수행했다.
import "expo-router/entry";
