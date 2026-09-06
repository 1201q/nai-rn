import { Directory, File, Paths } from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import * as SQLite from "expo-sqlite";

import type { NoiseSchedule } from "../constants/generation";
import {
  buildGenerationHistoryPageQuery,
  createGenerationHistoryPage,
  type GenerationHistoryCursor,
  type GenerationHistoryPage,
} from "./generationHistoryPage";
import { createInitializeOnce } from "./initializeOnce";
import { extractPngTextMetadata } from "./novelai";
import { measureGenerationAsync, measureGenerationSync } from "./generationPerformance";

const DATABASE_NAME = "generation-history.db";
const IMAGE_ROOT_DIR = "nai-images";
const ORIGINALS_DIR = "originals";
const THUMBNAILS_DIR = "thumbnails";
const THUMBNAIL_SIZE = 512;
const DELETE_QUERY_BATCH_SIZE = 300;
const IMAGE_QUERY_BATCH_SIZE = 300;

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

type SaveGenerationInput = {
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

type SaveGenerationBase64Input = Omit<
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
    dbPromise = SQLite.openDatabaseAsync(DATABASE_NAME).catch(
      (error: unknown) => {
        dbPromise = null;
        throw error;
      },
    );
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

function deleteStoredFile(path: string | null) {
  if (!path) return;

  try {
    const file = fileFromStoredPath(path);
    if (file.exists) file.delete();
  } catch {
    // DB state is the source of truth; missing file cleanup can be ignored.
  }
}

async function initializeGenerationHistoryStorage() {
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

    CREATE INDEX IF NOT EXISTS generations_created_at_id_idx
      ON generations (created_at DESC, id DESC);
  `);
}

export const initGenerationHistoryStorage = createInitializeOnce(
  initializeGenerationHistoryStorage,
);

export async function listGenerationPage(
  cursor: GenerationHistoryCursor | null = null,
): Promise<GenerationHistoryPage<GenerationRecord>> {
  await initGenerationHistoryStorage();
  const db = await getDatabase();
  const query = buildGenerationHistoryPageQuery(cursor);
  const rows = await db.getAllAsync<GenerationRow>(
    query.sql,
    query.params,
  );
  return createGenerationHistoryPage(rows.map(rowToRecord));
}

export async function listGenerationIds(): Promise<string[]> {
  await initGenerationHistoryStorage();
  const db = await getDatabase();
  const rows = await db.getAllAsync<Pick<GenerationRow, "id">>(
    "SELECT id FROM generations ORDER BY created_at DESC, id DESC",
  );
  return rows.map((row) => row.id);
}

export async function* iterateGenerationImageBatches(ids: string[]) {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return;
  await initGenerationHistoryStorage();
  const db = await getDatabase();
  for (
    let offset = 0;
    offset < uniqueIds.length;
    offset += IMAGE_QUERY_BATCH_SIZE
  ) {
    const batchIds = uniqueIds.slice(offset, offset + IMAGE_QUERY_BATCH_SIZE);
    const placeholders = batchIds.map(() => "?").join(", ");
    const rows = await db.getAllAsync<Pick<GenerationRow, "id" | "image_path">>(
      `SELECT id, image_path FROM generations WHERE id IN (${placeholders})`,
      batchIds,
    );
    const paths = new Map(rows.map((row) => [row.id, row.image_path]));
    yield batchIds.map((id) => ({ id, imagePath: paths.get(id) ?? null }));
  }
}

export async function deleteGenerations(ids: string[]) {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return;
  await initGenerationHistoryStorage();

  // Isolate this transaction from saves and reads on the shared connection.
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME, {
    useNewConnection: true,
  });
  const rows: Pick<GenerationRow, "image_path" | "thumbnail_path">[] = [];
  try {
    await db.withTransactionAsync(async () => {
      for (
        let offset = 0;
        offset < uniqueIds.length;
        offset += DELETE_QUERY_BATCH_SIZE
      ) {
        const batchIds = uniqueIds.slice(
          offset,
          offset + DELETE_QUERY_BATCH_SIZE,
        );
        const placeholders = batchIds.map(() => "?").join(", ");
        const batchRows = await db.getAllAsync<(typeof rows)[number]>(
          `SELECT image_path, thumbnail_path FROM generations WHERE id IN (${placeholders})`,
          batchIds,
        );
        rows.push(...batchRows);
        await db.runAsync(
          `DELETE FROM generations WHERE id IN (${placeholders})`,
          batchIds,
        );
      }
    });
  } finally {
    await db.closeAsync();
  }

  // File deletion cannot be rolled back; start it only after the DB commits.
  for (const row of rows) {
    deleteStoredFile(row.image_path);
    deleteStoredFile(row.thumbnail_path);
  }
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
    const isLandscape = width >= height;
    const resizedWidth = isLandscape
      ? Math.round((width / height) * THUMBNAIL_SIZE)
      : THUMBNAIL_SIZE;
    const resizedHeight = isLandscape
      ? THUMBNAIL_SIZE
      : Math.round((height / width) * THUMBNAIL_SIZE);
    const thumbnail = await measureGenerationAsync("save.thumbnail", () => ImageManipulator.manipulateAsync(
      originalFile.uri,
      [
        {
          resize: isLandscape
            ? { height: THUMBNAIL_SIZE }
            : { width: THUMBNAIL_SIZE },
        },
        {
          crop: {
            originX: Math.floor((resizedWidth - THUMBNAIL_SIZE) / 2),
            originY: Math.floor((resizedHeight - THUMBNAIL_SIZE) / 2),
            width: THUMBNAIL_SIZE,
            height: THUMBNAIL_SIZE,
          },
        },
      ],
      {
        compress: 0.9,
        format: ImageManipulator.SaveFormat.JPEG,
      },
    ));
    const thumbnailFile = new File(getThumbnailsDirectory(), thumbnailFileName);
    const temporaryThumbnailFile = new File(thumbnail.uri);
    await measureGenerationAsync("save.thumbnail_copy", () => temporaryThumbnailFile.copy(thumbnailFile));
    try {
      temporaryThumbnailFile.delete();
    } catch {
      // The thumbnail has already been copied into app storage.
    }
  } catch {
    deleteStoredFile(`${THUMBNAILS_DIR}/${thumbnailFileName}`);
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
  await measureGenerationAsync("save.db_insert", () => db.runAsync(
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
  ));

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

  try {
    originalFile.create({ overwrite: true });
    measureGenerationSync("save.original_write", () => originalFile.write(imageBase64, { encoding: "base64" }));

    const imageBytes = await measureGenerationAsync("save.original_read", () => originalFile.bytes());
    return await saveGenerationRecord({
      ...recordInput,
      id,
      createdAt,
      imagePath,
      thumbnailFileName,
      originalFile,
      metadata: measureGenerationSync("save.metadata", () => extractPngTextMetadata(imageBytes)),
    });
  } catch (error: unknown) {
    deleteStoredFile(imagePath);
    deleteStoredFile(`${THUMBNAILS_DIR}/${thumbnailFileName}`);
    throw error;
  }
}

export function resolveGenerationImageUri(
  record: Pick<GenerationRecord, "imagePath">,
) {
  return fileFromStoredPath(record.imagePath).uri;
}

export function resolveGenerationThumbnailUri(record: GenerationRecord) {
  if (!record.thumbnailPath) {
    return null;
  }

  const file = fileFromStoredPath(record.thumbnailPath);

  return file.exists ? file.uri : null;
}
