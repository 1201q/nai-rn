import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, useWindowDimensions } from "react-native";
import { Toaster } from "sonner-native";

import { tokens } from "../../styles/tokens";

// 앱 전역 토스트 외형. 루트 레이아웃에서 포털 콘텐츠 뒤에 렌더한다.
export function AppToaster() {
  const { width: windowWidth } = useWindowDimensions();
  const toastMaxWidth = Math.min(windowWidth * 0.9, 420);

  return (
    <Toaster
      position="bottom-center"
      theme="dark"
      duration={2000}
      offset={84}
      icons={{
        success: (
          <Ionicons
            name="checkmark-circle"
            size={20}
            color={tokens.color.accent}
          />
        ),
        error: (
          <Ionicons
            name="close-circle-outline"
            size={20}
            color={tokens.color.negative}
          />
        ),
        warning: (
          <Ionicons
            name="warning-outline"
            size={20}
            color={tokens.color.accent}
          />
        ),
        info: (
          <Ionicons
            name="information-circle-outline"
            size={20}
            color={tokens.color.textSecondary}
          />
        ),
        loading: <ActivityIndicator size="small" color={tokens.color.accent} />,
      }}
      toastOptions={{
        toastContainerStyle: {
          width: "auto",
          maxWidth: toastMaxWidth,
          alignSelf: "center",
        },
        style: {
          width: "auto",
          maxWidth: toastMaxWidth,
          marginHorizontal: 0,
          padding: tokens.space[8],
          borderRadius: tokens.radius.pill,
          // borderWidth: 1,
          // borderColor: tokens.color.borderSubtle,
          backgroundColor: tokens.color.toast,
          ...tokens.shadow.floatMd,
        },
        toastContentStyle: {
          gap: tokens.space[6],
        },
        textContainerStyle: {
          flex: 0,
          flexShrink: 1,
        },
        titleStyle: {
          color: tokens.color.textPrimary,
          fontFamily: tokens.font.semibold,
          fontSize: tokens.type.base,
          lineHeight: 20,
        },
        descriptionStyle: {
          color: tokens.color.textSecondary,
          fontFamily: tokens.font.regular,
          fontSize: tokens.type.sm,
          lineHeight: 20,
        },
        actionButtonStyle: {
          paddingHorizontal: tokens.space[7],
          paddingVertical: tokens.space[3],
          borderWidth: 0,
          backgroundColor: tokens.color.accent,
        },
        actionButtonTextStyle: {
          color: tokens.color.onAccent,
          fontFamily: tokens.font.semibold,
          fontSize: tokens.type.sm,
        },
        cancelButtonTextStyle: {
          color: tokens.color.textTertiary,
          fontFamily: tokens.font.semibold,
          fontSize: tokens.type.sm,
        },
        error: {
          borderColor: tokens.color.borderNegative,
        },
      }}
    />
  );
}
