import { Ionicons } from "@expo/vector-icons";

export const PROMPT_MIN_HEIGHT = 44;
export const PROMPT_MAX_HEIGHT = 140;

// 옵션 칩 줄: 칩 높이(36) = styles.optionChip.height, 줄↔프롬프트 간격(12) = 키보드 접힘 시 0
export const CHIP_ROW_HEIGHT = 36;
export const CHIP_ROW_GAP = 12;

export type ChipValue = { text: string; unit?: string; unitBefore?: boolean };

export type NumericConfig = {
  title: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  precision: number;
};

export const STEPS_CONFIG: NumericConfig = {
  title: "Steps",
  unit: "steps",
  min: 1,
  max: 50,
  step: 1,
  precision: 0,
};
export const CFG_CONFIG: NumericConfig = {
  title: "CFG Scale",
  unit: "guidance",
  min: 0,
  max: 10,
  step: 0.1,
  precision: 1,
};
export const CFG_RESCALE_CONFIG: NumericConfig = {
  title: "CFG Rescale",
  unit: "rescale",
  min: 0,
  max: 1,
  step: 0.02,
  precision: 2,
};

export const OPTIONS: {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: "model", label: "Model", icon: "layers-outline" },
  { key: "resolution", label: "Resolution", icon: "scan-outline" },
  { key: "seed", label: "Seed", icon: "dice-outline" },
  { key: "steps", label: "Steps", icon: "footsteps-outline" },
  { key: "cfg", label: "CFG Scale", icon: "pulse-outline" },
  { key: "cfgRescale", label: "CFG Rescale", icon: "git-compare-outline" },
  { key: "sampler", label: "Sampler", icon: "shuffle-outline" },
  { key: "schedule", label: "Schedule", icon: "git-branch-outline" },
];
