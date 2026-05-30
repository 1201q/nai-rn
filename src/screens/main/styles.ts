import { Platform, StyleSheet } from "react-native";

import { colors } from "../../styles/colors";

export const MAIN_SEGMENT_WIDTH = 100;
export const MAIN_SEGMENT_HEIGHT = 36;
export const MAIN_SEGMENT_PADDING = 3;
export const MAIN_SEGMENT_BUTTON_WIDTH =
  (MAIN_SEGMENT_WIDTH - MAIN_SEGMENT_PADDING * 2) / 2;

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? 28 : 0,
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
    width: 44,
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
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  generatedImageWrap: {
    width: "100%",
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
    gap: 12,
  },
  imageActionButton: {
    flex: 1,
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    backgroundColor: colors.colorBackgroundInverse,
  },
  imageActionText: {
    color: colors.colorTextInverse,
    fontSize: 16,
    fontWeight: "800",
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
  sheetButton: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    backgroundColor: colors.colorBackgroundSecondary,
  },
  sheetButtonText: {
    color: colors.colorTextInfo,
    fontSize: 15,
    fontWeight: "800",
  },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  optionsButton: {
    width: 68,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: colors.colorBackgroundSecondary,
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
    flex: 1,
    backgroundColor: "#000",
  },
  previewGestureRoot: {
    flex: 1,
  },
  previewCloseButton: {
    position: "absolute",
    top: 48,
    right: 16,
    padding: 10,
  },
  previewCloseText: {
    color: colors.colorTextPrimary,
    fontSize: 20,
    opacity: 0.85,
  },
  sheetContainer: {
    zIndex: 20,
    elevation: 20,
  },
  sheetBackground: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: "#1c1c1c",
  },
  sheetHandle: {
    width: 56,
    height: 5,
    backgroundColor: colors.colorTextTertiary,
  },
  sheetHeader: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  sheetHeaderSide: {
    width: 40,
    height: 40,
  },
  sheetHeaderTitle: {
    flex: 1,
    textAlign: "center",
  },
  sheetTitle: {
    color: colors.colorTextPrimary,
    fontSize: 20,
    fontWeight: "800",
  },
  sheetCloseButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#141414",
  },
  sheetScroll: {
    flex: 1,
  },
  sheetButtonGroup: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 10,
  },
  sheetDetailScrollContent: {
    flexGrow: 1,
  },
  sheetNavButton: {
    minHeight: 52,
    justifyContent: "center",
    borderRadius: 14,
    paddingHorizontal: 16,
    backgroundColor: "#141414",
  },
  sheetNavButtonText: {
    color: colors.colorTextPrimary,
    fontSize: 16,
    fontWeight: "800",
  },
  sheetDetailContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  sheetDetailText: {
    color: colors.colorTextPrimary,
    fontSize: 18,
    fontWeight: "800",
  },
});
