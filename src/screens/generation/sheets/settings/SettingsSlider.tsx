import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { SheetSliderControls } from "../../../../components/forms/SheetSliderControls";
import { tokens } from "../../../../styles/tokens";

export type SettingsHelpKey =
  | "steps"
  | "promptGuidance"
  | "rescale"
  | "variety";

const SETTINGS_HELP: Record<SettingsHelpKey, string> = {
  steps:
    "이미지를 정제하는 반복 횟수입니다. 낮으면 빠르게 구도를 시험할 수 있고, 높으면 시간과 비용이 늘지만 항상 더 좋아지지는 않습니다.",
  promptGuidance:
    "프롬프트를 따르는 강도입니다. 낮으면 더 자유롭고 부드러우며, 높으면 지시와 세부 표현이 강해집니다.",
  rescale:
    "높은 Prompt Guidance에서 색이 지나치게 진하거나 경계가 거칠어질 때 완화합니다.",
  variety:
    "초기 구도 단계의 프롬프트 제약을 줄여 포즈와 배경의 다양성을 높입니다.",
};

export function SettingsHelpButton({
  helpKey,
  open,
  alignRight = false,
  onToggle,
}: {
  helpKey: SettingsHelpKey;
  open: boolean;
  alignRight?: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.settingsHelpAnchor}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${helpKey} 설명`}
        accessibilityState={{ expanded: open }}
        hitSlop={6}
        onPress={onToggle}
        style={({ pressed }) => [
          styles.settingsHelpButton,
          open && styles.settingsHelpButtonOpen,
          pressed && styles.pressed,
        ]}
      >
        <Ionicons
          name="information"
          size={12}
          color={open ? tokens.color.onAccent : tokens.color.textMuted}
        />
      </Pressable>
      {open ? (
        <View
          style={[
            styles.settingsHelpTooltip,
            alignRight && styles.settingsHelpTooltipRight,
          ]}
        >
          <Text style={styles.settingsHelpTooltipText}>
            {SETTINGS_HELP[helpKey]}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export function SettingsSlider({
  label,
  helpKey,
  helpOpen,
  value,
  min,
  max,
  step,
  precision,
  onHelpToggle,
  onChange,
  trailing,
  overlayOpen = false,
}: {
  label: string;
  helpKey: SettingsHelpKey;
  helpOpen: boolean;
  value: number;
  min: number;
  max: number;
  step: number;
  precision: number;
  onHelpToggle: () => void;
  onChange: (value: number) => void;
  trailing?: ReactNode;
  overlayOpen?: boolean;
}) {

  return (
    <View
      style={[
        styles.settingsSliderField,
        (helpOpen || overlayOpen) && styles.settingsSliderFieldOverlayOpen,
      ]}
    >
      <View style={styles.settingsSliderHeader}>
        <View style={styles.settingsFieldLabelRow}>
          <Text style={styles.settingsFieldLabel}>{label}</Text>
          <SettingsHelpButton
            helpKey={helpKey}
            open={helpOpen}
            onToggle={onHelpToggle}
          />
        </View>
        {trailing}
      </View>
      <SheetSliderControls
        label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        precision={precision}
        onChange={onChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  settingsFieldLabel: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.medium,
    fontSize: 15,
  },
  settingsFieldLabelRow: {
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  settingsHelpAnchor: {
    position: "relative",
    zIndex: 30,
  },
  settingsHelpButton: {
    width: 19,
    height: 19,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.raised,
  },
  settingsHelpButtonOpen: {
    backgroundColor: tokens.color.accent,
  },
  settingsHelpTooltip: {
    position: "absolute",
    top: 26,
    left: -12,
    width: 280,
    zIndex: 30,
    paddingHorizontal: 15,
    paddingVertical: 13,
    borderRadius: 16,
    backgroundColor: tokens.color.toast,
    ...tokens.shadow.floatMd,
  },
  settingsHelpTooltipRight: {
    right: -54,
    left: undefined,
  },
  settingsHelpTooltipText: {
    color: tokens.color.textSecondary,
    fontFamily: tokens.font.regular,
    fontSize: 13,
    lineHeight: 19,
  },
  settingsSliderField: {
    gap: 10,
  },
  settingsSliderFieldOverlayOpen: {
    zIndex: 30,
  },
  settingsSliderHeader: {
    minHeight: 19,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    zIndex: 3,
  },
  pressed: {
    opacity: 0.65,
  },
});
