import { Directory, File, Paths } from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import * as SQLite from "expo-sqlite";

import type { NoiseSchedule } from "../constants/generation";
import { extractPngTextMetadata } from "./novelai";

const DATABASE_NAME = "generation-history.db";
const IMAGE_ROOT_DIR = "nai-images";
const ORIGINALS_DIR = "originals";
const THUMBNAILS_DIR = "thumbnails";
const THUMBNAIL_SIZE = 360;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export type GenerationRecord = {
  id: string;
  imagePath: string;
  thumbnailPath: string | null;
  prompt: string;
  negativePrompt: string;
  model: string;
  sampler: string;
  noiseSchedule: NoiseSchedule;
  width: number;
  height: number;
  steps: number;
  scale: number;
  cfgRescale: number;
  seed: number | null;
  createdAt: number;
  metadataJson: string;
};

export type SaveGenerationInput = {
  imageBytes: Uint8Array;
  prompt: string;
  negativePrompt: string;
  model: string;
  sampler: string;
  noiseSchedule: NoiseSchedule;
  width: number;
  height: number;
  steps: number;
  scale: number;
  cfgRescale: number;
  seed: number;
  metadata: Record<string, string>;
};

export type SaveGenerationBase64Input = Omit<
  SaveGenerationInput,
  "imageBytes" | "metadata"
> & {
  imageBase64: string;
};

type GenerationRow = {
  id: string;
  image_path: string;
  thumbnail_path: string | null;
  prompt: string;
  negative_prompt: string;
  model: string;
  sampler: string;
  noise_schedule: NoiseSchedule;
  width: number;
  height: number;
  steps: number;
  scale: number;
  cfg_rescale: number;
  seed: number | null;
  created_at: number;
  metadata_json: string;
};

function getDatabase() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DATABASE_NAME);
  }
  return dbPromise;
}

function createGenerationId() {
  return `gen_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getImageRootDirectory() {
  return new Directory(Paths.document, IMAGE_ROOT_DIR);
}

function getOriginalsDirectory() {
  return new Directory(getImageRootDirectory(), ORIGINALS_DIR);
}

function getThumbnailsDirectory() {
  return new Directory(getImageRootDirectory(), THUMBNAILS_DIR);
}

function ensureImageDirectories() {
  getImageRootDirectory().create({ idempotent: true, intermediates: true });
  getOriginalsDirectory().create({ idempotent: true, intermediates: true });
  getThumbnailsDirectory().create({ idempotent: true, intermediates: true });
}

function rowToRecord(row: GenerationRow): GenerationRecord {
  return {
    id: row.id,
    imagePath: row.image_path,
    thumbnailPath: row.thumbnail_path,
    prompt: row.prompt,
    negativePrompt: row.negative_prompt,
    model: row.model,
    sampler: row.sampler,
    noiseSchedule: row.noise_schedule,
    width: row.width,
    height: row.height,
    steps: row.steps,
    scale: row.scale,
    cfgRescale: row.cfg_rescale,
    seed: row.seed,
    createdAt: row.created_at,
    metadataJson: row.metadata_json,
  };
}

function fileFromStoredPath(path: string) {
  const [directoryName, fileName] = path.split("/");
  return new File(
    new Directory(getImageRootDirectory(), directoryName),
    fileName,
  );
}

export async function initGenerationHistoryStorage() {
  ensureImageDirectories();
  const db = await getDatabase();
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS generations (
      id TEXT PRIMARY KEY,
      image_path TEXT NOT NULL,
      thumbnail_path TEXT,
      prompt TEXT NOT NULL,
      negative_prompt TEXT NOT NULL,
      model TEXT NOT NULL,
      sampler TEXT NOT NULL,
      noise_schedule TEXT NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      steps INTEGER NOT NULL,
      scale REAL NOT NULL,
      cfg_rescale REAL NOT NULL,
      seed INTEGER,
      created_at INTEGER NOT NULL,
      metadata_json TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS generations_created_at_idx
      ON generations (created_at DESC);
  `);
}

export async function listGenerations(): Promise<GenerationRecord[]> {
  await initGenerationHistoryStorage();
  const db = await getDatabase();
  const rows = await db.getAllAsync<GenerationRow>(
    "SELECT * FROM generations ORDER BY created_at DESC",
  );
  return rows.map(rowToRecord);
}

