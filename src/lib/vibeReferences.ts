import type { SQLiteDatabase } from "expo-sqlite";

import { createInitializeOnce } from "./initializeOnce";
import {
  copyImageToFile,
  createJpegThumbnail,
  getImageExtension,
} from "./localData/imageFiles";
import {
  createManagedDirectory,
  createStorageId,
} from "./localData/managedFiles";
import { createDatabaseOpener } from "./localData/sqlite";
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

const getDatabase = createDatabaseOpener(DATABASE_NAME);
const referenceFiles = createManagedDirectory(REFERENCE_ROOT_DIR);
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
  db: SQLiteDatabase,
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

function deleteEncodingFiles(reference: VibeReference) {
  for (const encoding of reference.encodings)
    referenceFiles.remove(encoding.path);
}

async function initializeVibeReferenceStorage() {
  referenceFiles.ensure(
    VIBES_DIR,
    `${VIBES_DIR}/${ORIGINALS_DIR}`,
    `${VIBES_DIR}/${THUMBNAILS_DIR}`,
    `${VIBES_DIR}/${ENCODED_DIR}`,
  );
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

  const id = createStorageId("vibe");
  const createdAt = Date.now();
  const extension = getImageExtension(input);
  const imageFileName = `${id}.${extension}`;
  const thumbnailFileName = `${id}.jpg`;
  const imagePath = `${VIBES_DIR}/${ORIGINALS_DIR}/${imageFileName}`;
  const imageFile = referenceFiles.file(imagePath);

  try {
    await copyImageToFile(input.uri, imageFile);

    const thumbnailPath = await createJpegThumbnail(
      referenceFiles,
      `${VIBES_DIR}/${THUMBNAILS_DIR}/${thumbnailFileName}`,
      input,
      THUMBNAIL_SIZE,
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
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
    referenceFiles.remove(imagePath);
    referenceFiles.remove(
      `${VIBES_DIR}/${THUMBNAILS_DIR}/${thumbnailFileName}`,
    );
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
  const imageFile = referenceFiles.file(imagePath);
  const thumbnailPathCandidate = `${VIBES_DIR}/${THUMBNAILS_DIR}/${thumbnailFileName}`;
  let thumbnailPath: string | null = null;

  try {
    await copyImageToFile(input.uri, imageFile);
    thumbnailPath = await createJpegThumbnail(
      referenceFiles,
      `${VIBES_DIR}/${THUMBNAILS_DIR}/${thumbnailFileName}`,
      input,
      THUMBNAIL_SIZE,
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
    referenceFiles.remove(imagePath);
    referenceFiles.remove(thumbnailPathCandidate);
    if (error instanceof Error) throw error;
    throw new Error("Vibe 이미지를 교체하지 못했습니다.");
  }

  referenceFiles.remove(current.imagePath);
  referenceFiles.remove(current.thumbnailPath);
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

  referenceFiles.remove(record.imagePath);
  referenceFiles.remove(record.thumbnailPath);
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
    const encodedFile = referenceFiles.file(encodedPath);

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
      referenceFiles.remove(encodedPath);
      throw error;
    }

    // 같은 모델의 이전 인코딩 파일만 교체한다. 다른 모델 캐시는 유지.
    const previous = current.encodings.find(
      (encoding) => encoding.model === model,
    );
    if (previous) referenceFiles.remove(previous.path);

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
  return referenceFiles.file(reference.imagePath).base64();
}

export async function readEncodedVibeReferenceBase64(
  reference: VibeReference,
  model: string,
): Promise<string> {
  const encoding = findCachedVibeEncoding(reference, model);
  if (!encoding) {
    throw new Error("Vibe reference is not encoded for this model.");
  }
  return referenceFiles.file(encoding.path).base64();
}

export function resolveVibeReferenceImageUri(reference: VibeReference) {
  return referenceFiles.file(reference.imagePath).uri;
}

export function resolveVibeReferenceThumbnailUri(reference: VibeReference) {
  if (!reference.thumbnailPath) return null;
  const file = referenceFiles.file(reference.thumbnailPath);
  return file.exists ? file.uri : null;
}
