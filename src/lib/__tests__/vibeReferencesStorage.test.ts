// 실제 SQL을 Node 내장 SQLite로 실행하고, 파일은 메모리에 흉내 낸다.
// @types/node 없이 쓰기 위한 node:sqlite 최소 타입.
type SqliteStatement = {
  run(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
  get(...params: unknown[]): unknown;
};
type SqliteDatabase = {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
  close(): void;
};
type MemoryFiles = Map<string, string>;
type TestGlobals = typeof globalThis & {
  __vibeTestDb?: SqliteDatabase;
  __vibeTestFiles?: MemoryFiles;
};
const testGlobals = globalThis as TestGlobals;

jest.mock("expo-sqlite", () => ({
  openDatabaseAsync: async () => {
    const db = (globalThis as TestGlobals).__vibeTestDb!;
    const rows = (value: unknown[]) =>
      value.map((row) => ({ ...(row as Record<string, unknown>) }));
    return {
      execAsync: async (sql: string) => db.exec(sql),
      runAsync: async (sql: string, params: never[] = []) =>
        db.prepare(sql).run(...params),
      getAllAsync: async (sql: string, params: never[] = []) =>
        rows(db.prepare(sql).all(...params)),
      getFirstAsync: async (sql: string, params: never[] = []) => {
        const row = db.prepare(sql).get(...params);
        return row ? { ...(row as Record<string, unknown>) } : null;
      },
      withTransactionAsync: async (task: () => Promise<void>) => {
        db.exec("BEGIN");
        try {
          await task();
          db.exec("COMMIT");
        } catch (error) {
          db.exec("ROLLBACK");
          throw error;
        }
      },
    };
  },
}));

jest.mock("expo-file-system", () => {
  const files = () => (globalThis as TestGlobals).__vibeTestFiles!;
  class Directory {
    path: string;
    constructor(parent: { path: string }, name: string) {
      this.path = `${parent.path}/${name}`;
    }
    create() {}
  }
  class File {
    path: string;
    constructor(parentOrUri: { path: string } | string, name?: string) {
      this.path =
        typeof parentOrUri === "string" ? parentOrUri : `${parentOrUri.path}/${name}`;
    }
    get uri() {
      return `file://${this.path}`;
    }
    get exists() {
      return files().has(this.path);
    }
    create() {
      files().set(this.path, "");
    }
    write(content: string) {
      files().set(this.path, content);
    }
    delete() {
      files().delete(this.path);
    }
    async base64() {
      const content = files().get(this.path);
      if (content === undefined) throw new Error(`missing ${this.path}`);
      return content;
    }
  }
  return { Directory, File, Paths: { document: { path: "doc" } } };
});

jest.mock("expo-image-manipulator", () => ({}));

const { DatabaseSync } = require("node:sqlite") as {
  DatabaseSync: new (path: string) => SqliteDatabase;
};

type VibeModule = typeof import("../vibeReferences");
const ENCODED_DIR = "doc/nai-references/vibes/encoded";

function loadModule(): VibeModule {
  let loaded!: VibeModule;
  jest.isolateModules(() => {
    loaded = require("../vibeReferences") as VibeModule;
  });
  return loaded;
}

function insertReference(
  db: SqliteDatabase,
  id: string,
  extra: Record<string, unknown> = {},
) {
  const values: Record<string, unknown> = {
    id,
    image_path: `vibes/originals/${id}.png`,
    thumbnail_path: null,
    enabled: 1,
    strength: 0.6,
    information_extracted: 0.7,
    created_at: 1,
    updated_at: 1,
    ...extra,
  };
  const columns = Object.keys(values);
  db.prepare(
    `INSERT INTO vibe_references (${columns.join(", ")}) VALUES (${columns
      .map(() => "?")
      .join(", ")})`,
  ).run(...(Object.values(values) as never[]));
}

beforeEach(() => {
  testGlobals.__vibeTestDb = new DatabaseSync(":memory:");
  testGlobals.__vibeTestFiles = new Map();
});

afterEach(() => {
  testGlobals.__vibeTestDb?.close();
});

test("moves the legacy single cache into the per-model table", async () => {
  const db = testGlobals.__vibeTestDb!;
  // encoded_model 컬럼이 없던 초기 스키마
  db.exec(`CREATE TABLE vibe_references (
    id TEXT PRIMARY KEY, image_path TEXT NOT NULL, thumbnail_path TEXT,
    encoded_path TEXT, enabled INTEGER NOT NULL, strength REAL NOT NULL,
    information_extracted REAL NOT NULL, encoded_information_extracted REAL,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`);
  insertReference(db, "legacy", {
    encoded_path: "vibes/encoded/legacy.bin",
    encoded_information_extracted: 0.7,
  });
  insertReference(db, "plain");

  const { listVibeReferences, canUseCachedVibeEncoding } = loadModule();
  const references = await listVibeReferences();

  const legacy = references.find((item) => item.id === "legacy")!;
  expect(legacy.encodings).toEqual([
    {
      model: "nai-diffusion-4-5-full",
      informationExtracted: 0.7,
      path: "vibes/encoded/legacy.bin",
    },
  ]);
  expect(canUseCachedVibeEncoding(legacy, "nai-diffusion-4-5-full")).toBe(true);
  expect(references.find((item) => item.id === "plain")!.encodings).toEqual([]);
  expect(
    db.prepare("SELECT encoded_path FROM vibe_references WHERE id = 'legacy'").get(),
  ).toEqual(expect.objectContaining({ encoded_path: null }));

  // 두 번째 실행에서도 중복 이전되지 않는다
  const reloaded = await loadModule().listVibeReferences();
  expect(reloaded.find((item) => item.id === "legacy")!.encodings).toHaveLength(1);
});

test("keeps other models' caches and replaces only the same model", async () => {
  const module = loadModule();
  await module.initVibeReferenceStorage();
  insertReference(testGlobals.__vibeTestDb!, "vibe");

  await module.saveEncodedVibeReference("vibe", "full-v1", 0.7, "nai-diffusion-4-5-full");
  await module.saveEncodedVibeReference("vibe", "curated", 0.7, "nai-diffusion-4-5-curated");
  const saved = await module.saveEncodedVibeReference(
    "vibe", "full-v2", 0.7, "nai-diffusion-4-5-full",
  );

  expect(saved!.encodings.map((item) => item.model).sort()).toEqual([
    "nai-diffusion-4-5-curated",
    "nai-diffusion-4-5-full",
  ]);
  const [reference] = await module.listVibeReferences();
  await expect(
    module.readEncodedVibeReferenceBase64(reference, "nai-diffusion-4-5-full"),
  ).resolves.toBe("full-v2");
  await expect(
    module.readEncodedVibeReferenceBase64(reference, "nai-diffusion-4-5-curated"),
  ).resolves.toBe("curated");
  // 교체된 full-v1 파일은 지워지고 두 파일만 남는다
  const encodedFiles = [...testGlobals.__vibeTestFiles!.keys()].filter((path) =>
    path.startsWith(ENCODED_DIR),
  );
  expect(encodedFiles).toHaveLength(2);
});

test("clears every model's cache when Information Extracted changes", async () => {
  const module = loadModule();
  await module.initVibeReferenceStorage();
  insertReference(testGlobals.__vibeTestDb!, "vibe");
  await module.saveEncodedVibeReference("vibe", "full", 0.7, "nai-diffusion-4-5-full");
  await module.saveEncodedVibeReference("vibe", "curated", 0.7, "nai-diffusion-4-5-curated");

  const updated = await module.updateVibeReferenceSettings("vibe", {
    informationExtracted: 0.5,
  });

  expect(updated!.encodings).toEqual([]);
  expect(
    [...testGlobals.__vibeTestFiles!.keys()].filter((path) => path.startsWith(ENCODED_DIR)),
  ).toEqual([]);
});

test("removes cache rows and files when a reference is deleted", async () => {
  const module = loadModule();
  await module.initVibeReferenceStorage();
  insertReference(testGlobals.__vibeTestDb!, "vibe");
  await module.saveEncodedVibeReference("vibe", "full", 0.7, "nai-diffusion-4-5-full");

  await module.deleteVibeReference("vibe");

  expect(
    testGlobals.__vibeTestDb!
      .prepare("SELECT COUNT(*) AS count FROM vibe_reference_encodings")
      .get(),
  ).toEqual(expect.objectContaining({ count: 0 }));
  expect(
    [...testGlobals.__vibeTestFiles!.keys()].filter((path) => path.startsWith(ENCODED_DIR)),
  ).toEqual([]);
});
