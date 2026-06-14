import { Directory, File, Paths } from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import * as SQLite from "expo-sqlite";
import { ImageFormat, Skia, rect } from "@shopify/react-native-skia";

const DATABASE_NAME = "precise-references.db";
const REFERENCE_ROOT_DIR = "nai-references";
const PRECISE_DIR = "precise";
const ORIGINALS_DIR = "originals";
const THUMBNAILS_DIR = "thumbnails";
const PROCESSED_DIR = "processed";
const THUMBNAIL_SIZE = 360;
const PROCESSED_JPEG_QUALITY = 95;

export const MAX_PRECISE_REFERENCES = 16;
export const DEFAULT_PRECISE_REFERENCE_STRENGTH = 0.6;
export const DEFAULT_PRECISE_REFERENCE_FIDELITY = 0.6;
export const DEFAULT_PRECISE_REFERENCE_TYPE = "character&style";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export type PreciseReferenceType = "character" | "style" | "character&style";

export type PreciseReference = {
  id: string;
  imagePath: string;
  thumbnailPath: string | null;
  processedPath: string;
  enabled: boolean;
  strength: number;
  fidelity: number;
  referenceType: PreciseReferenceType;
  sourceWidth: number;
  sourceHeight: number;
  processedWidth: number;
  processedHeight: number;
  createdAt: number;
  updatedAt: number;
};

export type PreciseReferenceImageInput = {
  uri: string;
  width: number;
  height: number;
  fileName?: string | null;
  mimeType?: string | null;
};

type PreciseReferenceRow = {
  id: string;
  image_path: string;
  thumbnail_path: string | null;
  processed_path: string;
  enabled: number;
  strength: number;
  fidelity: number;
  reference_type: PreciseReferenceType;
  source_width: number;
  source_height: number;
  processed_width: number;
  processed_height: number;
  created_at: number;
  updated_at: number;
};

type PreciseReferenceSettingsPatch = Partial<
  Pick<PreciseReference, "enabled" | "strength" | "fidelity" | "referenceType">
>;

export function getPreciseReferenceTargetSize(width: number, height: number) {
  if (width > height) return { width: 1536, height: 1024 };
  if (width < height) return { width: 1024, height: 1536 };
  return { width: 1472, height: 1472 };
}

export function getContainRect(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
) {
  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return {
    x: (targetWidth - width) / 2,
    y: (targetHeight - height) / 2,
    width,
    height,
  };
}

function getDatabase() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DATABASE_NAME);
  }
  return dbPromise;
}

