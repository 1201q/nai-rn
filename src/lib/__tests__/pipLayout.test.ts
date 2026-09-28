import { PixelRatio } from "react-native";

import { generationImagePipeline } from "../../../modules/generation-image-pipeline";
import {
  commitPipBack,
  PIP_BACK_RESET_DELAY_MS,
  reportPipSourceRect,
  subscribePipBack,
  updatePipBack,
} from "../pipLayout";

jest.mock("../../../modules/generation-image-pipeline", () => ({
  generationImagePipeline: { setPipSourceRect: jest.fn() },
}));

const setPipSourceRect = jest.mocked(generationImagePipeline!.setPipSourceRect);

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(PixelRatio, "get").mockReturnValue(2);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test("sends the source rect in window pixels", () => {
  reportPipSourceRect({ x: 10, y: 20, width: 100, height: 150 });
  expect(setPipSourceRect).toHaveBeenLastCalledWith(20, 40, 200, 300);
});

test("shrinks the source rect by the back gesture and restores it after PiP", () => {
  const listener = jest.fn();
  const unsubscribe = subscribePipBack(listener);
  reportPipSourceRect({ x: 0, y: 0, width: 100, height: 200 });

  updatePipBack(1);
  commitPipBack();
  // 최소 배율 0.85로 중심 기준 축소.
  expect(setPipSourceRect).toHaveBeenLastCalledWith(15, 30, 170, 340);
  expect(listener).toHaveBeenLastCalledWith(1, "commit");

  jest.advanceTimersByTime(PIP_BACK_RESET_DELAY_MS);
  expect(setPipSourceRect).toHaveBeenLastCalledWith(0, 0, 200, 400);
  unsubscribe();
});
