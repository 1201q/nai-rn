import {
  buildGenerationHistoryPageQuery,
  createGenerationHistoryPage,
  mergeGenerationHistoryRecords,
} from "../generationHistoryPage";

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

    expect(query.sql).toContain("created_at < ?");
    expect(query.sql).toContain("created_at = ? AND id < ?");
    expect(query.params).toEqual([100, 100, "gen_b", 4]);
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
