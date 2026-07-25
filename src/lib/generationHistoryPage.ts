export const GENERATION_HISTORY_PAGE_SIZE = 48;

export type GenerationHistoryCursor = {
  createdAt: number;
  id: string;
};

export type GenerationHistoryPage<T> = {
  records: T[];
  nextCursor: GenerationHistoryCursor | null;
  hasMore: boolean;
};

export function buildGenerationHistoryPageQuery(
  cursor: GenerationHistoryCursor | null,
  limit = GENERATION_HISTORY_PAGE_SIZE,
) {
  const fetchLimit = limit + 1;
  if (!cursor) {
    return {
      sql: `SELECT * FROM generations
            ORDER BY created_at DESC, id DESC
            LIMIT ?`,
      params: [fetchLimit] as (string | number)[],
    };
  }

  return {
    sql: `SELECT * FROM generations
          WHERE created_at < ?
             OR (created_at = ? AND id < ?)
          ORDER BY created_at DESC, id DESC
          LIMIT ?`,
    params: [
      cursor.createdAt,
      cursor.createdAt,
      cursor.id,
      fetchLimit,
    ] as (string | number)[],
  };
}

export function createGenerationHistoryPage<
  T extends GenerationHistoryCursor,
>(
  records: T[],
  limit = GENERATION_HISTORY_PAGE_SIZE,
): GenerationHistoryPage<T> {
  const pageRecords = records.slice(0, limit);
  const lastRecord = pageRecords.at(-1);
  return {
    records: pageRecords,
    nextCursor: lastRecord
      ? { createdAt: lastRecord.createdAt, id: lastRecord.id }
      : null,
    hasMore: records.length > limit,
  };
}

export function mergeGenerationHistoryRecords<T extends { id: string }>(
  current: readonly T[],
  incoming: readonly T[],
): T[] {
  const ids = new Set(current.map((record) => record.id));
  return [
    ...current,
    ...incoming.filter((record) => {
      if (ids.has(record.id)) return false;
      ids.add(record.id);
      return true;
    }),
  ];
}
