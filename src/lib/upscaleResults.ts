import { Directory, File, Paths } from "expo-file-system";
import { storage } from "./storage";
import type { UpscaleQueueItem } from "../store/upscaleQueueStore";

const KEY = "upscale-results-v1";
const directory = () => new Directory(Paths.document, "upscale-results");
function owns(uri: string) {
  // Expo Directory URIs include a trailing slash on Android.
  const prefix = directory().uri.replace(/\/+$/, "") + "/";
  return (
    uri.startsWith(prefix) &&
    /^upscale_[a-zA-Z0-9_]+\.(png|jpg|webp)$/.test(uri.slice(prefix.length))
  );
}

export function retainUpscaleResult(
  uri: string,
  id: string,
  format: string,
): string {
  if (
    !/^upscale_[a-zA-Z0-9_]+$/.test(id) ||
    !["png", "jpg", "webp"].includes(format)
  )
    throw new Error("Invalid upscale result path");
  const root = directory();
  root.create({ intermediates: true, idempotent: true });
  const target = new File(root, id + "." + format);
  new File(uri).move(target);
  return target.uri;
}

export function removeUpscaleResult(uri?: string) {
  if (!uri || !owns(uri)) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    /* Keep the queue usable if a file was already removed. */
  }
}

export function persistUpscaleResults(items: UpscaleQueueItem[]) {
  storage.set(
    KEY,
    JSON.stringify(
      items
        .filter(
          (item) =>
            item.status === "done" && item.result?.uri && owns(item.result.uri),
        )
        .map((item) => ({ ...item, saving: false })),
    ),
  );
}

export function loadUpscaleResults(): UpscaleQueueItem[] {
  try {
    const parsed: unknown = JSON.parse(storage.getString(KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is UpscaleQueueItem => {
        if (
          !item ||
          typeof item.id !== "string" ||
          !/^upscale_[a-zA-Z0-9_]+$/.test(item.id) ||
          item.status !== "done" ||
          typeof item.uri !== "string" ||
          !Number.isFinite(item.width) ||
          item.width <= 0 ||
          !Number.isFinite(item.height) ||
          item.height <= 0
        )
          return false;
        const result = item.result;
        return (
          result &&
          typeof result.uri === "string" &&
          owns(result.uri) &&
          new File(result.uri).exists &&
          [
            "width",
            "height",
            "bytes",
            "elapsedMs",
            "tileSize",
            "cpuThreads",
          ].every(
            (key) =>
              typeof result[key] === "number" && Number.isFinite(result[key]),
          ) &&
          typeof result.usedGpu === "boolean" &&
          [0, 1, 2].includes(result.cpuPolicy) &&
          item.output &&
          ["png", "jpg", "webp"].includes(item.output.format) &&
          typeof item.output.albumName === "string" &&
          typeof item.output.keepOriginalFilename === "boolean"
        );
      })
      .map((item) => ({ ...item, saved: item.saved === true, saving: false }));
  } catch {
    return [];
  }
}

// Remove only files owned by this feature, including leftovers from a crash.
export function pruneUpscaleResults(items: UpscaleQueueItem[]) {
  try {
    const root = directory();
    if (!root.exists) return;
    // A corrupt or newer manifest must not delete recoverable, unsaved files.
    const raw = storage.getString(KEY);
    if (!raw) return;
    const manifest: unknown = JSON.parse(raw);
    if (!Array.isArray(manifest)) return;
    const retained = new Set([
      ...items.map((item) => item.result?.uri),
      ...manifest.map((item) => item?.result?.uri),
    ]);
    for (const file of root.list()) {
      if (file instanceof File && owns(file.uri) && !retained.has(file.uri))
        file.delete();
    }
  } catch {
    /* Retry orphan cleanup next time the app starts. */
  }
}
