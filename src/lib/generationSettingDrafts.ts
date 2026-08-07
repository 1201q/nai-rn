import { NAI_RESOLUTIONS } from "../constants/generation";
import type { CustomResolution } from "../store/generationStore";

export const MAX_SEED = 4_294_967_295;
export const RESOLUTION_STEP = 64;

export function sanitizeSeedText(value: string) {
  return value.replace(/\D/g, "").slice(0, 10);
}

export function getSeedDraftValue(value: string) {
  const parsed = value === "" ? 0 : Number(value);
  return {
    parsed,
    valid:
      value === "" ||
      (Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= MAX_SEED),
  };
}

export function createRandomSeed(random = Math.random) {
  return Math.floor(random() * (MAX_SEED + 1));
}

export function isDefaultResolution(width: number, height: number) {
  return (
    NAI_RESOLUTIONS.find((group) => group.group === "Normal")?.options.some(
      (item) => item.width === width && item.height === height,
    ) ?? false
  );
}

export function snapResolutionDimension(value: string) {
  if (!value) return "";
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return "";
  return String(
    Math.max(
      RESOLUTION_STEP,
      Math.round(parsed / RESOLUTION_STEP) * RESOLUTION_STEP,
    ),
  );
}

export function customResolutionListSignature(items: CustomResolution[]) {
  return items.map((item) => `${item.id}:${item.width}x${item.height}`).join("|");
}

export function getCustomResolutionDraftState({
  heightText,
  initialSignature,
  items,
  widthText,
}: {
  heightText: string;
  initialSignature: string;
  items: CustomResolution[];
  widthText: string;
}) {
  const width = Number.parseInt(widthText, 10);
  const height = Number.parseInt(heightText, 10);
  const inputsEmpty = widthText === "" && heightText === "";
  const inputsComplete = widthText !== "" && heightText !== "";
  const inputValid =
    inputsComplete &&
    Number.isSafeInteger(width) &&
    Number.isSafeInteger(height) &&
    width >= RESOLUTION_STEP &&
    height >= RESOLUTION_STEP &&
    width % RESOLUTION_STEP === 0 &&
    height % RESOLUTION_STEP === 0;
  const duplicate =
    inputValid &&
    (isDefaultResolution(width, height) ||
      items.some((item) => item.width === width && item.height === height));
  const listDirty = customResolutionListSignature(items) !== initialSignature;
  const dirty = listDirty || !inputsEmpty;

  return {
    canSave:
      dirty &&
      ((inputsEmpty && listDirty) || (inputValid && !duplicate)),
    dirty,
    height,
    inputInvalid: !inputsEmpty && (!inputValid || duplicate),
    inputsEmpty,
    width,
  };
}

export function shouldResetDeletedCustomResolution(
  width: number,
  height: number,
  items: CustomResolution[],
) {
  return (
    !isDefaultResolution(width, height) &&
    !items.some((item) => item.width === width && item.height === height)
  );
}
