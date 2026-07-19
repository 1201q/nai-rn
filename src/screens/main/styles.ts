import { StyleSheet } from "react-native";

import { colors } from "../../styles/colors";
import { tokens } from "../../styles/tokens";

export const MAIN_SEGMENT_WIDTH = 100;
export const MAIN_SEGMENT_HEIGHT = 36;
export const MAIN_SEGMENT_PADDING = 3;
export const MAIN_SEGMENT_BUTTON_WIDTH =
  (MAIN_SEGMENT_WIDTH - MAIN_SEGMENT_PADDING * 2) / 2;

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.appBackground,
  },
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  headerSide: {
    width: 88,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerIconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentedControl: {
    width: MAIN_SEGMENT_WIDTH,
    height: MAIN_SEGMENT_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
    borderRadius: 999,
    padding: MAIN_SEGMENT_PADDING,
    backgroundColor: colors.colorBackgroundSecondary,
  },
  segmentIndicator: {
    position: "absolute",
    top: MAIN_SEGMENT_PADDING,
    left: MAIN_SEGMENT_PADDING,
    width: MAIN_SEGMENT_BUTTON_WIDTH,
    height: MAIN_SEGMENT_HEIGHT - MAIN_SEGMENT_PADDING * 2,
    borderRadius: 999,
    backgroundColor: colors.colorBackgroundTertiary,
  },
  segmentButton: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    zIndex: 1,
  },
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
    backgroundColor: colors.appBackground,
  },
  imageStage: {
    flex: 1,
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  generatedImageWrap: {
    overflow: "hidden",
    borderRadius: 14,
    backgroundColor: colors.colorBackgroundSecondary,
  },
  generatedImage: {
    width: "100%",
    height: "100%",
  },
  imageActionRow: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
  },
  imageActionButton: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: colors.colorBackgroundSecondary,
  },
  message: {
    marginHorizontal: 16,
    marginBottom: 10,
    color: colors.colorTextDanger,
    fontSize: 13,
    lineHeight: 18,
  },
  actionArea: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 18,
    gap: 10,
  },
  toolButtonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  toolButton: {
    flex: 1,
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 22,
    backgroundColor: colors.colorBackgroundSecondary,
  },
  toolButtonText: {
    color: colors.colorTextSecondary,
    fontSize: 13,
    fontWeight: "700",
  },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  generateButton: {
    flex: 1,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: colors.colorBackgroundInverse,
  },
  disabledButton: {
    opacity: 0.62,
  },
  generateText: {
    color: colors.colorTextInverse,
    fontSize: 18,
    fontWeight: "800",
  },
  historyList: {
    flex: 1,
  },
  historyGrid: {
    paddingHorizontal: 2,
    paddingTop: 2,
    paddingBottom: 18,
  },
  historyEmptyGrid: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  historyTile: {
    overflow: "hidden",
    backgroundColor: colors.colorBackgroundSecondary,
  },
  historyImage: {
    width: "100%",
    height: "100%",
  },
  historyEmptyState: {
    alignItems: "center",
  },
  historyEmptyTitle: {
    marginBottom: 6,
    color: colors.colorTextPrimary,
    fontSize: 16,
    fontWeight: "800",
  },
  historyEmptyText: {
    color: colors.colorTextTertiary,
    fontSize: 13,
  },
  previewBackdrop: {
    backgroundColor: "#000",
  },
  // FloatingPillHeader 우측 pill(blur) 과 동일한 위치/모양
  previewCloseButton: {
    position: "absolute",
    left: tokens.space[10],
    width: 40,
    height: 40,
    borderRadius: tokens.radius.pill,
    ...tokens.shadow.floatSm,
  },
  previewCloseButtonRendraHeader: {
    left: tokens.space[8],
    width: 36,
    height: 36,
  },
  previewCloseBg: {
    ...StyleSheet.absoluteFill,
    borderRadius: tokens.radius.pill,
    overflow: "hidden",
    backgroundColor: tokens.color.overlay,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.borderSubtle,
  },
  previewCloseTouch: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: tokens.radius.pill,
  },
  // HistoryScreen 선택모드 하단 pill 컨트롤바와 동일
  previewActionWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 30,
    elevation: 30,
  },
  previewActionShadow: {
    borderRadius: tokens.radius.pill,
    ...tokens.shadow.floatMd,
  },
  previewActionBar: {
    flexDirection: "row",
    borderRadius: tokens.radius.pill,
    padding: tokens.space[2],
    gap: tokens.space[2],
    overflow: "hidden",
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    backgroundColor: tokens.color.overlay,
  },
  previewActionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: tokens.space[9],
    borderRadius: tokens.radius.pill,
  },
  previewActionButtonDisabled: {
    opacity: 0.55,
  },
});
