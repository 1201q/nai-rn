import { StyleSheet } from "react-native";

import { colors } from "../../styles/colors";

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.appBackground,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 26,
    paddingBottom: 28,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 18,
  },
  sectionTitle: {
    color: colors.colorTextPrimary,
    fontSize: 15,
    fontWeight: "800",
  },
  inputLabel: {
    marginBottom: 10,
    color: colors.colorTextSecondary,
    fontSize: 13,
    fontWeight: "700",
  },
  tokenInputRow: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.colorBorderTertiary,
    borderRadius: 12,
    paddingLeft: 14,
    paddingRight: 8,
    backgroundColor: colors.colorBackgroundTertiary,
  },
  tokenInput: {
    flex: 1,
    height: "100%",
    paddingHorizontal: 0,
    paddingVertical: 0,
    color: colors.colorTextPrimary,
    fontSize: 15,
    includeFontPadding: false,
  },
  inputIconButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButton: {
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
    borderRadius: 10,
    backgroundColor: colors.colorBackgroundInverse,
  },
  disabledButton: {
    opacity: 0.62,
  },
  saveButtonText: {
    color: colors.colorTextInverse,
    fontSize: 15,
    fontWeight: "800",
  },
  message: {
    marginTop: 12,
    color: colors.colorTextTertiary,
    fontSize: 13,
    lineHeight: 18,
  },
});
