import { File } from "expo-file-system";
import { ImageFormat, Skia, rect } from "@shopify/react-native-skia";

import { copyImageToFile, getImageExtension } from "./localData/imageFiles";
import { createManagedDirectory } from "./localData/managedFiles";

const REFERENCE_ROOT_DIR = "nai-references";
const I2I_DIR = "i2i";

const referenceFiles = createManagedDirectory(REFERENCE_ROOT_DIR);

export type I2IReferenceImageInput = {
  uri: string;
  width: number;
  height: number;
  fileName?: string | null;
  mimeType?: string | null;
};

type StoredI2IReferenceImage = {
  storagePath: string;
  width: number;
  height: number;
};

type ResolvedI2IReferenceImage = StoredI2IReferenceImage & {
  uri: string;
};

function isManagedI2IPath(path: string) {
  const segments = path.split("/");
  return (
    segments.length === 2 &&
    segments[0] === I2I_DIR &&
    Boolean(segments[1]) &&
    segments[1] !== "." &&
    segments[1] !== ".."
  );
}

export function resolveStoredI2IReference(
  image: StoredI2IReferenceImage,
): ResolvedI2IReferenceImage | null {
  if (!isManagedI2IPath(image.storagePath)) return null;

  try {
    const file = referenceFiles.file(image.storagePath);
    if (!file.exists) return null;
    return { ...image, uri: file.uri };
  } catch {
    return null;
  }
}

export function deleteStoredI2IReference(path: string | null | undefined) {
  if (!path || !isManagedI2IPath(path)) return;

  referenceFiles.remove(path);
}

// 공식 웹과 동일: 요청 해상도로 늘려 맞추고(stretch) 투명 영역은 흰 배경으로 합친다.
export async function renderI2IRequestImageBase64(
  sourceUri: string,
  width: number,
  height: number,
): Promise<string> {
  const sourceBase64 = await new File(sourceUri).base64();
  const image = Skia.Image.MakeImageFromEncoded(
    Skia.Data.fromBase64(sourceBase64),
  );
  const surface = Skia.Surface.MakeOffscreen(width, height);
  if (!image || !surface) {
    throw new Error("I2I 이미지를 처리하지 못했습니다.");
  }

  const canvas = surface.getCanvas();
  canvas.clear(Skia.Color("#FFFFFF"));
  canvas.drawImageRect(
    image,
    rect(0, 0, image.width(), image.height()),
    rect(0, 0, width, height),
    Skia.Paint(),
    false,
  );
  surface.flush();

  const base64 = surface.makeImageSnapshot().encodeToBase64(ImageFormat.PNG);
  if (!base64) {
    throw new Error("I2I 이미지를 처리하지 못했습니다.");
  }
  return base64;
}

export async function saveI2IReferenceImage(
  input: I2IReferenceImageInput,
): Promise<ResolvedI2IReferenceImage> {
  referenceFiles.ensure(I2I_DIR);

  const extension = getImageExtension(input);
  const suffix = Math.random().toString(36).slice(2, 8);
  const fileName = `source_${Date.now()}_${suffix}.${extension}`;
  const storagePath = `${I2I_DIR}/${fileName}`;
  const destination = referenceFiles.file(storagePath);

  await copyImageToFile(input.uri, destination);
  return {
    uri: destination.uri,
    storagePath,
    width: input.width,
    height: input.height,
  };
}
