import { Platform } from "react-native";
import notifee, {
  AndroidImportance,
} from "react-native-notify-kit";

const isAndroid = Platform.OS === "android";

const CHANNEL_ID = "generation";
const NOTIF_ID = "generation-progress";
export const CANCEL_ACTION_ID = "cancel";

let channelReady = false;

async function ensureNotifReady() {
  await notifee.requestPermission();
  if (!channelReady) {
    await notifee.createChannel({
      id: CHANNEL_ID,
      name: "이미지 생성",
      importance: AndroidImportance.LOW,
    });
    channelReady = true;
  }
}

function progressBody(index: number, total: number) {
  return total > 1 ? `${index}/${total} 생성중` : "생성중...";
}

function progressConfig(index: number, total: number) {
  return total > 1
    ? { max: total, current: index }
    : { indeterminate: true };
}

// 반환값: foreground service 알림이 떠서 등록 태스크가 큐를 구동할지 여부.
// false면 호출 측이 직접 큐를 돌려야 함(포그라운드 한정).
export async function startGenerationService(total: number): Promise<boolean> {
  if (!isAndroid) return false;
  try {
    await ensureNotifReady();
    await notifee.displayNotification({
      id: NOTIF_ID,
      title: "이미지 생성",
      body: progressBody(0, total),
      android: {
        channelId: CHANNEL_ID,
        asForegroundService: true,
        onlyAlertOnce: true,
        ongoing: true,
        progress: progressConfig(0, total),
        pressAction: { id: "default" },
        actions: [{ title: "취소", pressAction: { id: CANCEL_ACTION_ID } }],
      },
    });
    return true;
  } catch {
    // 알림 권한 거부 등 — 서비스 없이 포그라운드로만 진행
    return false;
  }
}

export async function updateGenerationProgress(index: number, total: number) {
  if (!isAndroid) return;
  try {
    await notifee.displayNotification({
      id: NOTIF_ID,
      title: "이미지 생성",
      body: progressBody(index, total),
      android: {
        channelId: CHANNEL_ID,
        asForegroundService: true,
        onlyAlertOnce: true,
        ongoing: true,
        progress: progressConfig(index, total),
        pressAction: { id: "default" },
        actions: [{ title: "취소", pressAction: { id: CANCEL_ACTION_ID } }],
      },
    });
  } catch {
    // 무시
  }
}

export async function stopGenerationService() {
  if (!isAndroid) return;
  try {
    await notifee.stopForegroundService();
  } catch {
    // 무시
  }
}
