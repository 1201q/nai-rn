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
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
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
    gap: 2,
    // backgroundColor: "red",
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
  sheetOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 68,
    paddingHorizontal: 4,
  },
  sheetOptionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#252523",
  },
  sheetOptionTextGroup: {
    flex: 1,
  },
  sheetOptionTitle: {
    color: colors.colorTextPrimary,
    fontSize: 17,
    fontWeight: "600",
    marginBottom: 0,
    // backgroundColor: "red",
  },
  sheetOptionSubtitle: {
    color: colors.colorTextTertiary,
    fontSize: 13,
  },
  sheetModelItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 50,
    paddingHorizontal: 6,
    // backgroundColor: "blue",
  },
  sheetModelItemLabel: {
    color: colors.colorTextSecondary,
    fontSize: 17,
    fontWeight: "600",
  },
  sheetModelItemLabelActive: {
    color: colors.colorTextInfo,
  },
  sheetModelItemLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sheetModelItemBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: colors.colorBackgroundSecondary,
  },
  sheetModelItemBadgeText: {
    color: colors.colorTextTertiary,
    fontSize: 11,
    fontWeight: "700",
  },
  sheetDivider: {
    height: 1,
    backgroundColor: colors.colorBorderTertiary,
    marginVertical: 12,
  },
  sheetSliderExpanded: {
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  sheetSliderHidden: {
    height: 0,
    overflow: "hidden",
  },
  sheetSeedInput: {
    height: 48,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 0,
    backgroundColor: colors.colorBackgroundTertiary,
    color: colors.colorTextPrimary,
    fontSize: 15,
    fontWeight: "700",
    includeFontPadding: false,
  },
  sheetResolutionInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  sheetResolutionInputBox: {
    flex: 1,
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.colorBackgroundTertiary,
  },
  sheetResolutionInputLabel: {
    color: colors.colorTextTertiary,
    fontSize: 13,
    fontWeight: "700",
  },
  sheetResolutionInputDivider: {
    width: 1,
    height: 18,
    marginHorizontal: 10,
    backgroundColor: colors.colorBorderTertiary,
  },
  sheetResolutionInput: {
    flex: 1,
    height: "100%",
    paddingHorizontal: 0,
    paddingVertical: 0,
    backgroundColor: "transparent",
    color: colors.colorTextPrimary,
    fontWeight: "800",
    includeFontPadding: false,
    textAlign: "right",
    textAlignVertical: "center",
  },
  sheetResolutionSwapButton: {
    width: 36,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetResolutionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 56,
    paddingHorizontal: 6,
  },
  sheetResolutionGroupTitle: {
    color: colors.colorTextTertiary,
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: 6,
    paddingBottom: 4,
  },
  sheetResolutionItemTextGroup: {
    gap: 3,
  },
  sheetResolutionItemTitle: {
    color: colors.colorTextPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  sheetResolutionItemSubtitle: {
    color: colors.colorTextTertiary,
    fontSize: 13,
  },
  sheetResolutionItemTitleActive: {
    color: colors.colorTextInfo,
  },
  sheetResolutionItemSubtitleActive: {
    color: colors.colorTextInfo,
  },
});
