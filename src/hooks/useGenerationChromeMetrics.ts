import { StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export const GENERATION_ACTION_BAR_CONTENT_HEIGHT = 72;
export const GENERATION_SHEET_HEADER_HEIGHT = 44;
const SHEET_HANDLE_HEIGHT = 17;
// 접힌 시트는 핸들 + 헤더만 보인다. 헤더 구분선 자리는 액션바 위쪽 border가 덮는다.
const PROMPT_PREVIEW_HEIGHT =
  SHEET_HANDLE_HEIGHT +
  GENERATION_SHEET_HEADER_HEIGHT -
  StyleSheet.hairlineWidth;
const SHEET_SCROLL_CLEARANCE = 128;
const SHEET_TOP_GAP = 12;
const SHEET_TOP_MIN = 56;

export function useGenerationChromeMetrics() {
  const { top, bottom } = useSafeAreaInsets();
  const actionBarHeight = GENERATION_ACTION_BAR_CONTENT_HEIGHT + bottom;
  const fullSheetTop = Math.max(SHEET_TOP_MIN, top + SHEET_TOP_GAP);

  // Sheets still extend to the screen bottom; reserve the action bar once.
  return {
    topInset: top,
    bottomInset: bottom,
    actionBarHeight,
    promptCollapsedHeight: actionBarHeight + PROMPT_PREVIEW_HEIGHT,
    sheetContentPaddingBottom: actionBarHeight + SHEET_SCROLL_CLEARANCE,
    promptFullTop: fullSheetTop,
    utilitySheetTop: fullSheetTop,
  };
}
