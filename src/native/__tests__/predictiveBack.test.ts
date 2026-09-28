import { Platform } from "react-native";

const mockNative = {
  progressAvailable: true,
  setMode: jest.fn(),
  addListener: jest.fn(),
};
const listeners: Record<string, () => void> = {};

jest.mock("expo-modules-core", () => ({
  ...jest.requireActual("expo-modules-core"),
  requireOptionalNativeModule: () => mockNative,
}));

// 모듈 로드 시 플랫폼/네이티브 모듈을 읽으므로 mock 준비 후 불러온다.
Platform.OS = "android";
const {
  acquirePredictiveBack,
  releasePredictiveBack,
  setFallbackPredictiveBack,
} = require("../predictiveBack") as typeof import("../predictiveBack");

beforeAll(() => {
  mockNative.addListener.mockImplementation((name: string, listener: () => void) => {
    listeners[name] = listener;
    return { remove: jest.fn() };
  });
});

test("fallback claims back only while no other owner exists", () => {
  const fallback = { onCommit: jest.fn() };
  const owner = { onCommit: jest.fn() };
  const token = {};

  setFallbackPredictiveBack(fallback);
  expect(mockNative.setMode).toHaveBeenLastCalledWith("app");
  listeners.predictiveBackCommit();
  expect(fallback.onCommit).toHaveBeenCalledTimes(1);

  // 시트/화면 owner가 있으면 항상 owner가 먼저 받는다.
  acquirePredictiveBack(token, owner);
  listeners.predictiveBackCommit();
  expect(owner.onCommit).toHaveBeenCalledTimes(1);
  expect(fallback.onCommit).toHaveBeenCalledTimes(1);

  releasePredictiveBack(token);
  expect(mockNative.setMode).toHaveBeenLastCalledWith("app");

  setFallbackPredictiveBack(null);
  expect(mockNative.setMode).toHaveBeenLastCalledWith("system");
});
