import {
  deleteStoredI2IReference,
  resolveStoredI2IReference,
  saveI2IReferenceImage,
} from "../i2iReference";

type TestGlobals = typeof globalThis & { __i2iTestFiles?: Map<string, string> };
const testGlobals = globalThis as TestGlobals;

jest.mock("@shopify/react-native-skia", () => ({}));
jest.mock("expo-file-system", () => {
  const files = () => (globalThis as TestGlobals).__i2iTestFiles!;
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
          ? parentOrUri
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

const ROOT = "doc/nai-references";

beforeEach(() => {
  testGlobals.__i2iTestFiles = new Map([["picked", "source-image"]]);
});

test("copies the picked image into the managed i2i directory", async () => {
  const saved = await saveI2IReferenceImage({
    uri: "picked",
    width: 832,
    height: 1216,
    mimeType: "image/webp",
  });

  expect(saved.storagePath).toMatch(/^i2i\/source_\d+_[a-z0-9]+\.webp$/);
  expect(saved).toMatchObject({
    uri: `file://${ROOT}/${saved.storagePath}`,
    width: 832,
    height: 1216,
  });
  expect(testGlobals.__i2iTestFiles!.get(`${ROOT}/${saved.storagePath}`)).toBe(
    "source-image",
  );
});

test.each([
  ["image.PNG", undefined, "png"],
  ["image.jpeg", undefined, "jpg"],
  [undefined, "image/png", "png"],
  [undefined, undefined, "jpg"],
])("uses the extension for %s / %s", async (fileName, mimeType, extension) => {
  const saved = await saveI2IReferenceImage({
    uri: "picked",
    width: 1,
    height: 1,
    fileName,
    mimeType,
  });

  expect(saved.storagePath.endsWith(`.${extension}`)).toBe(true);
});

test("resolves only existing files inside the i2i directory", () => {
  testGlobals.__i2iTestFiles!.set(`${ROOT}/i2i/source.png`, "image");
  const size = { width: 832, height: 1216 };

  expect(
    resolveStoredI2IReference({ storagePath: "i2i/source.png", ...size }),
  ).toEqual({
    storagePath: "i2i/source.png",
    uri: `file://${ROOT}/i2i/source.png`,
    ...size,
  });
  expect(
    resolveStoredI2IReference({ storagePath: "i2i/missing.png", ...size }),
  ).toBeNull();
  for (const storagePath of [
    "vibes/originals/source.png",
    "i2i/..",
    "i2i/nested/source.png",
    "source.png",
  ]) {
    expect(resolveStoredI2IReference({ storagePath, ...size })).toBeNull();
  }
});

test("deletes only managed i2i files", () => {
  testGlobals.__i2iTestFiles!.set(`${ROOT}/i2i/source.png`, "image");
  testGlobals.__i2iTestFiles!.set(`${ROOT}/vibes/originals/v.png`, "vibe");

  deleteStoredI2IReference("vibes/originals/v.png");
  deleteStoredI2IReference(null);
  deleteStoredI2IReference("i2i/source.png");

  expect([...testGlobals.__i2iTestFiles!.keys()].sort()).toEqual([
    `${ROOT}/vibes/originals/v.png`,
    "picked",
  ]);
});
