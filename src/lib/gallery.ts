import * as MediaLibrary from "expo-media-library";

// 사진 저장(쓰기) 권한만 요청한다.
export async function requestGallerySavePermission(): Promise<boolean> {
  const permission = await MediaLibrary.requestPermissionsAsync(true, [
    "photo",
  ]);
  return permission.granted;
}

export async function saveImageToGallery(uri: string): Promise<void> {
  await MediaLibrary.Asset.create(uri);
}
