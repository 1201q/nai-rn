export const QUALITY_TAGS_SUFFIX =
  ", very aesthetic, masterpiece, no text";

export type UcPresetIndex = 0 | 1 | 2 | 3 | 4;
export type SelectableUcPresetIndex = 0 | 1 | 3 | 4;

const UC_HEAVY =
  "nsfw, lowres, artistic error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, dithering, halftone, screentone, multiple views, logo, too many watermarks, negative space, blank page";

const UC_PRESETS_V45_FULL: Record<UcPresetIndex, string> = {
  0: UC_HEAVY,
  1: "nsfw, lowres, artistic error, scan artifacts, worst quality, bad quality, jpeg artifacts, multiple views, very displeasing, too many watermarks, negative space, blank page",
  2: "",
  3: `${UC_HEAVY}, @_@, mismatched pupils, glowing eyes, bad anatomy`,
  4: "",
};

export const UC_PRESET_OPTIONS: ReadonlyArray<{
  value: SelectableUcPresetIndex;
  label: string;
}> = [
  { value: 0, label: "Heavy" },
  { value: 1, label: "Light" },
  { value: 3, label: "Human Focus" },
  { value: 4, label: "None" },
];

export function isUcPresetIndex(value: unknown): value is UcPresetIndex {
  return value === 0 || value === 1 || value === 2 || value === 3 || value === 4;
}

export function getUcPresetLabel(value: UcPresetIndex): string {
  return (
    UC_PRESET_OPTIONS.find((option) => option.value === value)?.label ?? "None"
  );
}

export function mergeQualityTags(
  prompt: string,
  qualityToggle: boolean,
): string {
  return qualityToggle ? prompt + QUALITY_TAGS_SUFFIX : prompt;
}

export function mergeUcPreset(
  negativePrompt: string,
  ucPreset: UcPresetIndex,
): string {
  const preset = UC_PRESETS_V45_FULL[ucPreset];
  if (!preset) return negativePrompt;
  return negativePrompt ? `${preset}, ${negativePrompt}` : preset;
}

export function inferUcPreset(
  negativePrompt: string,
): UcPresetIndex | undefined {
  return ([3, 0, 1] as const).find((preset) => {
    const value = UC_PRESETS_V45_FULL[preset];
    return negativePrompt === value || negativePrompt.startsWith(`${value}, `);
  });
}

export function stripQualityTags(prompt: string): string {
  return prompt.endsWith(QUALITY_TAGS_SUFFIX)
    ? prompt.slice(0, -QUALITY_TAGS_SUFFIX.length)
    : prompt;
}

export function stripUcPreset(
  negativePrompt: string,
  ucPreset: UcPresetIndex | undefined,
): string {
  if (ucPreset === undefined) return negativePrompt;
  const preset = UC_PRESETS_V45_FULL[ucPreset];
  if (!preset) return negativePrompt;
  if (negativePrompt === preset) return "";
  return negativePrompt.startsWith(`${preset}, `)
    ? negativePrompt.slice(preset.length + 2)
    : negativePrompt;
}
