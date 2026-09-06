import { AppState, Platform } from "react-native";

const SAMPLE_INTERVAL_MS = 100;
const MAX_SAMPLES = 2048;
const MAX_SLOW_EVENTS = 256;
const MAX_IMAGES = 100;
const NOOP = () => {};

type Statistics = {
  count: number;
  total: number;
  max: number;
  over50: number;
  samples: number[];
  randomState: number;
};

type ImageMeasurement = {
  index: number;
  total: number;
  width: number;
  height: number;
  steps: number;
  model: string;
  blurred: boolean;
  i2i: boolean;
  vibeCount: number;
  preciseCount: number;
  startMs: number;
  durationMs?: number;
  outcome?: "success" | "cancelled" | "error";
};

type Session = {
  startedAt: string;
  startedAtUnixMs: number;
  start: number;
  lag: Statistics;
  lagGenerating: Statistics;
  lagIdle: Statistics;
  stages: Map<string, Statistics>;
  counters: Record<string, number>;
  slowEvents: { atMs: number; delayMs: number }[];
  images: ImageMeasurement[];
  image: ImageMeasurement | null;
  timer: ReturnType<typeof setTimeout> | null;
  subscription: { remove(): void } | null;
  appState: string;
  stateRevision: number;
};

function statistics(): Statistics {
  return { count: 0, total: 0, max: 0, over50: 0, samples: [], randomState: 0x6d2b79f5 };
}

function record(stats: Statistics, value: number) {
  stats.count += 1;
  stats.total += value;
  stats.max = Math.max(stats.max, value);
  if (value >= 50) stats.over50 += 1;
  // Bounded reservoir: quantiles cover the whole run, not only its beginning.
  if (stats.samples.length < MAX_SAMPLES) {
    stats.samples.push(value);
  } else {
    // Keep sampling independent of the app's random seed generation.
    stats.randomState ^= stats.randomState << 13;
    stats.randomState ^= stats.randomState >>> 17;
    stats.randomState ^= stats.randomState << 5;
    const index = Math.floor(((stats.randomState >>> 0) / 0x100000000) * stats.count);
    if (index < MAX_SAMPLES) stats.samples[index] = value;
  }
}

function summarize(stats: Statistics) {
  const sorted = [...stats.samples].sort((a, b) => a - b);
  return {
    count: stats.count,
    totalMs: stats.total,
    meanMs: stats.count ? stats.total / stats.count : 0,
    maxMs: stats.max,
    p95Ms: sorted.length ? sorted[Math.ceil(sorted.length * 0.95) - 1] : 0,
    atLeast50Ms: stats.over50,
    quantileSampleCount: sorted.length,
    quantileIsEstimated: stats.count > sorted.length,
  };
}

let active: Session | null = null;
let lastReport: ReturnType<typeof buildReport> | null = null;

function buildReport(session: Session) {
  return {
    schemaVersion: 1,
    startedAt: session.startedAt,
    startedAtUnixMs: session.startedAtUnixMs,
    durationMs: performance.now() - session.start,
    environment: {
      platform: Platform.OS,
      osVersion: Platform.Version,
      deviceModel: Platform.OS === "android" ? Platform.constants.Model : undefined,
      development: __DEV__,
    },
    sampleIntervalMs: SAMPLE_INTERVAL_MS,
    jsLagForeground: summarize(session.lag),
    jsLagGenerating: summarize(session.lagGenerating),
    jsLagIdle: summarize(session.lagIdle),
    stages: Object.fromEntries(
      [...session.stages].map(([name, stats]) => [name, summarize(stats)]),
    ),
    counters: session.counters,
    slowJsEvents: session.slowEvents,
    slowJsEventsTruncated: session.lag.over50 > session.slowEvents.length,
    images: session.images,
    imageLimit: MAX_IMAGES,
    notes: [
      "Stage durations are elapsed time, not JS CPU time; nested stages overlap.",
      "JS lag is sampled timer lateness in the foreground, not frame time or input latency.",
      "Background timer gaps and ticks spanning an app-state change are excluded.",
      "Generation/idle lag excludes ticks spanning an image boundary; foreground lag includes them.",
      "Response sizes are string code units, not network bytes.",
      "An image without an outcome was still running when recording stopped.",
    ],
  };
}

