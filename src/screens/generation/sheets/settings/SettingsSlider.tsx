import { useCallback, useRef, useState, type ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Portal } from "@gorhom/portal";
import Reanimated from "react-native-reanimated";

import { SHEET_SELECT_PORTAL_HOST } from "../../../../components/forms/SheetSelect";
import { SheetSliderControls } from "../../../../components/forms/SheetSliderControls";
import { usePopoverBackHandler } from "../../../../native/usePopoverBackHandler";
import { tokens } from "../../../../styles/tokens";

export type SettingsHelpKey =
  | "steps"
  | "promptGuidance"
  | "rescale"
  | "variety"
  | "batchCount"
  | "imageFormat";

const NATIVE_RESPONDER_BLOCKER = { blockNativeResponder: true } as const;
const TOOLTIP_WIDTH = 280;
const TOOLTIP_MARGIN = 12;
const TOOLTIP_GAP = 7;

const SETTINGS_HELP: Record<SettingsHelpKey, string> = {
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
  const buttonRef = useRef<View>(null);
  const [anchor, setAnchor] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [tooltipHeight, setTooltipHeight] = useState(0);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const closeHelp = useCallback(() => {
    if (open) onToggle();
  }, [onToggle, open]);
  const { popoverStyle, resetPredictiveBack } = usePopoverBackHandler(
    open,
    closeHelp,
  );
  const toggleHelp = useCallback(() => {
    if (open) {
      onToggle();
      return;
    }

    buttonRef.current?.measureInWindow((x, y, width, height) => {
      resetPredictiveBack();
      setAnchor({ x, y, width, height });
      setTooltipHeight(0);
      onToggle();
    });
  }, [onToggle, open, resetPredictiveBack]);

  const tooltipWidth = Math.min(
    TOOLTIP_WIDTH,
    Math.max(0, windowWidth - TOOLTIP_MARGIN * 2),
  );
  const tooltipLeft = anchor
    ? Math.max(
        TOOLTIP_MARGIN,
        Math.min(anchor.x - 12, windowWidth - tooltipWidth - TOOLTIP_MARGIN),
      )
    : 0;
  const belowTop = anchor ? anchor.y + anchor.height + TOOLTIP_GAP : 0;
  // 아래 공간이 부족하면 버튼 위로 띄운다.
  const tooltipTop =
    anchor && belowTop + tooltipHeight > windowHeight - TOOLTIP_MARGIN
      ? Math.max(TOOLTIP_MARGIN, anchor.y - TOOLTIP_GAP - tooltipHeight)
      : belowTop;

  return (
    <View>
      <Pressable
        ref={buttonRef}
        accessibilityRole="button"
        accessibilityLabel={`${helpKey} 설명`}
        accessibilityState={{ expanded: open }}
        hitSlop={6}
        onPress={toggleHelp}
        style={({ pressed }) => [
          styles.settingsHelpButton,
          pressed && styles.pressed,
        ]}
      >
        <Ionicons name="information" size={12} color={tokens.color.textMuted} />
      </Pressable>
      {open && anchor ? (
        <Portal hostName={portalHostName}>
          <View style={styles.portal}>
            <Pressable
              {...NATIVE_RESPONDER_BLOCKER}
              accessibilityRole="button"
              accessibilityLabel={`${helpKey} 설명 닫기`}
              cancelable={false}
              onPress={closeHelp}
              style={styles.portalBackdrop}
            />
            <Reanimated.View
              onLayout={(event) =>
                setTooltipHeight(event.nativeEvent.layout.height)
              }
              style={[
                styles.settingsHelpTooltip,
                { top: tooltipTop, left: tooltipLeft, width: tooltipWidth },
                popoverStyle,
              ]}
            >
              <Text style={styles.settingsHelpTooltipText}>
                {SETTINGS_HELP[helpKey]}
              </Text>
            </Reanimated.View>
          </View>
        </Portal>
      ) : null}
    </View>
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
  settingsHelpButton: {
    width: 19,
    height: 19,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.raised,
  },
  portal: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 100,
    elevation: 100,
  },
  portalBackdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "transparent",
  },
  settingsHelpTooltip: {
    position: "absolute",
    zIndex: 1,
    paddingHorizontal: 15,
    paddingVertical: 13,
    borderRadius: 16,
    backgroundColor: tokens.color.toast,
    ...tokens.shadow.floatMd,
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
