import { File } from "expo-file-system";
import { ImageFormat, Skia, rect } from "@shopify/react-native-skia";

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

const DATABASE_NAME = "precise-references.db";
const REFERENCE_ROOT_DIR = "nai-references";
const PRECISE_DIR = "precise";
const ORIGINALS_DIR = "originals";
const THUMBNAILS_DIR = "thumbnails";
const PROCESSED_DIR = "processed";
const THUMBNAIL_SIZE = 360;
const PROCESSED_JPEG_QUALITY = 95;

export const MAX_PRECISE_REFERENCES = 16;
const DEFAULT_PRECISE_REFERENCE_STRENGTH = 0.6;
const DEFAULT_PRECISE_REFERENCE_FIDELITY = 0.6;
const DEFAULT_PRECISE_REFERENCE_TYPE = "character&style";

const getDatabase = createDatabaseOpener(DATABASE_NAME);
const referenceFiles = createManagedDirectory(REFERENCE_ROOT_DIR);
const settingsMutationQueue = createKeyedMutationQueue();

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

const PRECISE_REFERENCE_TARGET_SIZES = [
  { width: 1024, height: 1536 },
  { width: 1536, height: 1024 },
  { width: 1472, height: 1472 },
];

// 공식 웹과 동일: 원본 비율에 가장 가까운 캔버스를 고른다.
export function getPreciseReferenceTargetSize(width: number, height: number) {
  const aspect = width / height;
  let best = PRECISE_REFERENCE_TARGET_SIZES[0];
  for (const size of PRECISE_REFERENCE_TARGET_SIZES) {
    if (
      Math.abs(size.width / size.height - aspect) <
      Math.abs(best.width / best.height - aspect)
    ) {
      best = size;
    }
  }
  return best;
}

function getContainRect(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
) {
  const aspect = sourceWidth / sourceHeight;
  const fitsWidth = aspect > targetWidth / targetHeight;
  const width = fitsWidth ? targetWidth : Math.round(targetHeight * aspect);
  const height = fitsWidth ? Math.round(targetWidth / aspect) : targetHeight;
  return {
    x: Math.round((targetWidth - width) / 2),
    y: Math.round((targetHeight - height) / 2),
    width,
    height,
  };
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

  const processedFile = referenceFiles.file(
    `${PRECISE_DIR}/${PROCESSED_DIR}/${processedFileName}`,
  );
  processedFile.create({ overwrite: true });
  processedFile.write(processedBase64, { encoding: "base64" });

  return {
    path: `${PRECISE_DIR}/${PROCESSED_DIR}/${processedFileName}`,
    width: target.width,
    height: target.height,
  };
}

