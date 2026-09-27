import { Directory, File, Paths } from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import * as SQLite from "expo-sqlite";

import { createInitializeOnce } from "./initializeOnce";
import { createKeyedMutationQueue } from "./referenceMutation";

const DATABASE_NAME = "vibe-references.db";
const REFERENCE_ROOT_DIR = "nai-references";
const VIBES_DIR = "vibes";
const ORIGINALS_DIR = "originals";
const THUMBNAILS_DIR = "thumbnails";
const ENCODED_DIR = "encoded";
const THUMBNAIL_SIZE = 360;

export const MAX_VIBE_REFERENCES = 16;
const DEFAULT_VIBE_STRENGTH = 0.6;
const DEFAULT_VIBE_INFORMATION_EXTRACTED = 0.7;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
const settingsMutationQueue = createKeyedMutationQueue();

export type VibeEncoding = {
  model: string;
  informationExtracted: number;
  path: string;
};

export type VibeReference = {
  id: string;
  imagePath: string;
  thumbnailPath: string | null;
  enabled: boolean;
  strength: number;
  informationExtracted: number;
  // 모델별 인코딩 캐시 (reference당 모델 하나에 하나).
  encodings: VibeEncoding[];
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

// encoded_model 컬럼 추가 이전의 캐시는 모두 V4.5 Full로 인코딩됐다.
const LEGACY_ENCODED_MODEL = "nai-diffusion-4-5-full";

// Vibe 인코딩은 모델마다 다르다 (공식 웹도 모델별로 인코딩/캐시).
function findCachedVibeEncoding(reference: VibeReference, model: string) {
  return reference.encodings.find(
    (encoding) =>
      encoding.model === model &&
      encoding.informationExtracted === reference.informationExtracted,
  );
}

export function canUseCachedVibeEncoding(
  reference: VibeReference,
  model: string,
) {
  return findCachedVibeEncoding(reference, model) !== undefined;
}

// vibe_references의 encoded_* 컬럼은 레거시(단일 캐시)로, 마이그레이션 후 항상 NULL이다.
type VibeReferenceRow = {
  id: string;
  image_path: string;
  thumbnail_path: string | null;
  enabled: number;
  strength: number;
  information_extracted: number;
  created_at: number;
  updated_at: number;
};

type VibeEncodingRow = {
  reference_id: string;
  model: string;
  information_extracted: number;
  encoded_path: string;
};

type VibeReferenceSettingsPatch = Partial<
  Pick<VibeReference, "enabled" | "strength" | "informationExtracted">
>;

function getDatabase() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DATABASE_NAME).catch(
      (error: unknown) => {
        dbPromise = null;
        throw error;
      },
    );
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

function rowToRecord(
  row: VibeReferenceRow,
  encodings: VibeEncoding[],
): VibeReference {
  return {
    id: row.id,
    imagePath: row.image_path,
    thumbnailPath: row.thumbnail_path,
    enabled: row.enabled === 1,
    strength: row.strength,
    informationExtracted: row.information_extracted,
    encodings,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function encodingRowToRecord(row: VibeEncodingRow): VibeEncoding {
  return {
    model: row.model,
    informationExtracted: row.information_extracted,
    path: row.encoded_path,
  };
}

async function getVibeReference(
  db: SQLite.SQLiteDatabase,
  id: string,
): Promise<VibeReference | null> {
  const row = await db.getFirstAsync<VibeReferenceRow>(
    "SELECT * FROM vibe_references WHERE id = ?",
    [id],
  );
  if (!row) return null;
  const encodings = await db.getAllAsync<VibeEncodingRow>(
    "SELECT * FROM vibe_reference_encodings WHERE reference_id = ?",
    [id],
  );
  return rowToRecord(row, encodings.map(encodingRowToRecord));
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
    await sourceFile.copy(destinationFile);
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

function deleteEncodingFiles(reference: VibeReference) {
  for (const encoding of reference.encodings) deleteStoredFile(encoding.path);
}

async function createThumbnail(
  sourceUri: string,
  width: number,
  height: number,
  thumbnailFileName: string,
) {
  const thumbnailPath = `${VIBES_DIR}/${THUMBNAILS_DIR}/${thumbnailFileName}`;

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
    return thumbnailPath;
  } catch {
    deleteStoredFile(thumbnailPath);
    return null;
  }
}

async function initializeVibeReferenceStorage() {
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
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS vibe_reference_encodings (
      reference_id TEXT NOT NULL,
      model TEXT NOT NULL,
      information_extracted REAL NOT NULL,
      encoded_path TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (reference_id, model)
    );
  `);
  const columns = await db.getAllAsync<{ name: string }>(
    "PRAGMA table_info(vibe_references)",
  );
  if (!columns.some((column) => column.name === "encoded_model")) {
    await db.execAsync(
      "ALTER TABLE vibe_references ADD COLUMN encoded_model TEXT",
    );
  }
  // 레거시 단일 캐시를 모델별 테이블로 옮긴다 (모델 미기록분은 V4.5 Full).
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT OR IGNORE INTO vibe_reference_encodings
         (reference_id, model, information_extracted, encoded_path, updated_at)
       SELECT id, COALESCE(encoded_model, ?), encoded_information_extracted,
              encoded_path, updated_at
         FROM vibe_references
        WHERE encoded_path IS NOT NULL
          AND encoded_information_extracted IS NOT NULL`,
      [LEGACY_ENCODED_MODEL],
    );
    await db.runAsync(
      `UPDATE vibe_references
          SET encoded_path = NULL,
              encoded_information_extracted = NULL,
              encoded_model = NULL
        WHERE encoded_path IS NOT NULL`,
    );
  });
}

