import * as SQLite from "expo-sqlite";

jest.mock("expo-sqlite", () => ({
  importDatabaseFromAssetAsync: jest.fn(),
  openDatabaseAsync: jest.fn(),
  deleteDatabaseAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../../../assets/tags.db", () => 1);

function loadModule(): typeof import("../tagDb") {
  let loaded!: typeof import("../tagDb");
  jest.isolateModules(() => {
    loaded = require("../tagDb");
  });
  return loaded;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(SQLite.importDatabaseFromAssetAsync)
    .mockReset()
    .mockResolvedValue(undefined);
  jest.mocked(SQLite.openDatabaseAsync).mockReset();
});

test.each(["import", "open"])(
  "retries after a temporary DB %s failure and retains the successful connection",
  async (failure) => {
    const query = jest
      .fn()
      .mockResolvedValue([{ label: "cat", count: 10, type: "general" }]);
    const db = { getAllAsync: query } as unknown as SQLite.SQLiteDatabase;
    if (failure === "import") {
      jest
        .mocked(SQLite.importDatabaseFromAssetAsync)
        .mockRejectedValueOnce(new Error("import failed"));
      jest.mocked(SQLite.openDatabaseAsync).mockResolvedValue(db);
    } else {
      jest
        .mocked(SQLite.openDatabaseAsync)
        .mockRejectedValueOnce(new Error("open failed"))
        .mockResolvedValue(db);
    }
    const { searchTags } = loadModule();
    const attempts = [searchTags("cat"), searchTags("dog")];
    await expect(Promise.all(attempts)).rejects.toThrow(`${failure} failed`);
    expect(SQLite.importDatabaseFromAssetAsync).toHaveBeenCalledTimes(1);
    await expect(searchTags("cat")).resolves.toEqual([
      { label: "cat", value: "cat", count: 10, type: "general" },
    ]);
    await searchTags("dog");
    expect(SQLite.importDatabaseFromAssetAsync).toHaveBeenCalledTimes(2);
    expect(SQLite.openDatabaseAsync).toHaveBeenCalledTimes(
      failure === "import" ? 1 : 2,
    );
  },
);
