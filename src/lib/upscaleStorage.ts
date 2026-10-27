import { Directory, File, Paths } from "expo-file-system";

import type { UpscaleFormat } from "../../modules/image-upscaler";
import { saveImageToGallery } from "./gallery";
import {
  normalizeUpscaleAlbumName,
  upscaleOutputFilename,
} from "./upscaleFilenames";

let nextExportId = 0;

export async function saveUpscaledImage(
  uri: string,
  options: {
    format: UpscaleFormat;
    originalFilename?: string | null;
    keepOriginalFilename: boolean;
    albumName: string;
  },
): Promise<void> {
  const album = normalizeUpscaleAlbumName(options.albumName).trim();
  const save = (path: string) =>
    album ? saveImageToGallery(path, album) : saveImageToGallery(path);
  const filename = options.keepOriginalFilename
    ? upscaleOutputFilename(options.originalFilename, options.format)
    : null;
  if (!filename) {
    await save(uri);
    return;
  }

  const directory = new Directory(
    Paths.cache,
    `upscale-export-${Date.now()}-${nextExportId++}`,
  );
  directory.create({ intermediates: true, idempotent: true });
  try {
    const file = new File(directory, filename);
    await new File(uri).copy(file);
    await save(file.uri);
  } finally {
    directory.delete();
  }
}
