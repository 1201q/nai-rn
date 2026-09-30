import {
  DEFAULT_NAI_RESOLUTION,
  findResolutionPreset,
  generateRandomSeed,
  isNoiseSchedule,
  MAX_SEED,
  resolutionFromDimensions,
} from "../generation";

test("resolves known dimensions to the preset", () => {
  const { width, height } = DEFAULT_NAI_RESOLUTION;
  expect(findResolutionPreset(width, height)).toBe(DEFAULT_NAI_RESOLUTION);
  expect(resolutionFromDimensions(width, height)).toBe(DEFAULT_NAI_RESOLUTION);
});

test("labels unknown dimensions as custom", () => {
  expect(findResolutionPreset(1000, 700)).toBeUndefined();
  expect(resolutionFromDimensions(1000, 700)).toEqual({
    label: "Custom 1000x700",
    width: 1000,
    height: 700,
  });
});

test("accepts only known noise schedules", () => {
  for (const value of ["native", "karras", "exponential", "polyexponential"]) {
    expect(isNoiseSchedule(value)).toBe(true);
  }
  expect(isNoiseSchedule("linear")).toBe(false);
  expect(isNoiseSchedule(undefined)).toBe(false);
});

test("generates seeds across the full uint32 range", () => {
  const random = jest.spyOn(Math, "random");
  random.mockReturnValueOnce(0).mockReturnValueOnce(0.9999999999999999);
  expect(generateRandomSeed()).toBe(0);
  expect(generateRandomSeed()).toBe(MAX_SEED);
  random.mockRestore();
});