export const initVibeReferenceStorage = createInitializeOnce(
  initializeVibeReferenceStorage,
);

export async function listVibeReferences(): Promise<VibeReference[]> {
  await initVibeReferenceStorage();
  const db = await getDatabase();
  const rows = await db.getAllAsync<VibeReferenceRow>(
    "SELECT * FROM vibe_references ORDER BY created_at ASC",
  );
  const encodingRows = await db.getAllAsync<VibeEncodingRow>(
    "SELECT * FROM vibe_reference_encodings",
  );
  const encodingsById = new Map<string, VibeEncoding[]>();
  for (const row of encodingRows) {
    const list = encodingsById.get(row.reference_id) ?? [];
    list.push(encodingRowToRecord(row));
    encodingsById.set(row.reference_id, list);
  }
  return rows.map((row) => rowToRecord(row, encodingsById.get(row.id) ?? []));
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

  try {
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
      enabled: true,
      strength: DEFAULT_VIBE_STRENGTH,
      informationExtracted: DEFAULT_VIBE_INFORMATION_EXTRACTED,
      encodings: [],
      createdAt,
      updatedAt: createdAt,
    };

    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO vibe_references (
        id,
        image_path,
        thumbnail_path,
        enabled,
        strength,
        information_extracted,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.imagePath,
        record.thumbnailPath,
        record.enabled ? 1 : 0,
        record.strength,
        record.informationExtracted,
        record.createdAt,
        record.updatedAt,
      ],
    );

    return record;
  } catch (error: unknown) {
    deleteStoredFile(imagePath);
    deleteStoredFile(`${VIBES_DIR}/${THUMBNAILS_DIR}/${thumbnailFileName}`);
    throw error;
  }
}

export async function replaceVibeReferenceImage(
  id: string,
  input: VibeReferenceImageInput,
): Promise<VibeReference | null> {
  await initVibeReferenceStorage();
  const db = await getDatabase();
  const current = await getVibeReference(db, id);
  if (!current) return null;

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

    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `UPDATE vibe_references
           SET image_path = ?,
               thumbnail_path = ?,
               updated_at = ?
         WHERE id = ?`,
        [imagePath, thumbnailPath, updatedAt, id],
      );
      await db.runAsync(
        "DELETE FROM vibe_reference_encodings WHERE reference_id = ?",
        [id],
      );
    });
  } catch (error: unknown) {
    deleteStoredFile(imagePath);
    deleteStoredFile(thumbnailPathCandidate);
    if (error instanceof Error) throw error;
    throw new Error("Vibe 이미지를 교체하지 못했습니다.");
  }

  deleteStoredFile(current.imagePath);
  deleteStoredFile(current.thumbnailPath);
  deleteEncodingFiles(current);

  return {
    ...current,
    imagePath,
    thumbnailPath,
    encodings: [],
    updatedAt,
  };
}

