import { create } from "zustand";

import { storage } from "../lib/storage";
import { normalizeUpscaleSettings } from "../screens/upscale/upscaleOptions";
import type { UpscaleSettings } from "./upscaleQueueStore";

const STORAGE_KEY = "upscale-settings-v1";

function loadSettings(): UpscaleSettings {
  try {
    const saved = storage.getString(STORAGE_KEY);
    return normalizeUpscaleSettings(saved ? JSON.parse(saved) : undefined);
  } catch {
    return normalizeUpscaleSettings(undefined);
  }
}

export const useUpscaleSettingsStore = create<{
  settings: UpscaleSettings;
  setSettings: (settings: UpscaleSettings) => void;
}>((set) => ({
  settings: loadSettings(),
  setSettings: (input) => {
    const settings = normalizeUpscaleSettings(input);
    storage.set(STORAGE_KEY, JSON.stringify(settings));
    set({ settings });
  },
}));