function createPreciseReferenceId() {
  return `precise_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getReferenceRootDirectory() {
  return new Directory(Paths.document, REFERENCE_ROOT_DIR);
}

function getPreciseDirectory() {
  return new Directory(getReferenceRootDirectory(), PRECISE_DIR);
}

function getOriginalsDirectory() {
  return new Directory(getPreciseDirectory(), ORIGINALS_DIR);
}

function getThumbnailsDirectory() {
  return new Directory(getPreciseDirectory(), THUMBNAILS_DIR);
}

function getProcessedDirectory() {
  return new Directory(getPreciseDirectory(), PROCESSED_DIR);
}

function ensurePreciseDirectories() {
  getReferenceRootDirectory().create({ idempotent: true, intermediates: true });
  getPreciseDirectory().create({ idempotent: true, intermediates: true });
  getOriginalsDirectory().create({ idempotent: true, intermediates: true });
  getThumbnailsDirectory().create({ idempotent: true, intermediates: true });
  getProcessedDirectory().create({ idempotent: true, intermediates: true });
}

function rowToRecord(row: PreciseReferenceRow): PreciseReference {
  return {
    id: row.id,
    imagePath: row.image_path,
    thumbnailPath: row.thumbnail_path,
    processedPath: row.processed_path,
    enabled: row.enabled === 1,
    strength: row.strength,
    fidelity: row.fidelity,
    referenceType: row.reference_type,
    sourceWidth: row.source_width,
    sourceHeight: row.source_height,
    processedWidth: row.processed_width,
    processedHeight: row.processed_height,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function fileFromStoredPath(path: string) {
  const segments = path.split("/");
  let directory = getReferenceRootDirectory();
  for (const segment of segments.slice(0, -1)) {
    directory = new Directory(directory, segment);
  }
  return new File(directory, segments[segments.length - 1]);
}

function getImageExtension(input: PreciseReferenceImageInput) {
  const fileName = input.fileName?.toLowerCase();
  if (fileName?.endsWith(".png")) return "png";
  if (fileName?.endsWith(".webp")) return "webp";
  if (fileName?.endsWith(".jpg") || fileName?.endsWith(".jpeg")) return "jpg";

  if (input.mimeType === "image/png") return "png";
  if (input.mimeType === "image/webp") return "webp";
  return "jpg";
}

async function copyImageToFile(sourceUri: string, destinationFile: File) {
  try {
    const sourceFile = new File(sourceUri);
    sourceFile.copy(destinationFile);
  } catch {
    const sourceFile = new File(sourceUri);
    const base64 = await sourceFile.base64();
    destinationFile.create({ overwrite: true });
    destinationFile.write(base64, { encoding: "base64" });
  }
}

function deleteStoredFile(path: string | null) {
  if (!path) return;

  try {
    const file = fileFromStoredPath(path);
    if (file.exists) file.delete();
  } catch {
    // DB state is the source of truth; missing file cleanup can be ignored.
  }
}

async function createThumbnail(
  sourceUri: string,
  width: number,
  height: number,
  thumbnailFileName: string,
) {
  try {
    const thumbnail = await ImageManipulator.manipulateAsync(
      sourceUri,
      [
        {
          resize:
            width >= height
              ? { width: THUMBNAIL_SIZE }
              : { height: THUMBNAIL_SIZE },
        },
      ],
      {
        compress: 0.82,
        format: ImageManipulator.SaveFormat.JPEG,
      },
    );
    const thumbnailFile = new File(getThumbnailsDirectory(), thumbnailFileName);
    const temporaryThumbnailFile = new File(thumbnail.uri);
    await copyImageToFile(temporaryThumbnailFile.uri, thumbnailFile);
    try {
      temporaryThumbnailFile.delete();
    } catch {
      // The thumbnail has already been copied into app storage.
    }
    return `${PRECISE_DIR}/${THUMBNAILS_DIR}/${thumbnailFileName}`;
  } catch {
    return null;
  }
}

async function createProcessedReferenceImage(
  sourceUri: string,
  sourceWidth: number,
  sourceHeight: number,
  processedFileName: string,
) {
  const sourceFile = new File(sourceUri);
  const sourceBase64 = await sourceFile.base64();
  const data = Skia.Data.fromBase64(sourceBase64);
  const image = Skia.Image.MakeImageFromEncoded(data);
  if (!image) {
    throw new Error("Precise Reference 이미지를 처리하지 못했습니다.");
  }

  const target = getPreciseReferenceTargetSize(sourceWidth, sourceHeight);
  const surface = Skia.Surface.MakeOffscreen(target.width, target.height);
  if (!surface) {
    throw new Error("Precise Reference 이미지를 처리하지 못했습니다.");
  }

  const canvas = surface.getCanvas();
  canvas.clear(Skia.Color("#000000"));
  const destination = getContainRect(
    image.width(),
    image.height(),
    target.width,
    target.height,
  );
  canvas.drawImageRect(
    image,
    rect(0, 0, image.width(), image.height()),
    rect(destination.x, destination.y, destination.width, destination.height),
    Skia.Paint(),
    false,
  );
  surface.flush();

  const snapshot = surface.makeImageSnapshot();
  const processedBase64 = snapshot.encodeToBase64(
    ImageFormat.JPEG,
    PROCESSED_JPEG_QUALITY,
  );
  if (!processedBase64) {
    throw new Error("Precise Reference 이미지를 처리하지 못했습니다.");
  }

  const processedFile = new File(getProcessedDirectory(), processedFileName);
  processedFile.create({ overwrite: true });
  processedFile.write(processedBase64, { encoding: "base64" });

  return {
    path: `${PRECISE_DIR}/${PROCESSED_DIR}/${processedFileName}`,
    width: target.width,
    height: target.height,
  };
}

export async function initPreciseReferenceStorage() {
  ensurePreciseDirectories();
  const db = await getDatabase();
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS precise_references (
      id TEXT PRIMARY KEY,
      image_path TEXT NOT NULL,
      thumbnail_path TEXT,
      processed_path TEXT NOT NULL,
      enabled INTEGER NOT NULL,
      strength REAL NOT NULL,
      fidelity REAL NOT NULL,
      reference_type TEXT NOT NULL,
      source_width INTEGER NOT NULL,
      source_height INTEGER NOT NULL,
      processed_width INTEGER NOT NULL,
      processed_height INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS precise_references_created_at_idx
      ON precise_references (created_at ASC);
  `);
}

