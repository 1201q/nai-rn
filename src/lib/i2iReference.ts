import { Directory, File, Paths } from "expo-file-system";

const REFERENCE_ROOT_DIR = "nai-references";
const I2I_DIR = "i2i";

export type I2IReferenceImageInput = {
  uri: string;
  width: number;
  height: number;
  fileName?: string | null;
  mimeType?: string | null;
};

export type StoredI2IReferenceImage = {
  storagePath: string;
  width: number;
  height: number;
};

export type ResolvedI2IReferenceImage = StoredI2IReferenceImage & {
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
