jest.mock("expo-file-system", () => ({}));
jest.mock("expo-image-manipulator", () => ({}));
jest.mock("expo-sqlite", () => ({}));
jest.mock("@shopify/react-native-skia", () => ({}));

import { getPreciseReferenceTargetSize } from "../preciseReferences";

describe("precise reference canvas", () => {
  it("picks the canvas with the closest aspect ratio like the official web client", () => {
    expect(getPreciseReferenceTargetSize(832, 1216)).toEqual({ width: 1024, height: 1536 });
    expect(getPreciseReferenceTargetSize(1920, 1080)).toEqual({ width: 1536, height: 1024 });
    expect(getPreciseReferenceTargetSize(1100, 1000)).toEqual({ width: 1472, height: 1472 });
    expect(getPreciseReferenceTargetSize(1000, 1100)).toEqual({ width: 1472, height: 1472 });
  });
});
