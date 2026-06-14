import { Directory, File, Paths } from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import * as SQLite from "expo-sqlite";

const DATABASE_NAME = "vibe-references.db";
const REFERENCE_ROOT_DIR = "nai-references";
const VIBES_DIR = "vibes";
const ORIGINALS_DIR = "originals";
const THUMBNAILS_DIR = "thumbnails";
const ENCODED_DIR = "encoded";
const THUMBNAIL_SIZE = 360;

export const MAX_VIBE_REFERENCES = 16;
export const DEFAULT_VIBE_STRENGTH = 0.6;
export const DEFAULT_VIBE_INFORMATION_EXTRACTED = 0.7;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export type VibeReference = {
  id: string;
  imagePath: string;
  thumbnailPath: string | null;
  encodedPath: string | null;
  enabled: boolean;
  strength: number;
  informationExtracted: number;
  encodedInformationExtracted: number | null;
  createdAt: number;
  updatedAt: number;
};

export type VibeReferenceImageInput = {
  uri: string;
  width: number;
  height: number;
  fileName?: string | null;
  mimeType?: string | null;
};

type VibeReferenceRow = {
  id: string;
  image_path: string;
  thumbnail_path: string | null;
  encoded_path: string | null;
  enabled: number;
  strength: number;
  information_extracted: number;
  encoded_information_extracted: number | null;
  created_at: number;
  updated_at: number;
};

type VibeReferenceSettingsPatch = Partial<
  Pick<VibeReference, "enabled" | "strength" | "informationExtracted">
>;

function getDatabase() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DATABASE_NAME);
  }
  return dbPromise;
}

function createVibeReferenceId() {
  return `vibe_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getReferenceRootDirectory() {
  return new Directory(Paths.document, REFERENCE_ROOT_DIR);
}

function getVibesDirectory() {
  return new Directory(getReferenceRootDirectory(), VIBES_DIR);
}

function getOriginalsDirectory() {
  return new Directory(getVibesDirectory(), ORIGINALS_DIR);
}

function getThumbnailsDirectory() {
  return new Directory(getVibesDirectory(), THUMBNAILS_DIR);
}

function getEncodedDirectory() {
  return new Directory(getVibesDirectory(), ENCODED_DIR);
}

function ensureVibeDirectories() {
  getReferenceRootDirectory().create({ idempotent: true, intermediates: true });
  getVibesDirectory().create({ idempotent: true, intermediates: true });
  getOriginalsDirectory().create({ idempotent: true, intermediates: true });
  getThumbnailsDirectory().create({ idempotent: true, intermediates: true });
  getEncodedDirectory().create({ idempotent: true, intermediates: true });
}

function rowToRecord(row: VibeReferenceRow): VibeReference {
  return {
    id: row.id,
    imagePath: row.image_path,
    thumbnailPath: row.thumbnail_path,
    encodedPath: row.encoded_path,
    enabled: row.enabled === 1,
    strength: row.strength,
    informationExtracted: row.information_extracted,
    encodedInformationExtracted: row.encoded_information_extracted,
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

function getImageExtension(input: VibeReferenceImageInput) {
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
    return `${VIBES_DIR}/${THUMBNAILS_DIR}/${thumbnailFileName}`;
  } catch {
    return null;
  }
}

export async function initVibeReferenceStorage() {
  ensureVibeDirectories();
  const db = await getDatabase();
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS vibe_references (
      id TEXT PRIMARY KEY,
      image_path TEXT NOT NULL,
      thumbnail_path TEXT,
      encoded_path TEXT,
      enabled INTEGER NOT NULL,
      strength REAL NOT NULL,
      information_extracted REAL NOT NULL,
      encoded_information_extracted REAL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS vibe_references_created_at_idx
      ON vibe_references (created_at ASC);
  `);
}

export async function listVibeReferences(): Promise<VibeReference[]> {
  await initVibeReferenceStorage();
  const db = await getDatabase();
  const rows = await db.getAllAsync<VibeReferenceRow>(
    "SELECT * FROM vibe_references ORDER BY created_at ASC",
  );
  return rows.map(rowToRecord);
}

