import type { UpscaleFormat } from "../../modules/image-upscaler";

function safeName(value: string): string {
  return Array.from(value)
    .filter(
      (character) =>
        character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127,
    )
    .join("")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/^\s*\.+/, "");
}

export function normalizeUpscaleAlbumName(value: unknown): string {
  return typeof value === "string" ? safeName(value).slice(0, 80) : "";
}

export function upscaleOutputFilename(
  original: string | null | undefined,
  format: UpscaleFormat,
): string | null {
  if (!original) return null;
  const leaf = original.split(/[\\/]/).pop() ?? "";
  const dot = leaf.lastIndexOf(".");
  const stem = dot > 0 ? leaf.slice(0, dot) : leaf;
  const safe = safeName(stem).trim().replace(/\.+$/, "");
  // Preserve long names while leaving room for the output extension within
  // common filesystem limits. Count UTF-8 bytes rather than UTF-16 code units.
  let bytes = 0;
  let name = "";
  for (const character of safe) {
    const code = character.codePointAt(0)!;
    const length =
      code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
    if (bytes + length > 240) break;
    bytes += length;
    name += character;
  }
  return name ? `${name}.${format}` : null;
}
