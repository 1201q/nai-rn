import * as Haptics from "expo-haptics";

import { NAI_RESOLUTIONS, type NaiResolution } from "../../constants/generation";
import { colors } from "../../styles/colors";

const RESOLUTION_STEP = 64;

export const BADGE_COLORS = [
  colors.green500,
  colors.red500,
  colors.blue500,
  colors.orange500,
  colors.purple500,
  colors.teal500,
];

export function triggerSelectionHaptic() {
  Haptics.selectionAsync().catch(() => {});
}

export function getOptionLabel(
  options: Array<{ label: string; value: string }>,
  value: string,
) {
  return options.find((o) => o.value === value)?.label ?? value;
}

export function formatResolutionValue({
  width,
  height,
}: {
  width: number;
  height: number;
}) {
  const preset = findResolutionPreset(width, height);
  if (preset) {
    const [orientation] = preset.option.label.split(" ");
    return `${preset.group} ${orientation}`;
  }
  return "Custom";
}

export function findResolutionPreset(width: number, height: number) {
  for (const group of NAI_RESOLUTIONS) {
    const option = group.options.find(
      (item) => item.width === width && item.height === height,
    );
    if (option) {
      return { group: group.group, option };
    }
  }
  return null;
}

export function resolveResolution(width: number, height: number): NaiResolution {
  const preset = findResolutionPreset(width, height);
  return preset?.option ?? { label: "Custom Resolution", width, height };
}

export function snapResolutionValue(text: string, fallback: number) {
  const numericText = text.replace(/\D/g, "");
  const parsed = Number.parseInt(numericText, 10);
  const value = Number.isFinite(parsed) ? parsed : fallback;
  return Math.max(
    RESOLUTION_STEP,
    Math.round(value / RESOLUTION_STEP) * RESOLUTION_STEP,
  );
}

export function formatDecimal(value: number, precision = 1) {
  return value.toFixed(precision).replace(/\.?0+$/, "");
}