async function initializePreciseReferenceStorage() {
  referenceFiles.ensure(
    PRECISE_DIR,
    `${PRECISE_DIR}/${ORIGINALS_DIR}`,
    `${PRECISE_DIR}/${THUMBNAILS_DIR}`,
    `${PRECISE_DIR}/${PROCESSED_DIR}`,
  );
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

export const initPreciseReferenceStorage = createInitializeOnce(
  initializePreciseReferenceStorage,
);

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

  const id = createStorageId("precise");
  const createdAt = Date.now();
  const extension = getImageExtension(input);
  const imageFileName = `${id}.${extension}`;
  const thumbnailFileName = `${id}.jpg`;
  const processedFileName = `${id}.jpg`;
  const imagePath = `${PRECISE_DIR}/${ORIGINALS_DIR}/${imageFileName}`;
  const imageFile = referenceFiles.file(imagePath);

  try {
    await copyImageToFile(input.uri, imageFile);

    const thumbnailPath = await createJpegThumbnail(
      referenceFiles,
      `${PRECISE_DIR}/${THUMBNAILS_DIR}/${thumbnailFileName}`,
      input,
      THUMBNAIL_SIZE,
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
    referenceFiles.remove(imagePath);
    referenceFiles.remove(
      `${PRECISE_DIR}/${THUMBNAILS_DIR}/${thumbnailFileName}`,
    );
    referenceFiles.remove(
      `${PRECISE_DIR}/${PROCESSED_DIR}/${processedFileName}`,
    );
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
  const updatedAt = Date.now();
  const replacementSuffix = `${updatedAt}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
  const extension = getImageExtension(input);
  const imageFileName = `${id}_${replacementSuffix}.${extension}`;
  const thumbnailFileName = `${id}_${replacementSuffix}.jpg`;
  const processedFileName = `${id}_${replacementSuffix}.jpg`;
  const imagePath = `${PRECISE_DIR}/${ORIGINALS_DIR}/${imageFileName}`;
  const imageFile = referenceFiles.file(imagePath);

  try {
    await copyImageToFile(input.uri, imageFile);
    const thumbnailPath = await createJpegThumbnail(
      referenceFiles,
      `${PRECISE_DIR}/${THUMBNAILS_DIR}/${thumbnailFileName}`,
      input,
      THUMBNAIL_SIZE,
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

    referenceFiles.remove(current.imagePath);
    referenceFiles.remove(current.thumbnailPath);
    referenceFiles.remove(current.processedPath);

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
    referenceFiles.remove(imagePath);
    referenceFiles.remove(
      `${PRECISE_DIR}/${THUMBNAILS_DIR}/${thumbnailFileName}`,
    );
    referenceFiles.remove(
      `${PRECISE_DIR}/${PROCESSED_DIR}/${processedFileName}`,
    );
    if (error instanceof Error) throw error;
    throw new Error("Precise Reference 이미지를 교체하지 못했습니다.");
  }
}

export async function updatePreciseReferenceSettings(
  id: string,
  patch: PreciseReferenceSettingsPatch,
): Promise<PreciseReference | null> {
  return settingsMutationQueue.run([id], async () => {
    await initPreciseReferenceStorage();
    const db = await getDatabase();
    const assignments: string[] = [];
    const values: (string | number)[] = [];

    if (patch.enabled !== undefined) {
      assignments.push("enabled = ?");
      values.push(patch.enabled ? 1 : 0);
    }
    if (patch.strength !== undefined) {
      assignments.push("strength = ?");
      values.push(patch.strength);
    }
    if (patch.fidelity !== undefined) {
      assignments.push("fidelity = ?");
      values.push(patch.fidelity);
    }
    if (patch.referenceType !== undefined) {
      assignments.push("reference_type = ?");
      values.push(patch.referenceType);
    }
    if (assignments.length === 0) {
      const existing = await db.getFirstAsync<PreciseReferenceRow>(
        "SELECT * FROM precise_references WHERE id = ?",
        [id],
      );
      return existing ? rowToRecord(existing) : null;
    }

    assignments.push("updated_at = ?");
    values.push(Date.now(), id);
    await db.runAsync(
      `UPDATE precise_references
         SET ${assignments.join(", ")}
       WHERE id = ?`,
      values,
    );

    const updated = await db.getFirstAsync<PreciseReferenceRow>(
      "SELECT * FROM precise_references WHERE id = ?",
      [id],
    );
    return updated ? rowToRecord(updated) : null;
  });
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

  referenceFiles.remove(record.imagePath);
  referenceFiles.remove(record.thumbnailPath);
  referenceFiles.remove(record.processedPath);
}

export async function readPreciseReferenceProcessedBase64(
  reference: PreciseReference,
): Promise<string> {
  return referenceFiles.file(reference.processedPath).base64();
}

export function resolvePreciseReferenceImageUri(reference: PreciseReference) {
  return referenceFiles.file(reference.imagePath).uri;
}

export function resolvePreciseReferenceThumbnailUri(
  reference: PreciseReference,
) {
  if (!reference.thumbnailPath) return null;
  const file = referenceFiles.file(reference.thumbnailPath);
  return file.exists ? file.uri : null;
}
