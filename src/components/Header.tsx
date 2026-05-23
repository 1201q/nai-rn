import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { colors } from "../styles/colors";

export function Header({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  return (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.iconButton}
        activeOpacity={0.7}
        onPress={onBack}
      >
        <Text style={styles.iconText}>‹</Text>
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
      <TouchableOpacity style={styles.iconButton} activeOpacity={0.7}>
        <Text style={styles.moreText}>•••</Text>
      </TouchableOpacity>
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
  headerTitle: {
    color: colors.background,
    fontSize: 18,
    fontWeight: "700",
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    color: colors.background,
    fontSize: 34,
    lineHeight: 36,
  },
  moreText: {
    color: colors.background,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0,
  },
});
