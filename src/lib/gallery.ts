import * as MediaLibrary from "expo-media-library";
import { Directory, File } from "expo-file-system";
import { Platform } from "react-native";

import { useGenerationStore } from "../store/generationStore";

let sessionDirectoryUri: string | null = null;
let saveSequence = 0;

export function getImageSaveDirectoryLabel(uri: string | null): string {
  if (!uri) {
    return Platform.OS === "android"
      ? "내부 저장소/DCIM (기본 위치)"
      : "사진 보관함 (기본 위치)";
  }
  let path: string;
  try {
    path = decodeURIComponent(uri).replace(/\/+$/, "");
  } catch {
    return uri;
  }
  // External-storage document IDs contain the volume and the readable path.
  const tree = path.match(/\/tree\/([^/]+:.*?)(?:\/document\/|$)/)?.[1];
  if (tree) {
    const [volume, ...parts] = tree.split(":");
    const prefix = volume === "primary" ? "" : `${volume}/`;
    return prefix + (parts.join(":") || "내부 저장소");
  }
  return path.replace(/^file:\/\//, "");
}

export async function chooseImageSaveDirectory(): Promise<boolean> {
  const current = useGenerationStore.getState().imageSaveDirectory;
  try {
    const directory = await Directory.pickDirectoryAsync(current ?? undefined);
    useGenerationStore.getState().setImageSaveDirectory(directory.uri);
    sessionDirectoryUri = directory.uri;
    return true;
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (
      code === "ERR_PICKER_CANCELLED" ||
      code === "ERR_FILE_PICKING_CANCELLED"
    ) {
      return false;
    }
    throw error;
  }
}

// 사진 저장(쓰기) 권한만 요청한다.
export async function requestGallerySavePermission(): Promise<boolean> {
  const directory = useGenerationStore.getState().imageSaveDirectory;
  if (directory) {
    // iOS directory access lasts only for this app session. Reopen the picker
    // once before a save operation (including a batch) after restarting the app.
    if (Platform.OS === "ios" && sessionDirectoryUri !== directory) {
      if (!(await chooseImageSaveDirectory())) {
        throw new Error("저장 폴더 선택을 취소했습니다.");
      }
    }
    return true;
  }
  const permission = await MediaLibrary.requestPermissionsAsync(true, [
    "photo",
  ]);
  return permission.granted;
}

export async function saveImageToGallery(uri: string): Promise<void> {
  const directoryUri = useGenerationStore.getState().imageSaveDirectory;
  if (directoryUri) {
    const source = new File(uri);
    const extension = source.extension.toLowerCase();
    const destination = new Directory(directoryUri).createFile(
      `NaiRN-${Date.now()}-${++saveSequence}${extension}`,
      extension === ".webp" ? "image/webp" : "image/png",
    );
    try {
      // Write into the document created by the provider. File.copy(overwrite)
      // deletes an existing SAF document in this Expo version before copying.
      if (Platform.OS === "android") {
        destination.write(await source.bytes());
      } else {
        await source.copy(destination, { overwrite: true });
      }
    } catch (error) {
      // A failed copy must not leave an empty/partial image in the chosen folder.
      try {
        destination.delete();
      } catch {
        // Preserve the original save error if access to the folder was revoked.
      }
      throw error;
    }
    return;
  }
  await MediaLibrary.Asset.create(uri);
}
