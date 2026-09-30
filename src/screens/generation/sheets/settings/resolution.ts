import {
  NAI_RESOLUTIONS,
  type NaiResolution,
} from "../../../../constants/generation";

const RESOLUTION_STEP = 64;

export type ResolutionOrientation = "portrait" | "landscape" | "square";

export function resolutionOrientation(
  resolution: Pick<NaiResolution, "width" | "height">,
): ResolutionOrientation {
  if (resolution.width === resolution.height) return "square";
  return resolution.width > resolution.height ? "landscape" : "portrait";
}

export function resolutionPreset(resolution: NaiResolution) {
  const group = NAI_RESOLUTIONS.find((candidate) =>
    candidate.options.some(
      (option) =>
        option.width === resolution.width &&
        option.height === resolution.height,
    ),
  );
  return group?.group ?? "Custom";
}

export function presetResolution(
  preset: string,
  orientation: ResolutionOrientation,
): NaiResolution | undefined {
  const group = NAI_RESOLUTIONS.find((candidate) => candidate.group === preset);
  return group?.options.find(
    (option) => resolutionOrientation(option) === orientation,
  );
}

export function snapResolutionDimension(value: string) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return RESOLUTION_STEP;
  return Math.max(
    RESOLUTION_STEP,
    Math.round(parsed / RESOLUTION_STEP) * RESOLUTION_STEP,
  );
}
