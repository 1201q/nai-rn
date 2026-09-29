// 실제 SQL을 Node 내장 SQLite로 실행하고, 파일은 메모리에 흉내 낸다.
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
  __preciseTestDb?: SqliteDatabase;
  __preciseTestFiles?: MemoryFiles;
  __preciseTestDecodeFails?: boolean;
  __preciseTestThumbnailFails?: boolean;
  __preciseTestInsertFails?: boolean;
};
const testGlobals = globalThis as TestGlobals;

jest.mock("expo-sqlite", () => ({
  openDatabaseAsync: async () => {
    const globals = globalThis as TestGlobals;
    const db = globals.__preciseTestDb!;
    const rows = (value: unknown[]) =>
      value.map((row) => ({ ...(row as Record<string, unknown>) }));
    return {
      execAsync: async (sql: string) => db.exec(sql),
      runAsync: async (sql: string, params: never[] = []) => {
        if (globals.__preciseTestInsertFails && sql.includes("INSERT")) {
          throw new Error("insert failed");
        }
        return db.prepare(sql).run(...params);
      },
      getAllAsync: async (sql: string, params: never[] = []) =>
        rows(db.prepare(sql).all(...params)),
      getFirstAsync: async (sql: string, params: never[] = []) => {
        const row = db.prepare(sql).get(...params);
        return row ? { ...(row as Record<string, unknown>) } : null;
      },
    };
  },
}));

