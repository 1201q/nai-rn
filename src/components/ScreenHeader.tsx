import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { light } from "../screens/home/styles";

// 뒤로가기 원형 버튼 + 가운데 타이틀 + 우측 spacer 헤더.
// CharacterEditScreen·SettingsScreen 공용.
export function ScreenHeader({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  return (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.headerCircleButton}
        activeOpacity={0.78}
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={onBack}
      >
        <Ionicons name="chevron-back" size={22} color={light.textPrimary} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={styles.headerSpacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  // FloatingPillHeader 의 floated pill(solid) 스타일 시각 복제: surface + 그림자.
  headerCircleButton: {
    width: 46,
    height: 46,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: light.surface,
    shadowColor: "#000000",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: light.textPrimary,
  },
  headerSpacer: {
    width: 46,
  },
});