export async function deleteGenerations(ids: string[]) {
  await initGenerationHistoryStorage();
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return;

  const db = await getDatabase();
  const placeholders = uniqueIds.map(() => "?").join(", ");
  const rows = await db.getAllAsync<GenerationRow>(
    `SELECT * FROM generations WHERE id IN (${placeholders})`,
    uniqueIds,
  );

  await db.runAsync(
    `DELETE FROM generations WHERE id IN (${placeholders})`,
    uniqueIds,
  );

  rows.map(rowToRecord).forEach((record) => {
    try {
      const originalFile = fileFromStoredPath(record.imagePath);
      if (originalFile.exists) originalFile.delete();
    } catch {
      // DB deletion succeeded, so missing file cleanup can be ignored.
    }

    if (!record.thumbnailPath) return;

    try {
      const thumbnailFile = fileFromStoredPath(record.thumbnailPath);
      if (thumbnailFile.exists) thumbnailFile.delete();
    } catch {
      // DB deletion succeeded, so missing thumbnail cleanup can be ignored.
    }
  });
}

type SaveGenerationRecordInput = Omit<SaveGenerationInput, "imageBytes"> & {
  id: string;
  createdAt: number;
  imagePath: string;
  thumbnailFileName: string;
  originalFile: File;
};

async function saveGenerationRecord({
  id,
  createdAt,
  imagePath,
  thumbnailFileName,
  originalFile,
  prompt,
  negativePrompt,
  model,
  sampler,
  noiseSchedule,
  width,
  height,
  steps,
  scale,
  cfgRescale,
  seed,
  metadata,
}: SaveGenerationRecordInput): Promise<GenerationRecord> {
  let thumbnailPath: string | null = `${THUMBNAILS_DIR}/${thumbnailFileName}`;

  try {
    const thumbnail = await ImageManipulator.manipulateAsync(
      originalFile.uri,
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
    await temporaryThumbnailFile.copy(thumbnailFile);
    try {
      temporaryThumbnailFile.delete();
    } catch {
      // The thumbnail has already been copied into app storage.
    }
  } catch {
    thumbnailPath = null;
  }

  const record: GenerationRecord = {
    id,
    imagePath,
    thumbnailPath,
    prompt,
    negativePrompt,
    model,
    sampler,
    noiseSchedule,
    width,
    height,
    steps,
    scale,
    cfgRescale,
    seed,
    createdAt,
    metadataJson: JSON.stringify(metadata),
  };

  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO generations (
      id,
      image_path,
      thumbnail_path,
      prompt,
      negative_prompt,
      model,
      sampler,
      noise_schedule,
      width,
      height,
      steps,
      scale,
      cfg_rescale,
      seed,
      created_at,
      metadata_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      record.imagePath,
      record.thumbnailPath,
      record.prompt,
      record.negativePrompt,
      record.model,
      record.sampler,
      record.noiseSchedule,
      record.width,
      record.height,
      record.steps,
      record.scale,
      record.cfgRescale,
      record.seed,
      record.createdAt,
      record.metadataJson,
    ],
  );

  return record;
}

export async function saveGenerationImageBase64({
  imageBase64,
  ...recordInput
}: SaveGenerationBase64Input): Promise<GenerationRecord> {
  await initGenerationHistoryStorage();

  const id = createGenerationId();
  const createdAt = Date.now();
  const imagePath = `${ORIGINALS_DIR}/${id}.png`;
  const thumbnailFileName = `${id}.jpg`;
  const originalFile = new File(getOriginalsDirectory(), `${id}.png`);

  originalFile.create({ overwrite: true });
  originalFile.write(imageBase64, { encoding: "base64" });

  const imageBytes = await originalFile.bytes();
  return saveGenerationRecord({
    ...recordInput,
    id,
    createdAt,
    imagePath,
    thumbnailFileName,
    originalFile,
    metadata: extractPngTextMetadata(imageBytes),
  });
}

export function resolveGenerationImageUri(record: GenerationRecord) {
  return fileFromStoredPath(record.imagePath).uri;
}

export function resolveGenerationThumbnailUri(record: GenerationRecord) {
  if (!record.thumbnailPath) {
    return null;
  }

  const file = fileFromStoredPath(record.thumbnailPath);

  return file.exists ? file.uri : null;
}
