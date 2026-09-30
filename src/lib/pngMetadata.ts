function readUInt32BE(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] * 0x1000000 +
    ((bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3])
  );
}

function decodeBytes(bytes: Uint8Array): string {
  if (typeof TextDecoder !== "undefined") {
    return new TextDecoder("utf-8").decode(bytes);
  }

  let text = "";
  for (let index = 0; index < bytes.length; index += 1) {
    text += String.fromCharCode(bytes[index]);
  }
  return text;
}

function decodeAscii(bytes: Uint8Array): string {
  let text = "";
  for (let index = 0; index < bytes.length; index += 1) {
    text += String.fromCharCode(bytes[index]);
  }
  return text;
}

function findNullByte(bytes: Uint8Array, start = 0): number {
  for (let index = start; index < bytes.length; index += 1) {
    if (bytes[index] === 0) {
      return index;
    }
  }
  return -1;
}

function addMetadataEntry(
  metadata: Record<string, string>,
  key: string,
  value: string,
) {
  if (!metadata[key]) {
    metadata[key] = value;
    return;
  }

  let duplicateIndex = 2;
  while (metadata[`${key}#${duplicateIndex}`]) {
    duplicateIndex += 1;
  }
  metadata[`${key}#${duplicateIndex}`] = value;
}

export function extractPngTextMetadata(
  bytes: Uint8Array,
): Record<string, string> {
  const metadata: Record<string, string> = {};
  const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];

  if (!pngSignature.every((value, index) => bytes[index] === value)) {
    return metadata;
  }

  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = readUInt32BE(bytes, offset);
    const type = decodeAscii(bytes.subarray(offset + 4, offset + 8));
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;

    if (dataEnd + 4 > bytes.length) {
      break;
    }

    const data = bytes.subarray(dataStart, dataEnd);

    if (type === "tEXt") {
      const separatorIndex = findNullByte(data);
      if (separatorIndex > 0) {
        const key = decodeBytes(data.subarray(0, separatorIndex));
        const value = decodeBytes(data.subarray(separatorIndex + 1));
        addMetadataEntry(metadata, key, value);
      }
    }

    if (type === "iTXt") {
      const keywordEnd = findNullByte(data);
      if (keywordEnd > 0 && data[keywordEnd + 1] === 0) {
        const languageEnd = findNullByte(data, keywordEnd + 3);
        const translatedKeywordEnd = findNullByte(data, languageEnd + 1);

        if (languageEnd !== -1 && translatedKeywordEnd !== -1) {
          const key = decodeBytes(data.subarray(0, keywordEnd));
          const value = decodeBytes(data.subarray(translatedKeywordEnd + 1));
          addMetadataEntry(metadata, key, value);
        }
      }
    }

    offset = dataEnd + 4;
  }

  return metadata;
}
