import { File } from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";

import type { ManagedDirectory } from "./managedFiles";

export function getImageExtension(input: {
  fileName?: string | null;
  mimeType?: string | null;
}) {
  const fileName = input.fileName?.toLowerCase();
  if (fileName?.endsWith(".png")) return "png";
  if (fileName?.endsWith(".webp")) return "webp";
  if (fileName?.endsWith(".jpg") || fileName?.endsWith(".jpeg")) return "jpg";

  if (input.mimeType === "image/png") return "png";
  if (input.mimeType === "image/webp") return "webp";
  return "jpg";
}

export async function copyImageToFile(
  sourceUri: string,
  destinationFile: File,
) {
  try {
    const sourceFile = new File(sourceUri);
    await sourceFile.copy(destinationFile);
  } catch {
    const sourceFile = new File(sourceUri);
    const base64 = await sourceFile.base64();
    destinationFile.create({ overwrite: true });
    destinationFile.write(base64, { encoding: "base64" });
  }
}

// 긴 변을 size에 맞춘 JPEG 썸네일을 만든다. 실패하면 만들던 파일을 지우고 null을 돌려준다.
export async function createJpegThumbnail(
  files: ManagedDirectory,
  thumbnailPath: string,
  source: { uri: string; width: number; height: number },
  size: number,
): Promise<string | null> {
  try {
    const thumbnail = await ImageManipulator.manipulateAsync(
      source.uri,
      [
        {
          resize:
            source.width >= source.height ? { width: size } : { height: size },
        },
      ],
      {
        compress: 0.82,
        format: ImageManipulator.SaveFormat.JPEG,
      },
    );
    const temporaryThumbnailFile = new File(thumbnail.uri);
    await copyImageToFile(
      temporaryThumbnailFile.uri,
      files.file(thumbnailPath),
    );
    try {
      temporaryThumbnailFile.delete();
    } catch {
      // The thumbnail has already been copied into app storage.
    }
    return thumbnailPath;
  } catch {
    files.remove(thumbnailPath);
    return null;
  }
}
