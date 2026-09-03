import * as SQLite from "expo-sqlite";

import { deleteGenerations } from "../generationHistory";

type StoredRow = {
  id: string;
  image_path: string;
  thumbnail_path: string | null;
};

const mockSharedDb = { execAsync: jest.fn() };
const mockDeleteDb = {
  getAllAsync: jest.fn(),
  runAsync: jest.fn(),
  withTransactionAsync: jest.fn(),
  closeAsync: jest.fn(),
};
const mockDeleteFile = jest.fn<void, [string]>();
const mockMissingFiles = new Set<string>();
let mockRows = new Map<string, StoredRow>();
let mockEvents: string[] = [];
let mockCommitError: Error | null = null;

jest.mock("expo-sqlite", () => ({ openDatabaseAsync: jest.fn() }));
jest.mock("expo-image-manipulator", () => ({}));
jest.mock("../novelai", () => ({}));
jest.mock("expo-file-system", () => {
  class Directory {
    uri: string;
    constructor(...parts: Array<string | { uri: string }>) {
      this.uri = parts.map((part) => typeof part === "string" ? part : part.uri).join("/");
    }
    create() {}
  }
  class File extends Directory {
    get exists() { return !mockMissingFiles.has(this.uri); }
    delete() { mockDeleteFile(this.uri); }
  }
  return { Directory, File, Paths: { document: "file:///documents" } };
});

function seedRows(count: number) {
  const rows = Array.from({ length: count }, (_, index) => ({
    id: `generation-${index}`,
    image_path: `originals/${index}.png`,
    thumbnail_path: `thumbnails/${index}.jpg`,
  }));
  mockRows = new Map(rows.map((row) => [row.id, row]));
  return rows.map((row) => row.id);
}

