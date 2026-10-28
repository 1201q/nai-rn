import { useCallback, useRef, useState } from "react";
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
import { SHEET_SELECT_PORTAL_HOST } from "./SheetSelect";
import { usePopoverBackHandler } from "../../native/usePopoverBackHandler";
import { tokens } from "../../styles/tokens";
const NATIVE_RESPONDER_BLOCKER = { blockNativeResponder: true } as const;
const TOOLTIP_WIDTH = 280;
const TOOLTIP_MARGIN = 12;
const TOOLTIP_GAP = 7;
export function HelpButton({
  label,
  description,
  open,
  onToggle,
  portalHostName = SHEET_SELECT_PORTAL_HOST,
}: {
  label: string;
  description: string;
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
        accessibilityLabel={`${label} 설명`}
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
              accessibilityLabel={`${label} 설명 닫기`}
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
              <Text style={styles.settingsHelpTooltipText}>{description}</Text>
            </Reanimated.View>
          </View>
        </Portal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
  pressed: { opacity: tokens.opacity.pressed },
});
