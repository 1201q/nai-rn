import { useCallback, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Portal } from "@gorhom/portal";
import Reanimated, {
  cancelAnimation,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import {
  usePredictiveBackHandler,
  type PredictiveBackEvent,
} from "../../native/predictiveBack";
import { tokens } from "../../styles/tokens";

const PREDICTIVE_BACK_SCALE_STOP = 0.6;
const PREDICTIVE_BACK_MIN_SCALE = 0.94;
const PREDICTIVE_BACK_CANCEL_SPRING = {
  damping: 30,
  stiffness: 320,
  mass: 0.75,
};
const NATIVE_RESPONDER_BLOCKER = { blockNativeResponder: true } as const;

export const SHEET_SELECT_PORTAL_HOST = "sheet-select-overlay";

export function SheetSelect({
  label,
  accessibilityLabel = label,
  value,
  options,
  onChange,
  variant = "field",
  open: controlledOpen,
  onOpenChange,
  style,
}: {
  label?: string;
  accessibilityLabel?: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  variant?: "field" | "compact";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [anchor, setAnchor] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const triggerRef = useRef<View>(null);
  const { height: windowHeight } = useWindowDimensions();
  const predictiveBackProgress = useSharedValue(0);
  const open = controlledOpen ?? internalOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      if (controlledOpen === undefined) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [controlledOpen, onOpenChange],
  );
  const closeSelect = useCallback(() => setOpen(false), [setOpen]);
  const toggleSelect = useCallback(() => {
    if (open) {
      closeSelect();
      return;
    }

    triggerRef.current?.measureInWindow((x, y, width, height) => {
      cancelAnimation(predictiveBackProgress);
      predictiveBackProgress.value = 0;
      setAnchor({ x, y, width, height });
      setOpen(true);
    });
  }, [closeSelect, open, predictiveBackProgress, setOpen]);
  const selectOption = useCallback(
    (option: string) => {
      onChange(option);
      closeSelect();
    },
    [closeSelect, onChange],
  );
  const trackPredictiveBack = useCallback(
    (event: PredictiveBackEvent) => {
      cancelAnimation(predictiveBackProgress);
      predictiveBackProgress.value = event.progress;
    },
    [predictiveBackProgress],
  );
  const cancelPredictiveBack = useCallback(() => {
    predictiveBackProgress.value = withSpring(
      0,
      PREDICTIVE_BACK_CANCEL_SPRING,
    );
  }, [predictiveBackProgress]);
  const predictiveOptionsStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(
          predictiveBackProgress.value,
          [0, PREDICTIVE_BACK_SCALE_STOP],
          [1, PREDICTIVE_BACK_MIN_SCALE],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  usePredictiveBackHandler(open, {
    onStart: trackPredictiveBack,
    onProgress: trackPredictiveBack,
    onCancel: cancelPredictiveBack,
    onCommit: closeSelect,
  });

  const optionsHeight = options.length * 44 + 2;
  const optionsTop = anchor
    ? Math.max(
        12,
        Math.min(anchor.y + anchor.height + 8, windowHeight - optionsHeight - 12),
      )
    : 0;

  return (
    <View style={[variant === "field" ? styles.field : styles.compactField, style]}>
      {variant === "field" && label ? (
        <Text style={styles.label}>{label}</Text>
      ) : null}
      <Pressable
        ref={triggerRef}
        accessibilityRole="button"
        accessibilityLabel={`${accessibilityLabel ?? value} 선택`}
        accessibilityState={{ expanded: open }}
        onPress={toggleSelect}
        style={({ pressed }) => [
          variant === "field" ? styles.trigger : styles.compactTrigger,
          pressed && styles.pressed,
        ]}
      >
        <Text
          numberOfLines={1}
          style={variant === "field" ? styles.value : styles.compactValue}
        >
          {value}
        </Text>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={variant === "field" ? 18 : 10}
          color={
            variant === "field"
              ? tokens.color.textSecondary
              : tokens.color.textTertiary
          }
        />
      </Pressable>

      {open && anchor ? (
        <Portal hostName={SHEET_SELECT_PORTAL_HOST}>
          <View style={styles.portal}>
            <Pressable
              {...NATIVE_RESPONDER_BLOCKER}
              accessibilityRole="button"
              accessibilityLabel={`${accessibilityLabel ?? value} 선택 닫기`}
              cancelable={false}
              onPress={closeSelect}
              style={styles.portalBackdrop}
            />
            <Reanimated.View
              style={[
                styles.options,
                {
                  top: optionsTop,
                  left: anchor.x,
                  width: Math.max(anchor.width, 148),
                },
                predictiveOptionsStyle,
              ]}
            >
              {options.map((option) => {
                const selected = option === value;

                return (
                  <Pressable
                    key={option}
                    accessibilityRole="button"
                    accessibilityLabel={option}
                    accessibilityState={{ selected }}
                    onPress={() => selectOption(option)}
                    style={({ pressed }) => [
                      styles.option,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        variant === "field" && styles.optionTextField,
                        selected &&
                          (variant === "field"
                            ? styles.optionTextSelectedField
                            : styles.optionTextSelected),
                      ]}
                    >
                      {option}
                    </Text>
                    {selected ? (
                      <Ionicons
                        name="checkmark"
                        size={18}
                        color={tokens.color.accent}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </Reanimated.View>
          </View>
        </Portal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 10,
  },
  compactField: {
    minWidth: 0,
  },
  label: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.medium,
    fontSize: 15,
  },
  trigger: {
    height: 46,
    paddingHorizontal: 14,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: tokens.color.raised,
  },
  compactTrigger: {
    height: 22,
    paddingHorizontal: 6,
    borderRadius: tokens.radius.pill,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: tokens.color.cardAlt,
  },
  value: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.medium,
    fontSize: 15,
  },
  compactValue: {
    flexShrink: 1,
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.regular,
    fontSize: 11,
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
  options: {
    position: "absolute",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: tokens.color.borderSubtleStrong,
    borderRadius: 14,
    backgroundColor: tokens.color.sunken,
    zIndex: 1,
    transformOrigin: "center center",
    ...tokens.shadow.floatMd,
  },
  option: {
    height: 44,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  optionText: {
    flexShrink: 1,
    color: tokens.color.textSecondary,
    fontFamily: tokens.font.medium,
    fontSize: 15,
  },
  optionTextField: {
    fontFamily: tokens.font.regular,
  },
  optionTextSelected: {
    color: tokens.color.accent,
    fontFamily: tokens.font.semibold,
  },
  optionTextSelectedField: {
    color: tokens.color.accent,
    fontFamily: tokens.font.medium,
  },
  pressed: {
    opacity: 0.65,
  },
});