export async function listPreciseReferences(): Promise<PreciseReference[]> {
  await initPreciseReferenceStorage();
  const db = await getDatabase();
  const rows = await db.getAllAsync<PreciseReferenceRow>(
    "SELECT * FROM precise_references ORDER BY created_at ASC",
  );
  return rows.map(rowToRecord);
}

export async function addPreciseReferenceFromImage(
  input: PreciseReferenceImageInput,
): Promise<PreciseReference> {
  await initPreciseReferenceStorage();

  const existing = await listPreciseReferences();
  if (existing.length >= MAX_PRECISE_REFERENCES) {
    throw new Error(`Precise Reference limit is ${MAX_PRECISE_REFERENCES}.`);
  }

  const id = createPreciseReferenceId();
  const createdAt = Date.now();
  const extension = getImageExtension(input);
  const imageFileName = `${id}.${extension}`;
  const thumbnailFileName = `${id}.jpg`;
  const processedFileName = `${id}.jpg`;
  const imagePath = `${PRECISE_DIR}/${ORIGINALS_DIR}/${imageFileName}`;
  const imageFile = new File(getOriginalsDirectory(), imageFileName);

  await copyImageToFile(input.uri, imageFile);

  try {
    const thumbnailPath = await createThumbnail(
      input.uri,
      input.width,
      input.height,
      thumbnailFileName,
    );
    const processed = await createProcessedReferenceImage(
      imageFile.uri,
      input.width,
      input.height,
      processedFileName,
    );

    const record: PreciseReference = {
      id,
      imagePath,
      thumbnailPath,
      processedPath: processed.path,
      enabled: true,
      strength: DEFAULT_PRECISE_REFERENCE_STRENGTH,
      fidelity: DEFAULT_PRECISE_REFERENCE_FIDELITY,
      referenceType: DEFAULT_PRECISE_REFERENCE_TYPE,
      sourceWidth: input.width,
      sourceHeight: input.height,
      processedWidth: processed.width,
      processedHeight: processed.height,
      createdAt,
      updatedAt: createdAt,
    };

    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO precise_references (
        id,
        image_path,
        thumbnail_path,
        processed_path,
        enabled,
        strength,
        fidelity,
        reference_type,
        source_width,
        source_height,
        processed_width,
        processed_height,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.imagePath,
        record.thumbnailPath,
        record.processedPath,
        record.enabled ? 1 : 0,
        record.strength,
        record.fidelity,
        record.referenceType,
        record.sourceWidth,
        record.sourceHeight,
        record.processedWidth,
        record.processedHeight,
        record.createdAt,
        record.updatedAt,
      ],
    );

    return record;
  } catch (error: unknown) {
    deleteStoredFile(imagePath);
    deleteStoredFile(`${PRECISE_DIR}/${THUMBNAILS_DIR}/${thumbnailFileName}`);
    deleteStoredFile(`${PRECISE_DIR}/${PROCESSED_DIR}/${processedFileName}`);
    if (error instanceof Error) throw error;
    throw new Error("Precise Reference 이미지를 추가하지 못했습니다.");
  }
}

