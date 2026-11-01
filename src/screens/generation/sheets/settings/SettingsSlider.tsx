import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { HelpButton } from "../../../../components/forms/HelpButton";
import { SHEET_SELECT_PORTAL_HOST } from "../../../../components/forms/SheetSelect";
import { SheetSliderControls } from "../../../../components/forms/SheetSliderControls";
import { tokens } from "../../../../styles/tokens";

export type SettingsHelpKey =
  | "effort"
  | "steps"
  | "promptGuidance"
  | "rescale"
  | "variety"
  | "batchCount"
  | "imageFormat";

const SETTINGS_HELP: Record<SettingsHelpKey, string> = {
  effort:
    "Medium은 비용이 적은 대신 Steps 14, Euler Ancestral, UC Preset Heavy로 고정되고 Undesired Content를 쓸 수 없습니다.",
  steps:
    "이미지를 정제하는 반복 횟수입니다. 낮으면 빠르게 구도를 시험할 수 있고, 높으면 시간과 비용이 늘지만 항상 더 좋아지지는 않습니다.",
  promptGuidance:
    "프롬프트를 따르는 강도입니다. 낮으면 더 자유롭고 부드러우며, 높으면 지시와 세부 표현이 강해집니다.",
  rescale:
    "높은 Prompt Guidance에서 색이 지나치게 진하거나 경계가 거칠어질 때 완화합니다.",
  variety:
    "초기 구도 단계의 프롬프트 제약을 줄여 포즈와 배경의 다양성을 높입니다.",
  batchCount:
    "생성 버튼을 한번 누를 때 연속으로 만들 이미지 수입니다. 이미지 1장의 생성이 끝난 후, 바로 다음 생성으로 진입합니다.",
  imageFormat:
    "생성 이미지를 저장할 파일 형식입니다. PNG는 무손실이라 용량이 크고, WebP는 용량이 더 작습니다.",
};

export function SettingsHelpButton({
  helpKey,
  open,
  onToggle,
  portalHostName = SHEET_SELECT_PORTAL_HOST,
}: {
  helpKey: SettingsHelpKey;
  open: boolean;
  onToggle: () => void;
  portalHostName?: string;
}) {
  return (
    <HelpButton
      label={helpKey}
      description={SETTINGS_HELP[helpKey]}
      open={open}
      onToggle={onToggle}
      portalHostName={portalHostName}
    />
  );
}

export function SettingsSlider({
  active = true,
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
}: {
  active?: boolean;
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
}) {
  return (
    <View style={styles.settingsSliderField}>
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
        active={active}
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
  settingsSliderField: {
    gap: 10,
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
    opacity: tokens.opacity.pressed,
  },
});
