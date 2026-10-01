import { File } from "expo-file-system";
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
import {
  createManagedDirectory,
  createStorageId,
} from "./localData/managedFiles";
import { createDatabaseOpener } from "./localData/sqlite";
import { extractImageMetadata } from "./imageMetadata";
import type { NovelAiImageFormat } from "./novelai";

const DATABASE_NAME = "generation-history.db";
const IMAGE_ROOT_DIR = "nai-images";
const ORIGINALS_DIR = "originals";
// Aspect-fit thumbnails (long side THUMBNAIL_SIZE). Older records keep
// center-cropped squares in "thumbnails/", which the grid does not use.
const THUMBNAILS_DIR = "grid-thumbnails";
const THUMBNAIL_SIZE = 512;
const DELETE_QUERY_BATCH_SIZE = 300;
const IMAGE_QUERY_BATCH_SIZE = 300;

const getDatabase = createDatabaseOpener(DATABASE_NAME);
const imageFiles = createManagedDirectory(IMAGE_ROOT_DIR);

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
  imageFormat: NovelAiImageFormat;
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

async function initializeGenerationHistoryStorage() {
  imageFiles.ensure(ORIGINALS_DIR, THUMBNAILS_DIR);
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
  const rows = await db.getAllAsync<GenerationRow>(query.sql, query.params);
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
    imageFiles.remove(row.image_path);
    imageFiles.remove(row.thumbnail_path);
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
        compress: 0.9,
        format: ImageManipulator.SaveFormat.JPEG,
      },
    );
    const thumbnailFile = imageFiles.file(
      `${THUMBNAILS_DIR}/${thumbnailFileName}`,
    );
    const temporaryThumbnailFile = new File(thumbnail.uri);
    await temporaryThumbnailFile.copy(thumbnailFile);
    try {
      temporaryThumbnailFile.delete();
    } catch {
      // The thumbnail has already been copied into app storage.
    }
  } catch {
    imageFiles.remove(`${THUMBNAILS_DIR}/${thumbnailFileName}`);
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

  return insertGenerationRecord(record);
}

async function insertGenerationRecord(record: GenerationRecord) {
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

// WebP에는 PNG 텍스트 청크가 없어 stealth alpha에서 읽는다. 추출 실패로
// 이미 생성된 이미지를 버리지 않도록 실패하면 빈 메타데이터로 저장한다.
async function readStoredImageMetadata(
  imagePath: string,
): Promise<Record<string, string>> {
  try {
    const bytes = await imageFiles.file(imagePath).bytes();
    return extractImageMetadata(bytes) ?? {};
  } catch {
    return {};
  }
}

export async function prepareNativeGenerationFiles(
  imageFormat: NovelAiImageFormat,
) {
  await initGenerationHistoryStorage();
  const id = createStorageId("gen");
  const imagePath = `${ORIGINALS_DIR}/${id}.${imageFormat}`;
  return {
    id,
    imagePath,
    thumbnailPath: `${THUMBNAILS_DIR}/${id}.jpg`,
    originalUri: imageFiles.file(imagePath).uri,
    thumbnailUri: imageFiles.file(`${THUMBNAILS_DIR}/${id}.jpg`).uri,
  };
}

export function discardNativeGenerationFiles(files: {
  imagePath: string;
  thumbnailPath: string;
}) {
  imageFiles.remove(files.imagePath);
  imageFiles.remove(files.thumbnailPath);
}

export async function savePreparedGeneration(
  files: Awaited<ReturnType<typeof prepareNativeGenerationFiles>>,
  input: Omit<SaveGenerationInput, "imageBytes">,
  hasThumbnail: boolean,
) {
  const { metadata: nativeMetadata, ...recordInput } = input;
  try {
    // 네이티브 모듈은 PNG 텍스트 청크만 읽으므로 비어 있으면 JS에서 다시 읽는다.
    const metadata =
      Object.keys(nativeMetadata).length > 0
        ? nativeMetadata
        : await readStoredImageMetadata(files.imagePath);
    return await insertGenerationRecord({
      ...recordInput,
      id: files.id,
      createdAt: Date.now(),
      imagePath: files.imagePath,
      thumbnailPath: hasThumbnail ? files.thumbnailPath : null,
      metadataJson: JSON.stringify(metadata),
    });
  } catch (error) {
    discardNativeGenerationFiles(files);
    throw error;
  }
}

export async function saveGenerationImageBase64({
  imageBase64,
  imageFormat,
  ...recordInput
}: SaveGenerationBase64Input): Promise<GenerationRecord> {
  await initGenerationHistoryStorage();

  const id = createStorageId("gen");
  const createdAt = Date.now();
  const imagePath = `${ORIGINALS_DIR}/${id}.${imageFormat}`;
  const thumbnailFileName = `${id}.jpg`;
  const originalFile = imageFiles.file(imagePath);

  try {
    originalFile.create({ overwrite: true });
    originalFile.write(imageBase64, { encoding: "base64" });

    return await saveGenerationRecord({
      ...recordInput,
      id,
      createdAt,
      imagePath,
      thumbnailFileName,
      originalFile,
      metadata: await readStoredImageMetadata(imagePath),
    });
  } catch (error: unknown) {
    imageFiles.remove(imagePath);
    imageFiles.remove(`${THUMBNAILS_DIR}/${thumbnailFileName}`);
    throw error;
  }
}

export function resolveGenerationImageUri(
  record: Pick<GenerationRecord, "imagePath">,
) {
  return imageFiles.file(record.imagePath).uri;
}

export function resolveGenerationThumbnailUri(
  record: Pick<GenerationRecord, "imagePath" | "thumbnailPath">,
) {
  return record.thumbnailPath?.startsWith(`${THUMBNAILS_DIR}/`)
    ? imageFiles.file(record.thumbnailPath).uri
    : resolveGenerationImageUri(record);
}
