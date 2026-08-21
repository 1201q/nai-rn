import { StyleSheet } from "react-native";

import { tokens } from "../../styles/tokens";

export const styles = StyleSheet.create({
  previewBackdrop: {
    backgroundColor: "#000000",
  },
  heroImageFrame: {
    position: "absolute",
    overflow: "hidden",
  },
  previewCloseButton: {
    position: "absolute",
    left: tokens.space[10],
    width: 40,
    height: 40,
    borderRadius: tokens.radius.pill,
    ...tokens.shadow.floatSm,
  },
  previewCloseButtonHeader: {
    left: tokens.space[8],
    width: 40,
    height: 40,
    ...tokens.shadow.floatMd,
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
  previewActionWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 30,
    elevation: 30,
  },
  previewActionShadow: {
    height: 52,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.card,
    ...tokens.shadow.floatMd,
  },
  previewActionBar: {
    height: 52,
    flexDirection: "row",
    borderRadius: tokens.radius.pill,
    padding: tokens.space[2],
    gap: 0,
    overflow: "hidden",
    backgroundColor: tokens.color.card,
  },
  previewActionButton: {
    width: 56,
    height: 44,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
    borderRadius: tokens.radius.pill,
  },
  previewActionButtonDisabled: {
    opacity: 0.55,
  },
  previewActionText: {
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.semibold,
    fontSize: 9,
    lineHeight: 10,
  },
});
