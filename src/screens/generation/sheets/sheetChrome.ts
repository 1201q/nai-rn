import { StyleSheet } from "react-native";
import { Easing } from "react-native-reanimated";

import { tokens } from "../../../styles/tokens";

// Prompt/Utility 시트와 페이저가 같은 감각으로 움직이도록 공유한다.
export const SHEET_EASING = Easing.bezier(0.32, 0.72, 0, 1);

// 외형 스타일만 공유한다. 시트 인스턴스는 호스트마다 따로 둔다.
export const sheetChromeStyles = StyleSheet.create({
  sheetBackground: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: tokens.color.cardAlt,
    shadowColor: "#000000",
    shadowOpacity: 0.55,
    shadowRadius: 44,
    shadowOffset: { width: 0, height: -18 },
  },
  handleArea: {
    height: 17,
    paddingTop: 9,
    paddingBottom: 3,
  },
  handleIndicator: {
    width: 38,
    height: 5,
    borderRadius: 3,
    backgroundColor: tokens.color.borderSubtleStrong,
  },
  sheetBody: {
    flex: 1,
    bottom: 0,
  },
});
