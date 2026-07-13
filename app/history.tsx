import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { HistoryScreen } from "../src/screens/HistoryScreen";
import { tokens } from "../src/styles/tokens";

export default function HistoryRoute() {
  const router = useRouter();

  return (
    <HistoryScreen
      headerLeft={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="뒤로"
          hitSlop={8}
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.backButtonPressed,
          ]}
        >
          <Ionicons
            name="chevron-back"
            size={22}
            color={tokens.color.textPrimary}
          />
        </Pressable>
      }
    />
  );
}

const styles = StyleSheet.create({
  backButton: {
    width: 46,
    height: 46,
    marginLeft: 16,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.overlay,
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
  },
  backButtonPressed: {
    opacity: 0.7,
  },
});
