import type { PlayerPanelDetail } from "./PlayerSettingDetailContent";

export function pushPlayerPanelDetail(
  stack: PlayerPanelDetail[],
  detail: PlayerPanelDetail,
) {
  return stack[stack.length - 1] === detail ? stack : [...stack, detail];
}

export function popPlayerPanelDetail(stack: PlayerPanelDetail[]) {
  return stack.slice(0, -1);
}
