import {
  presetResolution,
  resolutionOrientation,
  resolutionPreset,
  snapResolutionDimension,
} from "../resolution";

test.each([
  [832, 1216, "portrait"],
  [1216, 832, "landscape"],
  [1024, 1024, "square"],
] as const)("%ix%i is %s", (width, height, orientation) => {
  expect(resolutionOrientation({ width, height })).toBe(orientation);
});

test.each([
  [832, 1216, "Normal"],
  [1536, 1024, "Large"],
  [1440, 1440, "Wallpaper"],
  [900, 900, "Custom"],
])("preset of %ix%i is %s", (width, height, preset) => {
  expect(resolutionPreset({ label: "", width, height })).toBe(preset);
});

test("finds the preset option matching an orientation", () => {
  expect(presetResolution("Large", "landscape")).toMatchObject({
    width: 1536,
    height: 1024,
  });
  expect(presetResolution("Small", "square")).toMatchObject({
    width: 640,
    height: 640,
  });
  expect(presetResolution("Custom", "portrait")).toBeUndefined();
});

test.each([
  ["1216", 1216],
  ["1000", 1024],
  ["96", 128],
  ["95", 64],
  ["31", 64],
  ["0", 64],
  ["", 64],
  ["abc", 64],
])("snaps %j to %i", (value, expected) => {
  expect(snapResolutionDimension(value)).toBe(expected);
});
