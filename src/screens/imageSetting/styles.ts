import { StyleSheet } from "react-native";

import { colors } from "../../styles/colors";

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.appBackground,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 32,
    gap: 2,
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
  sheetTitle: {
    paddingHorizontal: 4,
    paddingTop: 8,
    paddingBottom: 12,
    color: colors.colorTextPrimary,
    fontSize: 20,
    fontWeight: "800",
  },
  sheetScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 2,
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
  },
  sheetOptionSubtitle: {
    color: colors.colorTextTertiary,
    fontSize: 13,
  },
  sliderOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 68,
    paddingHorizontal: 4,
  },
  sliderOptionTextGroup: {
    width: 110,
  },
  sliderOptionTrack: {
    flex: 1,
  },
  sheetModelItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 50,
    paddingHorizontal: 6,
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
