import { Platform } from "react-native";
import notifee, { AndroidImportance } from "react-native-notify-kit";

const isAndroid = Platform.OS === "android";

const CHANNEL_ID = "generation";
const NOTIF_ID = "generation-progress";
export const CANCEL_ACTION_ID = "cancel";
export const UPSCALE_CANCEL_ACTION_ID = "upscale-cancel";

// foreground service 알림은 앱에 하나뿐이라 생성과 업스케일이 같이 쓴다.
// 먼저 시작한 쪽이 서비스를 띄워 알림에 진행 상황을 표시하고, 둘 다 끝나야 내린다.
type ServiceUser = "generation" | "upscale";
const activeUsers = new Set<ServiceUser>();
let displayedUser: ServiceUser | null = null;

async function releaseService(user: ServiceUser) {
  activeUsers.delete(user);
  const [remaining] = activeUsers;
  if (remaining) {
    // 남은 쪽이 다음 진행 갱신 때 알림을 이어받는다.
    if (displayedUser === user) displayedUser = remaining;
    return;
  }
  displayedUser = null;
  try {
    await notifee.stopForegroundService();
  } catch {
    // 무시
  }
}

const LIVE_UPDATE_TYPE_KEY = "nairn.liveUpdate";
const LIVE_UPDATE_SEGMENT_COUNT_KEY = "nairn.liveUpdateSegmentCount";
const LIVE_UPDATE_SHORT_TEXT_KEY = "nairn.liveUpdateShortText";

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
  return imageTotal > 1
    ? `${imageIndex}/${imageTotal} · ${pct}%`
    : `${pct}% 생성중`;
}

function progressConfig(doneSteps: number, totalSteps: number) {
  return totalSteps > 0
    ? { max: totalSteps, current: doneSteps }
    : { indeterminate: true };
}

function liveUpdateData(imageIndex: number, imageTotal: number) {
  if (imageTotal < 2) return undefined;

  return {
    [LIVE_UPDATE_TYPE_KEY]: "generation",
    [LIVE_UPDATE_SEGMENT_COUNT_KEY]: String(imageTotal),
    [LIVE_UPDATE_SHORT_TEXT_KEY]:
      imageIndex > 0 ? `${imageIndex}/${imageTotal}` : "준비 중",
  };
}

// 반환값: foreground service 알림이 떠서 등록 태스크가 큐를 구동할지 여부.
// false면 호출 측이 직접 큐를 돌려야 함(포그라운드 한정).
export async function startGenerationService(
  total: number,
  steps: number,
): Promise<boolean> {
  if (!isAndroid) return false;
  activeUsers.add("generation");
  // 업스케일이 이미 서비스를 띄웠으면 그 서비스에 얹혀서 직접 구동한다.
  if (displayedUser) return false;
  try {
    await ensureNotifReady();
    displayedUser = "generation";
    await notifee.displayNotification({
      id: NOTIF_ID,
      title: "이미지 생성",
      body: progressBody(0, total, 0, total * steps),
      data: liveUpdateData(0, total),
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
    displayedUser = null;
    return false;
  }
}

export async function updateGenerationProgress(
  imageIndex: number,
  imageTotal: number,
  doneSteps: number,
  totalSteps: number,
) {
  if (!isAndroid || displayedUser === "upscale") return;
  try {
    await notifee.displayNotification({
      id: NOTIF_ID,
      title: "이미지 생성",
      body: progressBody(imageIndex, imageTotal, doneSteps, totalSteps),
      data: liveUpdateData(imageIndex, imageTotal),
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
  await releaseService("generation");
}

function upscaleNotification(done: number, total: number) {
  return {
    id: NOTIF_ID,
    title: "이미지 업스케일",
    body: `${done}/${total}`,
    android: {
      channelId: CHANNEL_ID,
      asForegroundService: true,
      onlyAlertOnce: true,
      ongoing: true,
      progress: { max: total, current: done },
      pressAction: { id: "default" },
      actions: [
        { title: "중단", pressAction: { id: UPSCALE_CANCEL_ACTION_ID } },
      ],
    },
  };
}

// 반환값은 startGenerationService와 같다: false면 호출 측이 직접 큐를 돌린다.
export async function startUpscaleService(total: number): Promise<boolean> {
  if (!isAndroid) return false;
  activeUsers.add("upscale");
  if (displayedUser) return false;
  try {
    await ensureNotifReady();
    displayedUser = "upscale";
    await notifee.displayNotification(upscaleNotification(0, total));
    return true;
  } catch {
    displayedUser = null;
    return false;
  }
}

export async function updateUpscaleProgress(done: number, total: number) {
  if (!isAndroid || displayedUser !== "upscale") return;
  try {
    await notifee.displayNotification(upscaleNotification(done, total));
  } catch {
    // 무시
  }
}

export async function stopUpscaleService() {
  if (!isAndroid) return;
  await releaseService("upscale");
}
