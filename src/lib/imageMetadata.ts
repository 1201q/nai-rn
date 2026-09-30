import { extractPngTextMetadata } from "./pngMetadata";
import { extractStealthMetadata } from "./stealthMetadata";

function hasValue(entries: Record<string, string>) {
  return Object.values(entries).some((value) => value.trim());
}

// PNG 텍스트 청크를 먼저 읽고, 비어 있으면 stealth alpha 메타데이터로 폴백한다.
export function extractImageMetadata(
  bytes: Uint8Array,
): Record<string, string> | null {
  const textMetadata = extractPngTextMetadata(bytes);
  const metadata = hasValue(textMetadata)
    ? textMetadata
    : extractStealthMetadata(bytes);
  return hasValue(metadata) ? metadata : null;
}
