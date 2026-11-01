import { useEffect, useRef, useState } from "react";
import { Keyboard, Platform, StyleSheet, Text, View } from "react-native";
import type { BottomSheetScrollViewMethods } from "@gorhom/bottom-sheet";
import { SheetSelect } from "../../components/forms/SheetSelect";
import { Toggle } from "../../components/forms/FormControls";
import { SteppedSeekbar } from "../../components/forms/SteppedSeekbar";
import { BottomSheetKeyboardAwareScrollView } from "../../components/generation/BottomSheetKeyboardAwareScrollView";
import { useGenerationChromeMetrics } from "../../hooks/useGenerationChromeMetrics";
import type { UpscaleSettings } from "../../store/upscaleQueueStore";
import { tokens } from "../../styles/tokens";
import {
  MODELS,
  noiseOptions,
  scaleOptions,
  UPSCALE_SELECT_PORTAL_HOST,
} from "./upscaleOptions";
import { useGenerationInputCommit } from "../../context/GenerationInputCommitContext";
import { UpscaleHelpButton } from "./UpscaleOptionLabel";

export { UPSCALE_SELECT_PORTAL_HOST } from "./upscaleOptions";

const SETTINGS_ACTION_BAR_HEIGHT = 96;
const SETTINGS_KEYBOARD_GAP = 12;
const SETTINGS_KEYBOARD_SCROLL_MODE =
  Platform.OS === "android" ? "layout" : "insets";
const MODEL_LABELS = MODELS.map((option) => option.label);
type SelectKey = "model";

export function UpscaleSettingsSheetContent({
  active,
  settings,
  disabled,
  onChange,
}: {
  active: boolean;
  settings: UpscaleSettings;
  disabled: boolean;
  onChange: (patch: Partial<UpscaleSettings>) => void;
}) {
  const { commitPendingInput } = useGenerationInputCommit();
  const scrollRef = useRef<BottomSheetScrollViewMethods>(null);
  const { sheetContentPaddingBottom } = useGenerationChromeMetrics();
  const [openSelect, setOpenSelect] = useState<SelectKey | null>(null);
  if (!active && openSelect !== null) setOpenSelect(null);
  useEffect(() => {
    if (!active) {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }
  }, [active]);
  function change(patch: Partial<UpscaleSettings>) {
    if (!disabled) onChange(patch);
  }
  function selectOpenChange(key: SelectKey, next: boolean) {
    if (next) {
      commitPendingInput();
      Keyboard.dismiss();
    }
    setOpenSelect(next ? key : null);
  }
  const modelLabel = MODELS.find(
    (option) => option.value === settings.model,
  )!.label;

  return (
    <BottomSheetKeyboardAwareScrollView
      ref={scrollRef}
      active={active}
      enabled={active && !disabled}
      style={styles.scroll}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingBottom: sheetContentPaddingBottom },
      ]}
      showsVerticalScrollIndicator={false}
      bottomOffset={SETTINGS_ACTION_BAR_HEIGHT + SETTINGS_KEYBOARD_GAP}
      extraKeyboardSpace={SETTINGS_ACTION_BAR_HEIGHT}
      mode={SETTINGS_KEYBOARD_SCROLL_MODE}
      keyboardShouldPersistTaps="handled"
      scrollEnabled={openSelect === null}
    >
      <View
        pointerEvents={active && !disabled ? "auto" : "none"}
        accessibilityElementsHidden={!active}
        importantForAccessibility={active ? "auto" : "no-hide-descendants"}
        style={[styles.fields, disabled && styles.disabled]}
      >
        <SheetSelect
          label="Model"
          value={modelLabel}
          options={MODEL_LABELS}
          onChange={(label) =>
            change({
              model: MODELS.find((option) => option.label === label)!.value,
            })
          }
          open={openSelect === "model"}
          onOpenChange={(next) => selectOpenChange("model", next)}
          portalHostName={UPSCALE_SELECT_PORTAL_HOST}
        />

        <View style={styles.section}>
          <Text style={styles.eyebrow}>UPSCALE SETTINGS</Text>
          <SteppedSeekbar
            label="Scale"
            stops={scaleOptions(settings.model)}
            value={settings.scale}
            onChange={(scale) => change({ scale })}
          />
          <SteppedSeekbar
            label="Denoise"
            stops={noiseOptions(settings.model, settings.scale)}
            value={settings.noise}
            onChange={(noise) => change({ noise })}
          />
        </View>
        <View style={styles.qualityHeader}>
          <View style={styles.labelRow}>
            <Text style={styles.optionTitle}>Use GPU</Text>
            <UpscaleHelpButton
              label="Use GPU"
              active={active && !disabled}
              description="켜면 GPU를 사용하고, GPU가 없으면 CPU로 처리합니다. 끄면 CPU를 사용합니다."
            />
          </View>
          <Toggle
            label="Use GPU"
            value={settings.useGpu}
            disabled={disabled}
            onChange={(useGpu) => change({ useGpu })}
          />
        </View>
        <View style={styles.qualityHeader}>
          <View style={styles.labelRow}>
            <Text style={styles.optionTitle}>자동 저장</Text>
            <UpscaleHelpButton
              label="자동 저장"
              active={active && !disabled}
              description="끄면 결과를 앱에 보관하고 완료 탭에서 직접 갤러리에 저장할 수 있습니다."
            />
          </View>
          <Toggle
            label="자동 저장"
            value={settings.autoSave}
            disabled={disabled}
            onChange={(autoSave) => change({ autoSave })}
          />
        </View>
      </View>
    </BottomSheetKeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  labelRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  optionTitle: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.medium,
    fontSize: 15,
  },
  qualityHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 18, paddingHorizontal: 16 },
  fields: { gap: 24 },
  section: { gap: 18 },
  eyebrow: {
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.semibold,
    fontSize: 12,
    letterSpacing: 0.8,
  },
  disabled: { opacity: 0.5 },
});
