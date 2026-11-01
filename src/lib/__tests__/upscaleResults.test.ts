import { File } from "expo-file-system";
import { storage } from "../storage";
import {
  loadUpscaleResults,
  persistUpscaleResults,
  pruneUpscaleResults,
  removeUpscaleResult,
  retainUpscaleResult,
} from "../upscaleResults";
import type { UpscaleQueueItem } from "../../store/upscaleQueueStore";
const mockFiles = new Set<string>();
let mockTrailingSlash = false;
const mockValues = new Map<string, string>();
const mockDeleted: string[] = [];
jest.mock("../storage", () => ({
  storage: {
    getString: (key: string) => mockValues.get(key),
    set: (key: string, value: string) => mockValues.set(key, value),
  },
}));
jest.mock("expo-file-system", () => {
  class MockFile {
    uri: string;
    constructor(root: string | { uri: string }, name?: string) {
      this.uri =
        (typeof root === "string" ? root : root.uri).replace(/\/+$/, "") +
        (name ? "/" + name : "");
    }
    get exists() {
      return mockFiles.has(this.uri);
    }
    move(target: MockFile) {
      if (!this.exists) throw new Error("missing");
      mockFiles.delete(this.uri);
      mockFiles.add(target.uri);
    }
    delete() {
      mockDeleted.push(this.uri);
      mockFiles.delete(this.uri);
    }
  }
  return {
    Paths: { document: "file:///documents" },
    File: MockFile,
    Directory: class {
      uri: string;
      constructor(root: string, name: string) {
        this.uri = root + "/" + name + (mockTrailingSlash ? "/" : "");
      }
      exists = true;
      create() {}
      list() {
        return [...mockFiles]
          .filter((uri) => uri.startsWith(this.uri + "/"))
          .map((uri) => new MockFile(uri));
      }
    },
  };
});
function item(): UpscaleQueueItem {
  return {
    id: "upscale_test",
    uri: "file:///input.png",
    width: 100,
    height: 100,
    status: "done",
    saved: false,
    saving: true,
    result: {
      uri: "file:///documents/upscale-results/upscale_test.png",
      width: 200,
      height: 200,
      bytes: 100,
      elapsedMs: 10,
      usedGpu: false,
      cpuThreads: 1,
      cpuPolicy: 0,
      tileSize: 32,
    },
    output: { format: "png", albumName: "Results", keepOriginalFilename: true },
  };
}
beforeEach(() => {
  mockTrailingSlash = false;
  mockFiles.clear();
  mockValues.clear();
  mockDeleted.length = 0;
});

test("moves completed output into private durable storage", () => {
  mockFiles.add("file:///output.png");
  const result = retainUpscaleResult(
    "file:///output.png",
    "upscale_test",
    "png",
  );
  expect(result).toBe("file:///documents/upscale-results/upscale_test.png");
  expect(new File(result).exists).toBe(true);
  expect(mockFiles.has("file:///output.png")).toBe(false);
});

test("restores unsaved results across app restarts and clears transient saving state", () => {
  const completed = item();
  mockFiles.add(completed.result!.uri!);
  persistUpscaleResults([
    completed,
    { ...completed, id: "pending", status: "pending" },
  ]);
  expect(loadUpscaleResults()).toEqual([{ ...completed, saving: false }]);
  mockFiles.clear();
  expect(loadUpscaleResults()).toEqual([]);
});

test("only deletes direct children owned by the result manager", () => {
  mockFiles.add(item().result!.uri!);
  removeUpscaleResult("file:///original.png");
  removeUpscaleResult(
    "file:///documents/upscale-results/../upscale_external.png",
  );
  expect(mockDeleted).toEqual([]);
  removeUpscaleResult(item().result!.uri);
  expect(mockDeleted).toEqual([item().result!.uri]);
});

test("does not delete recoverable files when the manifest is corrupt", () => {
  mockFiles.add(item().result!.uri!);
  storage.set("upscale-results-v1", "invalid-json");
  pruneUpscaleResults([]);
  expect(mockDeleted).toEqual([]);
});

test("prunes orphan files while retaining manifest results and unrelated files", () => {
  const completed = item();
  mockFiles.add(completed.result!.uri!);
  mockFiles.add("file:///documents/upscale-results/upscale_orphan.jpg");
  mockFiles.add("file:///documents/upscale-results/notes.txt");
  persistUpscaleResults([completed]);
  pruneUpscaleResults([completed]);
  expect(mockDeleted).toEqual([
    "file:///documents/upscale-results/upscale_orphan.jpg",
  ]);
});

test("retains, restores and removes results with Android's trailing-slash directory URIs", () => {
  mockTrailingSlash = true;
  mockFiles.add("file:///output.png");
  const uri = retainUpscaleResult("file:///output.png", "upscale_test", "png");
  const completed = { ...item(), result: { ...item().result!, uri } };
  persistUpscaleResults([completed]);
  expect(loadUpscaleResults()).toHaveLength(1);
  removeUpscaleResult(uri);
  expect(mockFiles.has(uri)).toBe(false);
});
