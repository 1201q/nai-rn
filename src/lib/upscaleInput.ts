import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";

import { imageUpscaler } from "../../modules/image-upscaler";

export type UpscaleInputImage = {
  uri: string;
  width: number;
  height: number;
  originalFilename?: string | null;
};

export async function pickUpscaleGalleryImages(): Promise<UpscaleInputImage[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error("PHOTO_PERMISSION_DENIED");
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: true,
    quality: 1,
  });
  return picked.canceled
    ? []
    : picked.assets.map(({ uri, width, height, fileName }) => ({
        uri,
        width,
        height,
        originalFilename: fileName ?? null,
      }));
}

export async function pickUpscaleFiles(): Promise<{
  images: UpscaleInputImage[];
  rejected: number;
}> {
  if (!imageUpscaler) throw new Error("UPSCALE_MODULE_UNAVAILABLE");
  const picked = await File.pickFileAsync({
    multipleFiles: true,
    mimeTypes: "image/*",
  });
  if (picked.canceled) return { images: [], rejected: 0 };
  // Decode metadata one file at a time so large selections do not overwhelm
  // content providers. Keep valid images when another selection cannot decode.
  const images: UpscaleInputImage[] = [];
  let rejected = 0;
  for (const file of picked.result) {
    try {
      const info = await imageUpscaler.getInputInfo(file.uri);
      images.push({
        uri: file.uri,
        width: info.width,
        height: info.height,
        originalFilename: info.filename,
      });
    } catch {
      rejected += 1;
    }
  }
  return { images, rejected };
}
