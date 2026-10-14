import {
  buildGenerationHistoryPageQuery,
  createGenerationHistoryPage,
  mergeGenerationHistoryRecords,
  type GenerationHistoryCursor,
} from "../generationHistoryPage";

type SqliteDatabase = {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...params: (string | number)[]): unknown;
    all(...params: (string | number)[]): Record<string, unknown>[];
  };
  close(): void;
};
const { DatabaseSync } = require("node:sqlite") as {
  DatabaseSync: new (path: string) => SqliteDatabase;
};

function createRecord(createdAt: number, id: string) {
  return { createdAt, id };
}

describe("generation history page", () => {
  test("builds the first-page query with one lookahead record", () => {
    const query = buildGenerationHistoryPageQuery(null, 3);

    expect(query.sql).not.toContain("WHERE");
    expect(query.sql).toContain("ORDER BY created_at DESC, id DESC");
    expect(query.params).toEqual([4]);
  });

  test("builds a stable cursor query for duplicate timestamps", () => {
    const query = buildGenerationHistoryPageQuery(
      { createdAt: 100, id: "gen_b" },
      3,
    );

    expect(query.sql).toContain("(created_at, id) < (?, ?)");
    expect(query.params).toEqual([100, "gen_b", 4]);
  });

  test("returns a cursor and hasMore from the lookahead record", () => {
    const page = createGenerationHistoryPage(
      [
        createRecord(100, "gen_c"),
        createRecord(100, "gen_b"),
        createRecord(100, "gen_a"),
        createRecord(99, "gen_z"),
      ],
      3,
    );

    expect(page.records.map((record) => record.id)).toEqual([
      "gen_c",
      "gen_b",
      "gen_a",
    ]);
    expect(page.nextCursor).toEqual({ createdAt: 100, id: "gen_a" });
    expect(page.hasMore).toBe(true);
  });

  test("marks the final page and handles an empty page", () => {
    const finalPage = createGenerationHistoryPage(
      [createRecord(100, "gen_a")],
      3,
    );
    const emptyPage = createGenerationHistoryPage([], 3);

    expect(finalPage.hasMore).toBe(false);
    expect(finalPage.nextCursor).toEqual({ createdAt: 100, id: "gen_a" });
    expect(emptyPage).toEqual({
      records: [],
      nextCursor: null,
      hasMore: false,
    });
  });

  test("appends pages without duplicate records", () => {
    const merged = mergeGenerationHistoryRecords(
      [createRecord(100, "gen_c"), createRecord(100, "gen_b")],
      [createRecord(100, "gen_b"), createRecord(100, "gen_a")],
    );

    expect(merged.map((record) => record.id)).toEqual([
      "gen_c",
      "gen_b",
      "gen_a",
    ]);
  });
});

describe("generation history SQLite pagination", () => {
  let db: SqliteDatabase;

  beforeEach(() => {
    db = new DatabaseSync(":memory:");
    db.exec(`
      CREATE TABLE generations (
        id TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL,
        prompt TEXT NOT NULL
      );
      CREATE INDEX generations_created_at_id_idx
        ON generations (created_at DESC, id DESC);
    `);
    const insert = db.prepare("INSERT INTO generations VALUES (?, ?, ?)");
    for (let i = 0; i < 20; i += 1) {
      insert.run(
        `gen_${String(i).padStart(2, "0")}`,
        Math.floor(i / 4),
        "prompt",
      );
    }
  });

  afterEach(() => db.close());

  test("reads every record once across timestamp ties", () => {
    const ids: string[] = [];
    let cursor: GenerationHistoryCursor | null = null;
    let hasMore = true;
    for (let pageIndex = 0; pageIndex < 20 && hasMore; pageIndex += 1) {
      const query = buildGenerationHistoryPageQuery(cursor, 3);
      const rows = db.prepare(query.sql).all(...query.params);
      const page = createGenerationHistoryPage(
        rows.map((row) => ({
          createdAt: row.created_at as number,
          id: row.id as string,
        })),
        3,
      );
      ids.push(...page.records.map((record) => record.id));
      cursor = page.nextCursor;
      hasMore = page.hasMore;
    }

    expect(hasMore).toBe(false);
    expect(ids).toEqual(
      Array.from(
        { length: 20 },
        (_, i) => `gen_${String(19 - i).padStart(2, "0")}`,
      ),
    );
  });

  test("continues below a deleted cursor record", () => {
    db.prepare("DELETE FROM generations WHERE id = ?").run("gen_18");
    const query = buildGenerationHistoryPageQuery(
      { createdAt: 4, id: "gen_18" },
      3,
    );

    expect(
      db
        .prepare(query.sql)
        .all(...query.params)
        .map((row) => row.id),
    ).toEqual(["gen_17", "gen_16", "gen_15", "gen_14"]);
  });

  test("seeks the cursor through the composite index without sorting", () => {
    const query = buildGenerationHistoryPageQuery({
      createdAt: 1,
      id: "gen_05",
    });
    const plan = db
      .prepare(`EXPLAIN QUERY PLAN ${query.sql}`)
      .all(...query.params);
    const details = plan.map((row) => row.detail as string).join("\n");

    expect(details).toContain(
      "SEARCH generations USING INDEX generations_created_at_id_idx",
    );
    expect(details).not.toContain("SCAN generations");
    expect(details).not.toContain("TEMP B-TREE");
  });
});