export async function replacePreciseReferenceImage(
  id: string,
  input: PreciseReferenceImageInput,
): Promise<PreciseReference | null> {
  await initPreciseReferenceStorage();
  const db = await getDatabase();
  const existing = await db.getFirstAsync<PreciseReferenceRow>(
    "SELECT * FROM precise_references WHERE id = ?",
    [id],
  );
  if (!existing) return null;

  const current = rowToRecord(existing);
  const extension = getImageExtension(input);
  const imageFileName = `${id}.${extension}`;
  const thumbnailFileName = `${id}.jpg`;
  const processedFileName = `${id}.jpg`;
  const imagePath = `${PRECISE_DIR}/${ORIGINALS_DIR}/${imageFileName}`;
  const imageFile = new File(getOriginalsDirectory(), imageFileName);
  const updatedAt = Date.now();

  deleteStoredFile(current.imagePath);
  deleteStoredFile(current.thumbnailPath);
  deleteStoredFile(current.processedPath);

  await copyImageToFile(input.uri, imageFile);

  try {
    const thumbnailPath = await createThumbnail(
      input.uri,
      input.width,
      input.height,
      thumbnailFileName,
    );
    const processed = await createProcessedReferenceImage(
      imageFile.uri,
      input.width,
      input.height,
      processedFileName,
    );

    await db.runAsync(
      `UPDATE precise_references
         SET image_path = ?,
             thumbnail_path = ?,
             processed_path = ?,
             source_width = ?,
             source_height = ?,
             processed_width = ?,
             processed_height = ?,
             updated_at = ?
       WHERE id = ?`,
      [
        imagePath,
        thumbnailPath,
        processed.path,
        input.width,
        input.height,
        processed.width,
        processed.height,
        updatedAt,
        id,
      ],
    );

    return {
      ...current,
      imagePath,
      thumbnailPath,
      processedPath: processed.path,
      sourceWidth: input.width,
      sourceHeight: input.height,
      processedWidth: processed.width,
      processedHeight: processed.height,
      updatedAt,
    };
  } catch (error: unknown) {
    deleteStoredFile(imagePath);
    deleteStoredFile(`${PRECISE_DIR}/${THUMBNAILS_DIR}/${thumbnailFileName}`);
    deleteStoredFile(`${PRECISE_DIR}/${PROCESSED_DIR}/${processedFileName}`);
    if (error instanceof Error) throw error;
    throw new Error("Precise Reference 이미지를 교체하지 못했습니다.");
  }
}

export async function updatePreciseReferenceSettings(
  id: string,
  patch: PreciseReferenceSettingsPatch,
): Promise<PreciseReference | null> {
  await initPreciseReferenceStorage();
  const db = await getDatabase();
  const existing = await db.getFirstAsync<PreciseReferenceRow>(
    "SELECT * FROM precise_references WHERE id = ?",
    [id],
  );
  if (!existing) return null;

  const current = rowToRecord(existing);
  const updatedAt = Date.now();
  const next: PreciseReference = {
    ...current,
    ...patch,
    updatedAt,
  };

  await db.runAsync(
    `UPDATE precise_references
       SET enabled = ?,
           strength = ?,
           fidelity = ?,
           reference_type = ?,
           updated_at = ?
     WHERE id = ?`,
    [
      next.enabled ? 1 : 0,
      next.strength,
      next.fidelity,
      next.referenceType,
      next.updatedAt,
      id,
    ],
  );

  return next;
}

export async function deletePreciseReference(id: string) {
  await initPreciseReferenceStorage();
  const db = await getDatabase();
  const existing = await db.getFirstAsync<PreciseReferenceRow>(
    "SELECT * FROM precise_references WHERE id = ?",
    [id],
  );
  if (!existing) return;

  const record = rowToRecord(existing);
  await db.runAsync("DELETE FROM precise_references WHERE id = ?", [id]);

  deleteStoredFile(record.imagePath);
  deleteStoredFile(record.thumbnailPath);
  deleteStoredFile(record.processedPath);
}

export async function readPreciseReferenceProcessedBase64(
  reference: PreciseReference,
): Promise<string> {
  return fileFromStoredPath(reference.processedPath).base64();
}

export function resolvePreciseReferenceImageUri(reference: PreciseReference) {
  return fileFromStoredPath(reference.imagePath).uri;
}

export function resolvePreciseReferenceThumbnailUri(
  reference: PreciseReference,
) {
  if (!reference.thumbnailPath) return null;
  const file = fileFromStoredPath(reference.thumbnailPath);
  return file.exists ? file.uri : null;
}
