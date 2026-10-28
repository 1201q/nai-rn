import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { tokens } from "../../styles/tokens";

export function UpscaleSettingsRow({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <View style={upscalePageStyles.row}>
      <View style={upscalePageStyles.text}>
        <Text style={upscalePageStyles.title}>{title}</Text>
        <Text style={upscalePageStyles.description}>{description}</Text>
      </View>
      {children}
    </View>
  );
}

export const upscalePageStyles = StyleSheet.create({
  option: {
    paddingVertical: 18,
    borderTopWidth: 1,
    borderTopColor: tokens.color.borderSubtle,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 20 },
  text: { flex: 1, minWidth: 0 },
  title: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type.md,
  },
  description: {
    marginTop: 4,
    color: tokens.color.textMuted,
    fontFamily: tokens.font.regular,
    fontSize: tokens.type.xs,
    lineHeight: 19,
  },
  select: { width: 112 },
});
