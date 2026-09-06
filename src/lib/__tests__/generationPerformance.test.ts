import { AppState } from "react-native";
import { generationTrace } from "../generationTrace";

jest.mock("../generationTrace", () => ({
  generationTrace: {
    anchor: jest.fn(() => ({ beforeBootMs: 1000, afterBootMs: 1001, enabled: true })),
    beginSection: jest.fn(() => true),
    endSection: jest.fn(),
  },
}));
import {
  beginGenerationPerformanceImage,
  beginGenerationPerformanceStage,
  countGenerationPerformance,
  endGenerationPerformanceImage,
  getGenerationPerformanceReport,
  isGenerationPerformanceRecording,
  measureGenerationAsync,
  measureGenerationSync,
  startGenerationPerformance,
  stopGenerationPerformance,
} from "../generationPerformance";

let now = 0;
let changeState: (state: string) => void;
const removeSubscription = jest.fn();
const initialAppState = AppState.currentState;
const image = {
  index: 1, total: 1, width: 1024, height: 1024, steps: 28,
  model: "test-model", blurred: false, i2i: false, vibeCount: 0, preciseCount: 0,
};

beforeEach(() => {
  jest.useFakeTimers();
  now = 0;
  jest.spyOn(performance, "now").mockImplementation(() => now);
  removeSubscription.mockClear();
  jest.clearAllMocks();
  AppState.currentState = "active";
  jest.spyOn(AppState, "addEventListener").mockImplementation((_event, listener) => {
    changeState = listener as (state: string) => void;
    return { remove: removeSubscription };
  });
});

afterEach(() => {
  stopGenerationPerformance();
  jest.restoreAllMocks();
  jest.useRealTimers();
  AppState.currentState = initialAppState;
});

test("does not schedule sampling until explicitly started and cleans up on stop", () => {
  expect(isGenerationPerformanceRecording()).toBe(false);
  expect(measureGenerationSync("disabled", () => 42)).toBe(42);
  expect(jest.getTimerCount()).toBe(0);
  startGenerationPerformance();
  startGenerationPerformance();
  expect(jest.getTimerCount()).toBe(1);
  now = 175;
  jest.advanceTimersByTime(100);
  const report = stopGenerationPerformance()!;
  expect(report.jsLagForeground).toMatchObject({ count: 1, maxMs: 75, p95Ms: 75, atLeast50Ms: 1 });
  expect(report.slowJsEvents).toEqual([{ atMs: 175, delayMs: 75 }]);
  expect(jest.getTimerCount()).toBe(0);
  expect(removeSubscription).toHaveBeenCalledTimes(1);
  expect(getGenerationPerformanceReport()).toBe(report);
});

test("excludes background gaps and resets the timer deadline on returning", () => {
  startGenerationPerformance();
  now = 50;
  changeState("background");
  now = 10050;
  jest.advanceTimersByTime(10000);
  expect(jest.getTimerCount()).toBe(0);
  changeState("active");
  now = 10150;
  jest.advanceTimersByTime(100);
  expect(stopGenerationPerformance()!.jsLagForeground).toMatchObject({ count: 1, maxMs: 0 });
});

test("separates idle and generation samples without assigning a boundary tick", () => {
  startGenerationPerformance();
  now = 100;
  jest.advanceTimersByTime(100);
  beginGenerationPerformanceImage(image);
  now = 200;
  jest.advanceTimersByTime(100);
  now = 380;
  jest.advanceTimersByTime(100);
  endGenerationPerformanceImage("success");
  const report = stopGenerationPerformance()!;
  expect(report.jsLagForeground.count).toBe(3);
  expect(report.jsLagIdle.count).toBe(1);
  expect(report.jsLagGenerating).toMatchObject({ count: 1, maxMs: 80 });
  expect(report.images[0]).toMatchObject({ durationMs: 280, outcome: "success" });
});

test("preserves values and errors, and labels spans crossing app-state transitions", async () => {
  startGenerationPerformance();
  const error = new Error("operation failed");
  expect(() => measureGenerationSync("sync", () => { now = 25; throw error; })).toThrow(error);
  await expect(measureGenerationAsync("async", async () => { now = 60; throw error; })).rejects.toBe(error);
  const end = beginGenerationPerformanceStage("crossing");
  changeState("background");
  changeState("active");
  now = 90;
  end();
  expect(await measureGenerationAsync("value", async () => 42)).toBe(42);
  const report = stopGenerationPerformance()!;
  expect(report.stages["active/sync"].maxMs).toBe(25);
  expect(report.stages["active/async"].maxMs).toBe(35);
  expect(report.stages["state-changed/crossing"].maxMs).toBe(30);
});