describe("generation history transactional deletion", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockRows = new Map();
    mockEvents = [];
    mockCommitError = null;
    mockMissingFiles.clear();
    jest.mocked(SQLite.openDatabaseAsync).mockImplementation(async (_name, options) => (
      options?.useNewConnection ? mockDeleteDb : mockSharedDb
    ) as unknown as SQLite.SQLiteDatabase);
    mockSharedDb.execAsync.mockResolvedValue(undefined);
    mockDeleteDb.closeAsync.mockImplementation(async () => { mockEvents.push("close"); });
    mockDeleteDb.getAllAsync.mockImplementation(async (_sql: string, ids: string[]) => {
      mockEvents.push("select");
      return ids.flatMap((id) => mockRows.has(id) ? [mockRows.get(id)!] : []);
    });
    mockDeleteDb.runAsync.mockImplementation(async (_sql: string, ids: string[]) => {
      mockEvents.push("delete");
      ids.forEach((id) => mockRows.delete(id));
    });
    mockDeleteDb.withTransactionAsync.mockImplementation(async (task: () => Promise<void>) => {
      const before = new Map(mockRows);
      mockEvents.push("begin");
      try {
        await task();
        if (mockCommitError) throw mockCommitError;
        mockEvents.push("commit");
      } catch (error) {
        mockRows = before;
        mockEvents.push("rollback");
        throw error;
      }
    });
    mockDeleteFile.mockImplementation(() => { mockEvents.push("file"); });
  });

  test("does nothing for an empty selection", async () => {
    await deleteGenerations([]);
    expect(SQLite.openDatabaseAsync).not.toHaveBeenCalled();
    expect(mockDeleteDb.withTransactionAsync).not.toHaveBeenCalled();
    expect(mockDeleteFile).not.toHaveBeenCalled();
  });

  test.each([1, 299, 300, 301, 601])("deletes %i IDs in bounded queries within one transaction", async (count) => {
    const ids = seedRows(count);
    const untouched = { id: "keep", image_path: "originals/keep.png", thumbnail_path: null };
    mockRows.set(untouched.id, untouched);

    await deleteGenerations(ids);

    expect(SQLite.openDatabaseAsync).toHaveBeenLastCalledWith(
      "generation-history.db", { useNewConnection: true },
    );
    expect(mockDeleteDb.withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(mockDeleteDb.getAllAsync).toHaveBeenCalledTimes(Math.ceil(count / 300));
    expect(mockDeleteDb.runAsync).toHaveBeenCalledTimes(Math.ceil(count / 300));
    for (const query of [mockDeleteDb.getAllAsync, mockDeleteDb.runAsync]) {
      expect(query.mock.calls.flatMap(([, params]) => params)).toEqual(ids);
      for (const [sql, params] of query.mock.calls) {
        expect(params.length).toBeLessThanOrEqual(300);
        expect(sql.match(/\?/g)).toHaveLength(params.length);
      }
    }
    expect(mockDeleteDb.getAllAsync.mock.calls[0][0]).toMatch(/^SELECT image_path, thumbnail_path /);
    expect([...mockRows.values()]).toEqual([untouched]);
    expect(mockDeleteFile).toHaveBeenCalledTimes(count * 2);
    expect(mockEvents.indexOf("commit")).toBeLessThan(mockEvents.indexOf("file"));
    expect(mockDeleteDb.closeAsync).toHaveBeenCalledTimes(1);
  });

  test("deduplicates across batches and ignores IDs missing from storage", async () => {
    const ids = seedRows(301);
    await deleteGenerations([...ids, ...ids, "missing"]);

    expect(mockDeleteDb.runAsync.mock.calls.flatMap(([, params]) => params))
      .toEqual([...ids, "missing"]);
    expect(mockDeleteFile).toHaveBeenCalledTimes(602);
    expect(new Set(mockDeleteFile.mock.calls.map(([path]) => path)).size).toBe(602);
  });

  test.each(["getAllAsync", "runAsync"] as const)(
    "rolls back earlier batches on a later %s failure without touching files",
    async (method) => {
      const ids = seedRows(601);
      const before = new Map(mockRows);
      const query = mockDeleteDb[method];
      query.mockImplementationOnce(query.getMockImplementation()!)
        .mockRejectedValueOnce(new Error("query failed"));

      await expect(deleteGenerations(ids)).rejects.toThrow("query failed");

      expect(mockDeleteDb.runAsync).toHaveBeenCalled();
      expect(mockRows).toEqual(before);
      expect(mockEvents).toContain("rollback");
      expect(mockEvents).not.toContain("commit");
      expect(mockDeleteFile).not.toHaveBeenCalled();
      expect(mockDeleteDb.closeAsync).toHaveBeenCalledTimes(1);

      await deleteGenerations(ids);
      expect(mockRows.size).toBe(0);
      expect(mockDeleteFile).toHaveBeenCalledTimes(1202);
      expect(mockDeleteDb.closeAsync).toHaveBeenCalledTimes(2);
    },
  );

  test("does not touch files when committing fails", async () => {
    const ids = seedRows(301);
    const before = new Map(mockRows);
    mockCommitError = new Error("commit failed");

    await expect(deleteGenerations(ids)).rejects.toThrow("commit failed");

    expect(mockRows).toEqual(before);
    expect(mockDeleteFile).not.toHaveBeenCalled();
    expect(mockDeleteDb.closeAsync).toHaveBeenCalledTimes(1);
  });

  test("does not clean up files before the transaction promise resolves", async () => {
    const ids = seedRows(1);
    let commit!: () => void;
    let ready!: () => void;
    const commitGate = new Promise<void>((resolve) => { commit = resolve; });
    const queriesFinished = new Promise<void>((resolve) => { ready = resolve; });
    mockDeleteDb.withTransactionAsync.mockImplementation(async (task: () => Promise<void>) => {
      await task();
      ready();
      await commitGate;
    });

    const deletion = deleteGenerations(ids);
    await queriesFinished;
    expect(mockDeleteFile).not.toHaveBeenCalled();
    expect(mockDeleteDb.closeAsync).not.toHaveBeenCalled();

    commit();
    await deletion;
    expect(mockDeleteFile).toHaveBeenCalledTimes(2);
  });

  test("continues cleanup after a missing file or cleanup error", async () => {
    const ids = seedRows(3);
    mockRows.get(ids[0])!.thumbnail_path = null;
    mockMissingFiles.add("file:///documents/nai-images/originals/0.png");
    mockDeleteFile.mockImplementationOnce(() => { throw new Error("file locked"); });

    await expect(deleteGenerations(ids)).resolves.toBeUndefined();

    expect(mockRows.size).toBe(0);
    expect(mockDeleteFile).toHaveBeenCalledTimes(4);
    expect(mockDeleteFile).toHaveBeenLastCalledWith(
      "file:///documents/nai-images/thumbnails/2.jpg",
    );
  });
});
