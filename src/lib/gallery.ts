import * as MediaLibrary from "expo-media-library";

// 사진 저장(쓰기) 권한만 요청한다.
export async function requestGallerySavePermission(): Promise<boolean> {
  const permission = await MediaLibrary.requestPermissionsAsync(true, [
    "photo",
  ]);
  return permission.granted;
}

export async function saveImageToGallery(
  uri: string,
  albumName?: string,
): Promise<void> {
  if (albumName) {
    // Import directly into the named album so no duplicate default-gallery asset
    // or permission to move an existing asset is needed.
    await MediaLibrary.Album.create(albumName, [uri]);
  } else {
    await MediaLibrary.Asset.create(uri);
  }
}
