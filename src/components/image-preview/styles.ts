import { StyleSheet } from "react-native";

import { tokens } from "../../styles/tokens";

export const styles = StyleSheet.create({
  previewBackdrop: {
    backgroundColor: "#000000",
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
