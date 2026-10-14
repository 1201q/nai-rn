import { File } from "expo-file-system";
import { ImageFormat, Skia } from "@shopify/react-native-skia";

import {
  deleteStoredI2IReference,
  renderI2IRequestImageBase64,
  resolveStoredI2IReference,
  saveI2IReferenceImage,
} from "../i2iReference";

type TestGlobals = typeof globalThis & { __i2iTestFiles?: Map<string, string> };
const testGlobals = globalThis as TestGlobals;

jest.mock("@shopify/react-native-skia", () => ({
  ImageFormat: { PNG: "png" },
  rect: (x: number, y: number, width: number, height: number) => ({
    x,
    y,
    width,
    height,
  }),
  Skia: {
    Data: { fromBytes: jest.fn() },
    Image: { MakeImageFromEncoded: jest.fn() },
    Surface: { MakeOffscreen: jest.fn() },
    Color: jest.fn(() => 0),
    Paint: () => ({}),
  },
}));
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
    async bytes() {
      const content = files().get(this.path);
      if (content === undefined) throw new Error(`missing ${this.path}`);
      return Uint8Array.from(content, (char) => char.charCodeAt(0));
    }
  }
  return { Directory, File, Paths: { document: { path: "doc" } } };
});

describe("renderI2IRequestImageBase64", () => {
  const disposalOrder: string[] = [];
  const data = { dispose: jest.fn(() => disposalOrder.push("data")) };
  const image = {
    width: () => 832,
    height: () => 1216,
    dispose: jest.fn(() => disposalOrder.push("image")),
  };
  const canvas = { clear: jest.fn(), drawImageRect: jest.fn() };
  const snapshot = {
    encodeToBase64: jest.fn(),
    dispose: jest.fn(() => disposalOrder.push("snapshot")),
  };
  const surface = {
    getCanvas: () => canvas,
    flush: jest.fn(),
    makeImageSnapshot: jest.fn(() => snapshot),
    dispose: jest.fn(() => disposalOrder.push("surface")),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    disposalOrder.length = 0;
    jest.mocked(Skia.Data.fromBytes).mockReturnValue(data as never);
    jest
      .mocked(Skia.Image.MakeImageFromEncoded)
      .mockReturnValue(image as never);
    jest.mocked(Skia.Surface.MakeOffscreen).mockReturnValue(surface as never);
    snapshot.encodeToBase64.mockReturnValue("request-png");
  });

  afterEach(() => jest.restoreAllMocks());

  test("reads source bytes, stretches on white, and releases resources after PNG encoding", async () => {
    const base64Read = jest.spyOn(File.prototype, "base64");
    const result = await renderI2IRequestImageBase64("picked", 1024, 1536);

    expect(result).toBe("request-png");
    expect(base64Read).not.toHaveBeenCalled();
    expect(Skia.Data.fromBytes).toHaveBeenCalledWith(
      Uint8Array.from("source-image", (char) => char.charCodeAt(0)),
    );
    expect(Skia.Color).toHaveBeenCalledWith("#FFFFFF");
    expect(canvas.drawImageRect).toHaveBeenCalledWith(
      image,
      { x: 0, y: 0, width: 832, height: 1216 },
      { x: 0, y: 0, width: 1024, height: 1536 },
      {},
      false,
    );
    expect(snapshot.encodeToBase64).toHaveBeenCalledWith(ImageFormat.PNG);
    expect(disposalOrder).toEqual(["snapshot", "surface", "image", "data"]);
  });

  test("releases every allocated resource when encoding fails", async () => {
    snapshot.encodeToBase64.mockImplementationOnce(() => {
      throw new Error("encode failed");
    });
    await expect(
      renderI2IRequestImageBase64("picked", 1024, 1536),
    ).rejects.toThrow("encode failed");
    expect(disposalOrder).toEqual(["snapshot", "surface", "image", "data"]);
  });

  test("does not allocate a surface for an undecodable source", async () => {
    jest.mocked(Skia.Image.MakeImageFromEncoded).mockReturnValue(null);
    await expect(
      renderI2IRequestImageBase64("picked", 1024, 1536),
    ).rejects.toThrow("I2I");
    expect(Skia.Surface.MakeOffscreen).not.toHaveBeenCalled();
    expect(disposalOrder).toEqual(["data"]);
  });
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
