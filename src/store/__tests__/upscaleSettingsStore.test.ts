import {
  DEFAULT_UPSCALE_SETTINGS,
  normalizeUpscaleSettings,
} from "../../screens/upscale/upscaleOptions";
import type { useUpscaleSettingsStore as Store } from "../upscaleSettingsStore";

let mockSavedJson: string | undefined;
jest.mock("../../lib/storage", () => ({
  storage: {
    getString: () => mockSavedJson,
    set: (_key: string, value: string) => {
      mockSavedJson = value;
    },
  },
}));

function loadStore(): typeof Store {
  let store!: typeof Store;
  jest.isolateModules(() => {
    store = require("../upscaleSettingsStore").useUpscaleSettingsStore;
  });
  return store;
}

beforeEach(() => {
  mockSavedJson = undefined;
});

test("applies consecutive patches without losing a just-committed quality value", () => {
  const store = loadStore();
  store.getState().setSettings({ jpgQuality: 73 });
  store.getState().setSettings({ format: "webp" });
  store.getState().setSettings({ webpQuality: 81 });
  expect(loadStore().getState().settings).toMatchObject({
    format: "webp",
    jpgQuality: 73,
    webpQuality: 81,
  });
});

test("restores all options and separate format qualities after a fresh store load", () => {
  const settings = {
    ...DEFAULT_UPSCALE_SETTINGS,
    model: "realcugan-pro" as const,
    scale: 3,
    noise: 3,
    tileSize: 200,
    format: "webp" as const,
    jpgQuality: 72,
    webpQuality: 81,
    ttaMode: true,
    syncGap: 1 as const,
    limitGpuPerformance: true,
    useGpu: false,
    cpuThreads: 3,
    cpuPolicy: 2 as const,
    keepOriginalFilename: true,
    albumName: "Upscaled Images",
  };
  loadStore().getState().setSettings(settings);
  expect(loadStore().getState().settings).toEqual(settings);
});

test("normalizes saved album names and rejects non-boolean filename preferences", () => {
  expect(
    normalizeUpscaleSettings({
      keepOriginalFilename: "true",
      albumName: "../Photos/Anime",
    }),
  ).toMatchObject({ keepOriginalFilename: false, albumName: "_Photos_Anime" });
  expect(normalizeUpscaleSettings({ albumName: 123 })).toEqual(
    DEFAULT_UPSCALE_SETTINGS,
  );
});

test("normalizes malformed CPU settings and keeps automatic threads", () => {
  expect(
    normalizeUpscaleSettings({
      useGpu: "false",
      cpuThreads: NaN,
      cpuPolicy: 9,
    }),
  ).toEqual(DEFAULT_UPSCALE_SETTINGS);
  expect(
    normalizeUpscaleSettings({ useGpu: false, cpuThreads: -10, cpuPolicy: 1 }),
  ).toMatchObject({ useGpu: false, cpuThreads: 0, cpuPolicy: 1 });
  expect(normalizeUpscaleSettings({ cpuThreads: 3.9 })).toMatchObject({
    cpuThreads: 3,
  });
});

test("keeps the requested tile size when GPU limiting is toggled", () => {
  const store = loadStore();
  store.getState().setSettings({
    ...DEFAULT_UPSCALE_SETTINGS,
    tileSize: 400,
    limitGpuPerformance: true,
  });
  const restored = loadStore();
  expect(restored.getState().settings).toMatchObject({
    tileSize: 400,
    limitGpuPerformance: true,
  });
  restored.getState().setSettings({
    ...restored.getState().settings,
    limitGpuPerformance: false,
  });
  expect(restored.getState().settings.tileSize).toBe(400);
});

test.each(["true", 1, null])(
  "ignores invalid GPU limit value %s",
  (limitGpuPerformance) => {
    expect(normalizeUpscaleSettings({ limitGpuPerformance })).toEqual(
      DEFAULT_UPSCALE_SETTINGS,
    );
  },
);

test.each([null, -1, 4, 1.5, "2"])(
  "rejects invalid sync gap %s and non-boolean TTA",
  (syncGap) => {
    expect(normalizeUpscaleSettings({ syncGap, ttaMode: "true" })).toEqual(
      DEFAULT_UPSCALE_SETTINGS,
    );
  },
);

test("retains advanced preferences when changing to waifu2x and back", () => {
  const store = loadStore();
  store
    .getState()
    .setSettings({ ...DEFAULT_UPSCALE_SETTINGS, ttaMode: true, syncGap: 0 });
  store
    .getState()
    .setSettings({ ...store.getState().settings, model: "waifu2x-cunet" });
  const restored = loadStore();
  restored
    .getState()
    .setSettings({ ...restored.getState().settings, model: "realcugan-se" });
  expect(restored.getState().settings).toMatchObject({
    ttaMode: true,
    syncGap: 0,
  });
});

test.each([
  "{broken",
  "null",
  '"invalid"',
  '{"model":"unknown","scale":"__proto__","format":"gif"}',
])("recovers defaults from invalid saved settings: %s", (saved) => {
  mockSavedJson = saved;
  expect(loadStore().getState().settings).toEqual(DEFAULT_UPSCALE_SETTINGS);
});

test("fills missing quality values without losing older settings", () => {
  mockSavedJson = JSON.stringify({
    model: "waifu2x-cunet",
    scale: 1,
    noise: 2,
    tileSize: 100,
    format: "jpg",
  });
  expect(loadStore().getState().settings).toEqual({
    ...DEFAULT_UPSCALE_SETTINGS,
    model: "waifu2x-cunet",
    scale: 1,
    noise: 2,
    tileSize: 100,
    format: "jpg",
  });
});

test("bounds quality and normalizes unsupported model combinations", () => {
  expect(
    normalizeUpscaleSettings({
      ...DEFAULT_UPSCALE_SETTINGS,
      model: "realcugan-pro",
      scale: 4,
      noise: 2,
      jpgQuality: -10,
      webpQuality: 105,
    }),
  ).toEqual({
    ...DEFAULT_UPSCALE_SETTINGS,
    model: "realcugan-pro",
    jpgQuality: 1,
    webpQuality: 100,
  });
  expect(
    normalizeUpscaleSettings({ jpgQuality: NaN, webpQuality: "80" }),
  ).toEqual(DEFAULT_UPSCALE_SETTINGS);
});
