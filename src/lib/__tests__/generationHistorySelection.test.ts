import * as SQLite from "expo-sqlite";

import { iterateGenerationImageBatches, listGenerationIds } from "../generationHistory";

const mockDb = { execAsync: jest.fn(), getAllAsync: jest.fn() };

jest.mock("expo-sqlite", () => ({ openDatabaseAsync: jest.fn() }));
jest.mock("expo-image-manipulator", () => ({}));
jest.mock("../novelai", () => ({}));
jest.mock("expo-file-system", () => ({
  Directory: class { create() {} },
  Paths: { document: "file:///documents" },
}));

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(SQLite.openDatabaseAsync).mockResolvedValue(mockDb as unknown as SQLite.SQLiteDatabase);
  mockDb.execAsync.mockResolvedValue(undefined);
  mockDb.getAllAsync.mockImplementation(async (_sql: string, ids: string[] = []) => (
    [...ids].reverse().map((id) => ({ id, image_path: `originals/${id}.png` }))
  ));
});

test("queries only all IDs in history order, without pagination or image metadata", async () => {
  mockDb.getAllAsync.mockResolvedValueOnce([{ id: "new" }, { id: "old" }]);
  expect(await listGenerationIds()).toEqual(["new", "old"]);
  expect(mockDb.getAllAsync).toHaveBeenCalledWith(
    "SELECT id FROM generations ORDER BY created_at DESC, id DESC",
  );
});

test("handles an empty database and propagates ID query failures for retry", async () => {
  mockDb.getAllAsync.mockRejectedValueOnce(new Error("query failed"));
  await expect(listGenerationIds()).rejects.toThrow("query failed");
  await expect(listGenerationIds()).resolves.toEqual([]);
});

test("does not query paths for an empty selection", async () => {
  for await (const _batch of iterateGenerationImageBatches([])) {
    throw new Error("Unexpected batch");
  }
  expect(mockDb.getAllAsync).not.toHaveBeenCalled();
});

test.each([1, 299, 300, 301, 601])("streams paths for %i IDs in bounded queries and preserves selection order", async (count) => {
  const ids = Array.from({ length: count }, (_, index) => `gen-${index}`);
  const records = [];
  for await (const batch of iterateGenerationImageBatches(ids)) {
    expect(batch.length).toBeLessThanOrEqual(300);
    records.push(...batch);
  }
  expect(records).toEqual(ids.map((id) => ({ id, imagePath: `originals/${id}.png` })));
  expect(mockDb.getAllAsync).toHaveBeenCalledTimes(Math.ceil(count / 300));
  expect(mockDb.getAllAsync.mock.calls.flatMap(([, params]) => params)).toEqual(ids);
  for (const [sql, params] of mockDb.getAllAsync.mock.calls) {
    expect(sql).toMatch(/^SELECT id, image_path FROM generations WHERE id IN /);
    expect(params.length).toBeLessThanOrEqual(300);
    expect(sql.match(/\?/g)).toHaveLength(params.length);
  }
});

test("deduplicates IDs and exposes missing paths instead of silently dropping failures", async () => {
  mockDb.getAllAsync.mockResolvedValueOnce([{ id: "exists", image_path: "originals/exists.png" }]);
  const batches = [];
  for await (const batch of iterateGenerationImageBatches(["exists", "missing", "exists"])) {
    batches.push(batch);
  }
  expect(batches).toEqual([[{ id: "exists", imagePath: "originals/exists.png" }, { id: "missing", imagePath: null }]]);
  expect(mockDb.getAllAsync.mock.calls[0][1]).toEqual(["exists", "missing"]);
});

test("does not fetch the next batch before it is consumed", async () => {
  const ids = Array.from({ length: 601 }, (_, index) => `gen-${index}`);
  const batches = iterateGenerationImageBatches(ids);
  expect(mockDb.getAllAsync).not.toHaveBeenCalled();
  await batches.next();
  expect(mockDb.getAllAsync).toHaveBeenCalledTimes(1);
  await batches.next();
  expect(mockDb.getAllAsync).toHaveBeenCalledTimes(2);
  await batches.return();
  expect(mockDb.getAllAsync).toHaveBeenCalledTimes(2);
});

test("propagates later batch query failures without fetching further batches", async () => {
  const ids = Array.from({ length: 601 }, (_, index) => `gen-${index}`);
  mockDb.getAllAsync.mockImplementationOnce(mockDb.getAllAsync.getMockImplementation()!)
    .mockRejectedValueOnce(new Error("batch failed"));
  const batches = iterateGenerationImageBatches(ids);
  expect((await batches.next()).value).toHaveLength(300);
  await expect(batches.next()).rejects.toThrow("batch failed");
  expect(mockDb.getAllAsync).toHaveBeenCalledTimes(2);
});
