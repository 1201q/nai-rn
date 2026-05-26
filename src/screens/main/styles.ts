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
    backgroundColor: colors.grey900,
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
  segmentedControl: {
    width: MAIN_SEGMENT_WIDTH,
    height: MAIN_SEGMENT_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
    borderRadius: 999,
    padding: MAIN_SEGMENT_PADDING,
    backgroundColor: colors.grey800,
  },
  segmentIndicator: {
    position: "absolute",
    top: MAIN_SEGMENT_PADDING,
    left: MAIN_SEGMENT_PADDING,
    width: MAIN_SEGMENT_BUTTON_WIDTH,
    height: MAIN_SEGMENT_HEIGHT - MAIN_SEGMENT_PADDING * 2,
    borderRadius: 999,
    backgroundColor: colors.greyOpacity300,
  },
  segmentButton: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    zIndex: 1,
  },
  segmentIconActive: {
    backgroundColor: colors.background,
  },
  createIcon: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "-35deg" }],
  },
  createIconBody: {
    width: 4,
    height: 13,
    borderRadius: 3,
    backgroundColor: colors.grey400,
  },
  createIconTip: {
    width: 4,
    height: 4,
    marginTop: 2,
    borderRadius: 2,
    backgroundColor: colors.grey400,
  },
  historyIcon: {
    width: 18,
    height: 18,
    borderWidth: 2,
    borderColor: colors.grey400,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  historyIconActive: {
    borderColor: colors.background,
  },
  historyIconHourHand: {
    position: "absolute",
    width: 2,
    height: 6,
    borderRadius: 1,
    backgroundColor: colors.grey400,
    transform: [{ translateY: -3 }],
  },
  historyIconMinuteHand: {
    position: "absolute",
    width: 6,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.grey400,
    transform: [{ translateX: 3 }],
  },
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
    backgroundColor: colors.grey900,
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
    backgroundColor: colors.grey800,
  },
  generatedImage: {
    width: "100%",
    height: "100%",
  },
  message: {
    marginHorizontal: 16,
    marginBottom: 10,
    color: colors.red300,
    fontSize: 13,
    lineHeight: 18,
  },
  temporaryTokenBox: {
    marginHorizontal: 16,
    marginBottom: 10,
  },
  temporaryTokenLabel: {
    marginBottom: 6,
    color: colors.grey400,
    fontSize: 12,
    fontWeight: "700",
  },
  temporaryTokenRow: {
    flexDirection: "row",
    gap: 8,
  },
  temporaryTokenInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: colors.greyOpacity500,
    borderRadius: 14,
    paddingHorizontal: 12,
    backgroundColor: colors.grey800,
    color: colors.background,
  },
  temporaryTokenButton: {
    width: 74,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: colors.blue600,
  },
  temporaryTokenButtonText: {
    color: colors.background,
    fontWeight: "800",
  },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 18,
  },
  optionsButton: {
    width: 68,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: colors.grey800,
  },
  optionsIcon: {
    color: colors.purple300,
    fontSize: 12,
    fontWeight: "800",
  },
  generateButton: {
    flex: 1,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: colors.blue500,
  },
  disabledButton: {
    opacity: 0.62,
  },
  generateText: {
    color: colors.background,
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
    backgroundColor: colors.grey800,
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
    color: colors.background,
    fontSize: 16,
    fontWeight: "800",
  },
  historyEmptyText: {
    color: colors.grey400,
    fontSize: 13,
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.94)",
  },
  previewPressArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  previewImage: {
    width: "100%",
    height: "88%",
  },
  previewHint: {
    marginTop: 14,
    color: colors.background,
    fontSize: 14,
    opacity: 0.75,
  },
});