jest.mock("expo-file-system", () => {
  const files = () => (globalThis as TestGlobals).__preciseTestFiles!;
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
        typeof parentOrUri === "string"
          ? parentOrUri.replace(/^file:\/\//, "")
          : `${parentOrUri.path}/${name}`;
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

jest.mock("expo-image-manipulator", () => ({
  SaveFormat: { JPEG: "jpeg" },
  manipulateAsync: async () => {
    const globals = globalThis as TestGlobals;
    if (globals.__preciseTestThumbnailFails) throw new Error("thumbnail");
    globals.__preciseTestFiles!.set("tmp/thumbnail.jpg", "thumbnail");
    return { uri: "tmp/thumbnail.jpg" };
  },
}));

jest.mock("@shopify/react-native-skia", () => ({
  ImageFormat: { JPEG: "jpeg", PNG: "png" },
  rect: () => ({}),
  Skia: {
    Data: { fromBase64: () => ({}) },
    Image: {
      MakeImageFromEncoded: () =>
        (globalThis as TestGlobals).__preciseTestDecodeFails
          ? null
          : { width: () => 832, height: () => 1216 },
    },
    Surface: {
      MakeOffscreen: () => ({
        getCanvas: () => ({ clear: () => {}, drawImageRect: () => {} }),
        flush: () => {},
        makeImageSnapshot: () => ({ encodeToBase64: () => "processed" }),
      }),
    },
    Color: () => 0,
    Paint: () => ({}),
  },
}));

const { DatabaseSync } = require("node:sqlite") as {
  DatabaseSync: new (path: string) => SqliteDatabase;
};

type PreciseModule = typeof import("../preciseReferences");
const ROOT = "doc/nai-references/precise";

function loadModule(): PreciseModule {
  let loaded!: PreciseModule;
  jest.isolateModules(() => {
    loaded = require("../preciseReferences") as PreciseModule;
  });
  return loaded;
}

function storedFiles() {
  return [...testGlobals.__preciseTestFiles!.keys()]
    .filter((path) => path.startsWith(ROOT))
    .sort();
}

const INPUT = {
  uri: "picked.png",
  width: 832,
  height: 1216,
  fileName: "picked.png",
};

beforeEach(() => {
  testGlobals.__preciseTestDb = new DatabaseSync(":memory:");
  testGlobals.__preciseTestFiles = new Map([
    ["picked.png", "source-image"],
    ["replacement.webp", "replacement-image"],
  ]);
  testGlobals.__preciseTestDecodeFails = false;
  testGlobals.__preciseTestThumbnailFails = false;
  testGlobals.__preciseTestInsertFails = false;
});

afterEach(() => {
  testGlobals.__preciseTestDb?.close();
});

test("adds a reference with original, thumbnail and processed files", async () => {
  const module = loadModule();

  const added = await module.addPreciseReferenceFromImage(INPUT);

  expect(added).toMatchObject({
    imagePath: `precise/originals/${added.id}.png`,
    thumbnailPath: `precise/thumbnails/${added.id}.jpg`,
    processedPath: `precise/processed/${added.id}.jpg`,
    enabled: true,
    strength: 0.6,
    fidelity: 0.6,
    referenceType: "character&style",
    processedWidth: 1024,
    processedHeight: 1536,
  });
  expect(added.id).toMatch(/^precise_\d+_[a-z0-9]+$/);
  expect(storedFiles()).toEqual([
    `${ROOT}/originals/${added.id}.png`,
    `${ROOT}/processed/${added.id}.jpg`,
    `${ROOT}/thumbnails/${added.id}.jpg`,
  ]);
  expect(testGlobals.__preciseTestFiles!.has("tmp/thumbnail.jpg")).toBe(false);
  await expect(module.listPreciseReferences()).resolves.toEqual([added]);
  await expect(module.readPreciseReferenceProcessedBase64(added)).resolves.toBe(
    "processed",
  );
  expect(module.resolvePreciseReferenceThumbnailUri(added)).toBe(
    `file://${ROOT}/thumbnails/${added.id}.jpg`,
  );
});

test("keeps the reference without a thumbnail when thumbnail creation fails", async () => {
  testGlobals.__preciseTestThumbnailFails = true;
  const module = loadModule();

  const added = await module.addPreciseReferenceFromImage(INPUT);

  expect(added.thumbnailPath).toBeNull();
  expect(module.resolvePreciseReferenceThumbnailUri(added)).toBeNull();
  expect(storedFiles()).toHaveLength(2);
});

test("removes every new file when processing fails", async () => {
  testGlobals.__preciseTestDecodeFails = true;
  const module = loadModule();

  await expect(module.addPreciseReferenceFromImage(INPUT)).rejects.toThrow(
    "Precise Reference 이미지를 처리하지 못했습니다.",
  );

  expect(storedFiles()).toEqual([]);
  await expect(module.listPreciseReferences()).resolves.toEqual([]);
});

test("removes every new file when the DB insert fails", async () => {
  testGlobals.__preciseTestInsertFails = true;
  const module = loadModule();

  await expect(module.addPreciseReferenceFromImage(INPUT)).rejects.toThrow(
    "insert failed",
  );

  expect(storedFiles()).toEqual([]);
});

test("rejects references beyond the limit", async () => {
  const module = loadModule();
  for (let index = 0; index < module.MAX_PRECISE_REFERENCES; index += 1) {
    await module.addPreciseReferenceFromImage(INPUT);
  }

  await expect(module.addPreciseReferenceFromImage(INPUT)).rejects.toThrow(
    "Precise Reference limit is 16.",
  );
});

test("replaces the image and removes the previous files", async () => {
  const module = loadModule();
  const added = await module.addPreciseReferenceFromImage(INPUT);

  const replaced = await module.replacePreciseReferenceImage(added.id, {
    uri: "replacement.webp",
    width: 1536,
    height: 1024,
    mimeType: "image/webp",
  });

  expect(replaced).toMatchObject({
    id: added.id,
    sourceWidth: 1536,
    sourceHeight: 1024,
    processedWidth: 1536,
    processedHeight: 1024,
  });
  expect(replaced!.imagePath).toMatch(
    new RegExp(`^precise/originals/${added.id}_\\d+_[a-z0-9]+\\.webp$`),
  );
  expect(storedFiles()).toEqual(
    [
      `doc/nai-references/${replaced!.imagePath}`,
      `doc/nai-references/${replaced!.thumbnailPath}`,
      `doc/nai-references/${replaced!.processedPath}`,
    ].sort(),
  );
  await expect(module.listPreciseReferences()).resolves.toEqual([replaced]);
});

test("keeps the previous image when replacement processing fails", async () => {
  const module = loadModule();
  const added = await module.addPreciseReferenceFromImage(INPUT);
  const before = storedFiles();
  testGlobals.__preciseTestDecodeFails = true;

  await expect(
    module.replacePreciseReferenceImage(added.id, {
      uri: "replacement.webp",
      width: 1536,
      height: 1024,
    }),
  ).rejects.toThrow();

  expect(storedFiles()).toEqual(before);
  await expect(module.listPreciseReferences()).resolves.toEqual([added]);
});

test("returns null when replacing a missing reference", async () => {
  const module = loadModule();

  await expect(
    module.replacePreciseReferenceImage("missing", INPUT),
  ).resolves.toBeNull();
});

test("updates only the given settings", async () => {
  const module = loadModule();
  const added = await module.addPreciseReferenceFromImage(INPUT);

  const updated = await module.updatePreciseReferenceSettings(added.id, {
    fidelity: 0.3,
    referenceType: "style",
  });

  expect(updated).toMatchObject({
    strength: 0.6,
    fidelity: 0.3,
    referenceType: "style",
  });
  await expect(
    module.updatePreciseReferenceSettings(added.id, {}),
  ).resolves.toEqual(updated);
  await expect(
    module.updatePreciseReferenceSettings("missing", { strength: 1 }),
  ).resolves.toBeNull();
});

test("deletes the row and every file", async () => {
  const module = loadModule();
  const added = await module.addPreciseReferenceFromImage(INPUT);

  await module.deletePreciseReference(added.id);

  expect(storedFiles()).toEqual([]);
  await expect(module.listPreciseReferences()).resolves.toEqual([]);
});
