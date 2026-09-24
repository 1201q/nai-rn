import { Directory, File, Paths } from "expo-file-system";
import { ImageFormat, Skia, rect } from "@shopify/react-native-skia";

const REFERENCE_ROOT_DIR = "nai-references";
const I2I_DIR = "i2i";

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

function getReferenceRootDirectory() {
  return new Directory(Paths.document, REFERENCE_ROOT_DIR);
}

function getI2IDirectory() {
  return new Directory(getReferenceRootDirectory(), I2I_DIR);
}

function ensureI2IDirectory() {
  getReferenceRootDirectory().create({ idempotent: true, intermediates: true });
  getI2IDirectory().create({ idempotent: true, intermediates: true });
}

function getImageExtension(input: I2IReferenceImageInput) {
  const fileName = input.fileName?.toLowerCase();
  if (fileName?.endsWith(".png")) return "png";
  if (fileName?.endsWith(".webp")) return "webp";
  if (fileName?.endsWith(".jpg") || fileName?.endsWith(".jpeg")) return "jpg";

  if (input.mimeType === "image/png") return "png";
  if (input.mimeType === "image/webp") return "webp";
  return "jpg";
}

function fileFromStoredPath(path: string) {
  const segments = path.split("/");
  let directory = getReferenceRootDirectory();
  for (const segment of segments.slice(0, -1)) {
    directory = new Directory(directory, segment);
  }
  return new File(directory, segments[segments.length - 1]);
}

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

async function copyImageToFile(sourceUri: string, destinationFile: File) {
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

export function resolveStoredI2IReference(
  image: StoredI2IReferenceImage,
): ResolvedI2IReferenceImage | null {
  if (!isManagedI2IPath(image.storagePath)) return null;

  try {
    const file = fileFromStoredPath(image.storagePath);
    if (!file.exists) return null;
    return { ...image, uri: file.uri };
  } catch {
    return null;
  }
}

export function deleteStoredI2IReference(path: string | null | undefined) {
  if (!path || !isManagedI2IPath(path)) return;

  try {
    const file = fileFromStoredPath(path);
    if (file.exists) file.delete();
  } catch {
    // Missing file cleanup does not need to block the UI state update.
  }
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
  ensureI2IDirectory();

  const extension = getImageExtension(input);
  const suffix = Math.random().toString(36).slice(2, 8);
  const fileName = `source_${Date.now()}_${suffix}.${extension}`;
  const storagePath = `${I2I_DIR}/${fileName}`;
  const destination = new File(getI2IDirectory(), fileName);

  await copyImageToFile(input.uri, destination);
  return {
    uri: destination.uri,
    storagePath,
    width: input.width,
    height: input.height,
  };
}