test("ignores old spans after a new recording and resets counters", () => {
  startGenerationPerformance();
  const finishOld = beginGenerationPerformanceStage("old");
  countGenerationPerformance("stream.response_chars", 500);
  stopGenerationPerformance();
  startGenerationPerformance();
  now = 100;
  finishOld();
  const report = stopGenerationPerformance()!;
  expect(report.stages).toEqual({});
  expect(report.counters).toEqual({});
});

test("bounds samples and slow events while retaining total counts and maximum", () => {
  startGenerationPerformance();
  const random = jest.spyOn(Math, "random");
  for (let i = 0; i < 2200; i++) {
    now += 160;
    jest.advanceTimersByTime(100);
  }
  const report = stopGenerationPerformance()!;
  expect(report.jsLagForeground).toMatchObject({
    count: 2200, maxMs: 60, p95Ms: 60, atLeast50Ms: 2200,
    quantileSampleCount: 2048, quantileIsEstimated: true,
  });
  expect(report.slowJsEvents).toHaveLength(256);
  expect(report.slowJsEventsTruncated).toBe(true);
  expect(random).not.toHaveBeenCalled();
});

test("records nested timeline starts, image identity and unfinished work without late mutation", () => {
  startGenerationPerformance();
  beginGenerationPerformanceImage(image);
  now = 10;
  const endRequest = beginGenerationPerformanceStage("request.elapsed");
  now = 20;
  measureGenerationSync("stream.parse_dispatch", () => {
    now = 25;
    measureGenerationSync("stream.json_parse", () => { now = 30; });
    now = 40;
  });
  now = 45;
  const report = stopGenerationPerformance()!;
  now = 60;
  endRequest();
  expect(report.timeline).toEqual([
    { name: "request.elapsed", startMs: 10, imageIndex: 1, appState: "active" },
    { name: "stream.parse_dispatch", startMs: 20, endMs: 40, imageIndex: 1, appState: "active" },
    { name: "stream.json_parse", startMs: 25, endMs: 30, imageIndex: 1, appState: "active" },
  ]);
  expect(report.traceAnchor).toMatchObject({ beforeBootMs: 1000, afterBootMs: 1001, enabled: true });
});

test("balances synchronous native sections on errors and never spans async waits", async () => {
  measureGenerationSync("save.metadata", () => 1);
  expect(generationTrace!.beginSection).not.toHaveBeenCalled();
  startGenerationPerformance();
  expect(() => measureGenerationSync("save.metadata", () => { throw new Error("test"); })).toThrow("test");
  await measureGenerationAsync("save.thumbnail", async () => { now = 50; });
  expect(generationTrace!.beginSection).toHaveBeenCalledTimes(1);
  expect(generationTrace!.endSection).toHaveBeenCalledTimes(1);
  expect(stopGenerationPerformance()!.timeline).toHaveLength(2);
});

test("bounds the timeline without losing aggregate stage counts", () => {
  startGenerationPerformance();
  for (let index = 0; index < 8200; index++) {
    measureGenerationSync("stream.parse_dispatch", () => { now += 1; });
  }
  measureGenerationSync("stream.read_chunk", () => { now += 1; });
  const report = stopGenerationPerformance()!;
  expect(report.timeline).toHaveLength(8192);
  expect(report.timelineEventsOmitted).toBe(8);
  expect(report.stages["active/stream.parse_dispatch"].count).toBe(8200);
});

test("keeps starting image identity and app-state transition on an async interval", async () => {
  startGenerationPerformance();
  beginGenerationPerformanceImage(image);
  await measureGenerationAsync("save.thumbnail", async () => {
    now = 10;
    endGenerationPerformanceImage("success");
    beginGenerationPerformanceImage({ ...image, index: 2 });
    changeState("background");
    now = 30;
  });
  expect(stopGenerationPerformance()!.timeline[0]).toMatchObject({
    imageIndex: 1, startMs: 0, endMs: 30, appState: "state-changed",
  });
});