export async function addVibeReferenceFromImage(
  input: VibeReferenceImageInput,
): Promise<VibeReference> {
  await initVibeReferenceStorage();

  const existing = await listVibeReferences();
  if (existing.length >= MAX_VIBE_REFERENCES) {
    throw new Error(`Vibe reference limit is ${MAX_VIBE_REFERENCES}.`);
  }

  const id = createVibeReferenceId();
  const createdAt = Date.now();
  const extension = getImageExtension(input);
  const imageFileName = `${id}.${extension}`;
  const thumbnailFileName = `${id}.jpg`;
  const imagePath = `${VIBES_DIR}/${ORIGINALS_DIR}/${imageFileName}`;
  const imageFile = new File(getOriginalsDirectory(), imageFileName);

  await copyImageToFile(input.uri, imageFile);

  const thumbnailPath = await createThumbnail(
    input.uri,
    input.width,
    input.height,
    thumbnailFileName,
  );

  const record: VibeReference = {
    id,
    imagePath,
    thumbnailPath,
    encodedPath: null,
    enabled: true,
    strength: DEFAULT_VIBE_STRENGTH,
    informationExtracted: DEFAULT_VIBE_INFORMATION_EXTRACTED,
    encodedInformationExtracted: null,
    createdAt,
    updatedAt: createdAt,
  };

  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO vibe_references (
      id,
      image_path,
      thumbnail_path,
      encoded_path,
      enabled,
      strength,
      information_extracted,
      encoded_information_extracted,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      record.imagePath,
      record.thumbnailPath,
      record.encodedPath,
      record.enabled ? 1 : 0,
      record.strength,
      record.informationExtracted,
      record.encodedInformationExtracted,
      record.createdAt,
      record.updatedAt,
    ],
  );

  return record;
}