export async function updateVibeReferenceSettings(
  id: string,
  patch: VibeReferenceSettingsPatch,
): Promise<VibeReference | null> {
  return settingsMutationQueue.run([id], async () => {
    await initVibeReferenceStorage();
    const db = await getDatabase();
    const current = await getVibeReference(db, id);
    if (!current) return null;

    const assignments: string[] = [];
    const values: (string | number | null)[] = [];

    if (patch.enabled !== undefined) {
      assignments.push("enabled = ?");
      values.push(patch.enabled ? 1 : 0);
    }
    if (patch.strength !== undefined) {
      assignments.push("strength = ?");
      values.push(patch.strength);
    }

    const shouldClearEncoded =
      patch.informationExtracted !== undefined &&
      patch.informationExtracted !== current.informationExtracted;
    if (patch.informationExtracted !== undefined) {
      assignments.push("information_extracted = ?");
      values.push(patch.informationExtracted);
    }
    if (assignments.length === 0) return current;

    assignments.push("updated_at = ?");
    values.push(Date.now(), id);
    // Information Extracted가 바뀌면 모든 모델의 인코딩을 무효화한다.
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `UPDATE vibe_references
           SET ${assignments.join(", ")}
         WHERE id = ?`,
        values,
      );
      if (shouldClearEncoded) {
        await db.runAsync(
          "DELETE FROM vibe_reference_encodings WHERE reference_id = ?",
          [id],
        );
      }
    });

    const updated = await getVibeReference(db, id);
    if (shouldClearEncoded) deleteEncodingFiles(current);
    return updated;
  });
}

export async function deleteVibeReference(id: string) {
  await initVibeReferenceStorage();
  const db = await getDatabase();
  const record = await getVibeReference(db, id);
  if (!record) return;

  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM vibe_references WHERE id = ?", [id]);
    await db.runAsync(
      "DELETE FROM vibe_reference_encodings WHERE reference_id = ?",
      [id],
    );
  });

  deleteStoredFile(record.imagePath);
  deleteStoredFile(record.thumbnailPath);
  deleteEncodingFiles(record);
}

export async function saveEncodedVibeReference(
  id: string,
  encodedBase64: string,
  informationExtracted: number,
  model: string,
): Promise<VibeReference | null> {
  return settingsMutationQueue.run([id], async () => {
    await initVibeReferenceStorage();
    const db = await getDatabase();
    const current = await getVibeReference(db, id);
    if (!current) return null;
    if (current.informationExtracted !== informationExtracted) return null;

    const updatedAt = Date.now();
    const encodedSuffix = `${updatedAt}_${Math.random()
      .toString(36)
      .slice(2, 10)}`;
    const encodedFileName = `${id}_${encodedSuffix}.bin`;
    const encodedPath = `${VIBES_DIR}/${ENCODED_DIR}/${encodedFileName}`;
    const encodedFile = new File(getEncodedDirectory(), encodedFileName);

    try {
      encodedFile.create({ overwrite: true });
      encodedFile.write(encodedBase64, { encoding: "base64" });

      await db.runAsync(
        `INSERT OR REPLACE INTO vibe_reference_encodings
           (reference_id, model, information_extracted, encoded_path, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [id, model, informationExtracted, encodedPath, updatedAt],
      );
    } catch (error: unknown) {
      deleteStoredFile(encodedPath);
      throw error;
    }

    // 같은 모델의 이전 인코딩 파일만 교체한다. 다른 모델 캐시는 유지.
    const previous = current.encodings.find(
      (encoding) => encoding.model === model,
    );
    if (previous) deleteStoredFile(previous.path);

    return {
      ...current,
      encodings: [
        ...current.encodings.filter((encoding) => encoding.model !== model),
        { model, informationExtracted, path: encodedPath },
      ],
    };
  });
}

export async function readVibeReferenceImageBase64(
  reference: VibeReference,
): Promise<string> {
  return fileFromStoredPath(reference.imagePath).base64();
}

export async function readEncodedVibeReferenceBase64(
  reference: VibeReference,
  model: string,
): Promise<string> {
  const encoding = findCachedVibeEncoding(reference, model);
  if (!encoding) {
    throw new Error("Vibe reference is not encoded for this model.");
  }
  return fileFromStoredPath(encoding.path).base64();
}

export function resolveVibeReferenceImageUri(reference: VibeReference) {
  return fileFromStoredPath(reference.imagePath).uri;
}

export function resolveVibeReferenceThumbnailUri(reference: VibeReference) {
  if (!reference.thumbnailPath) return null;
  const file = fileFromStoredPath(reference.thumbnailPath);
  return file.exists ? file.uri : null;
}