export function isGenerationPerformanceRecording() {
  return active !== null;
}

export function getGenerationPerformanceReport() {
  return lastReport;
}

export function startGenerationPerformance() {
  if (active) return;
  const startedAtUnixMs = Date.now();
  const session: Session = {
    startedAt: new Date(startedAtUnixMs).toISOString(),
    startedAtUnixMs,
    start: performance.now(),
    lag: statistics(),
    lagGenerating: statistics(),
    lagIdle: statistics(),
    stages: new Map(),
    counters: {},
    slowEvents: [],
    images: [],
    image: null,
    timer: null,
    subscription: null,
    appState: AppState.currentState,
    stateRevision: 0,
  };
  active = session;
  lastReport = null;

  function scheduleTick() {
    if (active !== session || session.appState !== "active") return;
    const due = performance.now() + SAMPLE_INTERVAL_MS;
    const image = session.image;
    session.timer = setTimeout(() => {
      if (active !== session || session.appState !== "active") return;
      const now = performance.now();
      const delayMs = Math.max(0, now - due);
      record(session.lag, delayMs);
      if (session.image === image) {
        record(image ? session.lagGenerating : session.lagIdle, delayMs);
      }
      if (delayMs >= 50 && session.slowEvents.length < MAX_SLOW_EVENTS) {
        session.slowEvents.push({ atMs: now - session.start, delayMs });
      }
      scheduleTick();
    }, SAMPLE_INTERVAL_MS);
  }

  session.subscription = AppState.addEventListener("change", (state) => {
    if (session.timer !== null) clearTimeout(session.timer);
    session.appState = state;
    session.stateRevision += 1;
    scheduleTick();
  });
  scheduleTick();
}

export function stopGenerationPerformance() {
  const session = active;
  if (!session) return lastReport;
  active = null;
  if (session.timer !== null) clearTimeout(session.timer);
  session.subscription?.remove();
  lastReport = buildReport(session);
  return lastReport;
}

export function beginGenerationPerformanceImage(
  input: Omit<ImageMeasurement, "startMs" | "durationMs" | "outcome">,
) {
  if (!active) return;
  const image = { ...input, startMs: performance.now() - active.start };
  if (active.images.length < MAX_IMAGES) active.images.push(image);
  else countGenerationPerformance("images.omitted");
  active.image = image;
}

export function endGenerationPerformanceImage(outcome: ImageMeasurement["outcome"]) {
  if (!active?.image) return;
  active.image.durationMs = performance.now() - active.start - active.image.startMs;
  active.image.outcome = outcome;
  active.image = null;
}

export function countGenerationPerformance(name: string, value = 1) {
  if (!active) return;
  active.counters[name] = (active.counters[name] ?? 0) + value;
}

export function beginGenerationPerformanceStage(name: string) {
  const session = active;
  if (!session) return NOOP;
  const start = performance.now();
  const appState = session.appState;
  const stateRevision = session.stateRevision;
  return () => {
    if (active !== session) return;
    const state = session.stateRevision === stateRevision ? appState : "state-changed";
    const key = `${state}/${name}`;
    let stats = session.stages.get(key);
    if (!stats) {
      stats = statistics();
      session.stages.set(key, stats);
    }
    record(stats, performance.now() - start);
  };
}

export function measureGenerationSync<T>(name: string, operation: () => T): T {
  const end = beginGenerationPerformanceStage(name);
  try {
    return operation();
  } finally {
    end();
  }
}

export async function measureGenerationAsync<T>(name: string, operation: () => Promise<T>): Promise<T> {
  const end = beginGenerationPerformanceStage(name);
  try {
    return await operation();
  } finally {
    end();
  }
}