export async function replaceVibeReferenceImage(
  id: string,
  input: VibeReferenceImageInput,
): Promise<VibeReference | null> {
  await initVibeReferenceStorage();
  const db = await getDatabase();
  const existing = await db.getFirstAsync<VibeReferenceRow>(
    "SELECT * FROM vibe_references WHERE id = ?",
    [id],
  );
  if (!existing) return null;

  const current = rowToRecord(existing);
  const updatedAt = Date.now();
  const replacementSuffix = `${updatedAt}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
  const extension = getImageExtension(input);
  const imageFileName = `${id}_${replacementSuffix}.${extension}`;
  const thumbnailFileName = `${id}_${replacementSuffix}.jpg`;
  const imagePath = `${VIBES_DIR}/${ORIGINALS_DIR}/${imageFileName}`;
  const imageFile = new File(getOriginalsDirectory(), imageFileName);
  const thumbnailPathCandidate = `${VIBES_DIR}/${THUMBNAILS_DIR}/${thumbnailFileName}`;
  let thumbnailPath: string | null = null;

  try {
    await copyImageToFile(input.uri, imageFile);
    thumbnailPath = await createThumbnail(
      input.uri,
      input.width,
      input.height,
      thumbnailFileName,
    );

    await db.runAsync(
      `UPDATE vibe_references
         SET image_path = ?,
             thumbnail_path = ?,
             encoded_path = NULL,
             encoded_information_extracted = NULL,
             updated_at = ?
       WHERE id = ?`,
      [imagePath, thumbnailPath, updatedAt, id],
    );
  } catch (error: unknown) {
    deleteStoredFile(imagePath);
    deleteStoredFile(thumbnailPathCandidate);
    if (error instanceof Error) throw error;
    throw new Error("Vibe 이미지를 교체하지 못했습니다.");
  }

  deleteStoredFile(current.imagePath);
  deleteStoredFile(current.thumbnailPath);
  deleteStoredFile(current.encodedPath);

  return {
    ...current,
    imagePath,
    thumbnailPath,
    encodedPath: null,
    encodedInformationExtracted: null,
    updatedAt,
  };
}

export async function updateVibeReferenceSettings(
  id: string,
  patch: VibeReferenceSettingsPatch,
): Promise<VibeReference | null> {
  await initVibeReferenceStorage();
  const db = await getDatabase();
  const existing = await db.getFirstAsync<VibeReferenceRow>(
    "SELECT * FROM vibe_references WHERE id = ?",
    [id],
  );
  if (!existing) return null;

  const current = rowToRecord(existing);
  const updatedAt = Date.now();
  const nextInformationExtracted =
    patch.informationExtracted ?? current.informationExtracted;
  const shouldClearEncoded =
    patch.informationExtracted !== undefined &&
    patch.informationExtracted !== current.informationExtracted;

  if (shouldClearEncoded) {
    deleteStoredFile(current.encodedPath);
  }

  const next: VibeReference = {
    ...current,
    ...patch,
    informationExtracted: nextInformationExtracted,
    encodedPath: shouldClearEncoded ? null : current.encodedPath,
    encodedInformationExtracted: shouldClearEncoded
      ? null
      : current.encodedInformationExtracted,
    updatedAt,
  };

  await db.runAsync(
    `UPDATE vibe_references
       SET enabled = ?,
           strength = ?,
           information_extracted = ?,
           encoded_path = ?,
           encoded_information_extracted = ?,
           updated_at = ?
     WHERE id = ?`,
    [
      next.enabled ? 1 : 0,
      next.strength,
      next.informationExtracted,
      next.encodedPath,
      next.encodedInformationExtracted,
      next.updatedAt,
      id,
    ],
  );

  return next;
}

export async function deleteVibeReference(id: string) {
  await initVibeReferenceStorage();
  const db = await getDatabase();
  const existing = await db.getFirstAsync<VibeReferenceRow>(
    "SELECT * FROM vibe_references WHERE id = ?",
    [id],
  );
  if (!existing) return;

  const record = rowToRecord(existing);
  await db.runAsync("DELETE FROM vibe_references WHERE id = ?", [id]);

  deleteStoredFile(record.imagePath);
  deleteStoredFile(record.thumbnailPath);
  deleteStoredFile(record.encodedPath);
}

export async function saveEncodedVibeReference(
  id: string,
  encodedBase64: string,
  informationExtracted: number,
): Promise<VibeReference | null> {
  await initVibeReferenceStorage();
  const db = await getDatabase();
  const existing = await db.getFirstAsync<VibeReferenceRow>(
    "SELECT * FROM vibe_references WHERE id = ?",
    [id],
  );
  if (!existing) return null;

  const current = rowToRecord(existing);
  const encodedFileName = `${id}.bin`;
  const encodedPath = `${VIBES_DIR}/${ENCODED_DIR}/${encodedFileName}`;
  const encodedFile = new File(getEncodedDirectory(), encodedFileName);
  encodedFile.create({ overwrite: true });
  encodedFile.write(encodedBase64, { encoding: "base64" });

  const updatedAt = Date.now();
  await db.runAsync(
    `UPDATE vibe_references
       SET encoded_path = ?,
           encoded_information_extracted = ?,
           updated_at = ?
     WHERE id = ?`,
    [encodedPath, informationExtracted, updatedAt, id],
  );

  return {
    ...current,
    encodedPath,
    encodedInformationExtracted: informationExtracted,
    updatedAt,
  };
}

export async function readVibeReferenceImageBase64(
  reference: VibeReference,
): Promise<string> {
  return fileFromStoredPath(reference.imagePath).base64();
}

export async function readEncodedVibeReferenceBase64(
  reference: VibeReference,
): Promise<string> {
  if (!reference.encodedPath) {
    throw new Error("Vibe reference is not encoded.");
  }
  return fileFromStoredPath(reference.encodedPath).base64();
}

export function resolveVibeReferenceImageUri(reference: VibeReference) {
  return fileFromStoredPath(reference.imagePath).uri;
}

export function resolveVibeReferenceThumbnailUri(reference: VibeReference) {
  if (!reference.thumbnailPath) return null;
  const file = fileFromStoredPath(reference.thumbnailPath);
  return file.exists ? file.uri : null;
}
