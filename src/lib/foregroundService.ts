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

// body: 이미지 개수 + 전체 % (예: "4/5 · 45%"), bar: step 단위 전체 진행.
function progressBody(
  imageIndex: number,
  imageTotal: number,
  doneSteps: number,
  totalSteps: number,
) {
  const pct = totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 0;
  return imageTotal > 1 ? `${imageIndex}/${imageTotal} · ${pct}%` : `${pct}% 생성중`;
}

function progressConfig(doneSteps: number, totalSteps: number) {
  return totalSteps > 0
    ? { max: totalSteps, current: doneSteps }
    : { indeterminate: true };
}

// 반환값: foreground service 알림이 떠서 등록 태스크가 큐를 구동할지 여부.
// false면 호출 측이 직접 큐를 돌려야 함(포그라운드 한정).
export async function startGenerationService(
  total: number,
  steps: number,
): Promise<boolean> {
  if (!isAndroid) return false;
  try {
    await ensureNotifReady();
    await notifee.displayNotification({
      id: NOTIF_ID,
      title: "이미지 생성",
      body: progressBody(0, total, 0, total * steps),
      android: {
        channelId: CHANNEL_ID,
        asForegroundService: true,
        onlyAlertOnce: true,
        ongoing: true,
        progress: progressConfig(0, total * steps),
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

export async function updateGenerationProgress(
  imageIndex: number,
  imageTotal: number,
  doneSteps: number,
  totalSteps: number,
) {
  if (!isAndroid) return;
  try {
    await notifee.displayNotification({
      id: NOTIF_ID,
      title: "이미지 생성",
      body: progressBody(imageIndex, imageTotal, doneSteps, totalSteps),
      android: {
        channelId: CHANNEL_ID,
        asForegroundService: true,
        onlyAlertOnce: true,
        ongoing: true,
        progress: progressConfig(doneSteps, totalSteps),
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
