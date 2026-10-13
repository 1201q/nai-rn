import { encodeNovelAiVibe } from "../novelai";

class FakeXhr {
  static current: FakeXhr;
  static sendError: Error | null = null;
  status = 200;
  response = new Uint8Array([1, 2, 3]).buffer;
  responseType = "";
  timeout = 0;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  constructor() {
    FakeXhr.current = this;
  }
  open = jest.fn();
  setRequestHeader = jest.fn();
  abort = jest.fn(() => this.onabort?.());
  send = jest.fn<void, [string]>(() => {
    if (FakeXhr.sendError) throw FakeXhr.sendError;
  });
}

const originalXhr = globalThis.XMLHttpRequest;
beforeEach(() => {
  FakeXhr.sendError = null;
  globalThis.XMLHttpRequest = FakeXhr as unknown as typeof XMLHttpRequest;
});
afterEach(() => {
  globalThis.XMLHttpRequest = originalXhr;
  jest.restoreAllMocks();
});

function encode(signal?: AbortSignal) {
  return encodeNovelAiVibe(
    "Bearer token",
    "data:image/png;base64,image",
    0.7,
    "model",
    signal,
  );
}

function expectCleanedUp(xhr: FakeXhr) {
  expect(xhr.onload).toBeNull();
  expect(xhr.onerror).toBeNull();
  expect(xhr.onabort).toBeNull();
  expect(xhr.ontimeout).toBeNull();
}

test("returns binary encoding and releases its abort subscription", async () => {
  const controller = new AbortController();
  const remove = jest.spyOn(controller.signal, "removeEventListener");
  const request = encode(controller.signal);
  const xhr = FakeXhr.current;
  expect(xhr.timeout).toBe(120_000);
  expect(xhr.responseType).toBe("arraybuffer");
  expect(xhr.setRequestHeader).toHaveBeenCalledWith(
    "Authorization",
    "Bearer token",
  );
  expect(JSON.parse(xhr.send.mock.calls[0][0] as string)).toEqual({
    image: "image",
    model: "model",
    information_extracted: 0.7,
  });
  xhr.onload?.();
  await expect(request).resolves.toBe("AQID");
  expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
  expectCleanedUp(xhr);
  controller.abort();
  expect(xhr.abort).not.toHaveBeenCalled();
});

test("rejects a pre-aborted request without sending it", async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(encode(controller.signal)).rejects.toMatchObject({
    name: "AbortError",
  });
  expect(FakeXhr.current.send).not.toHaveBeenCalled();
  expectCleanedUp(FakeXhr.current);
});

test("aborts a pending request and ignores its late response", async () => {
  const controller = new AbortController();
  const request = encode(controller.signal);
  const xhr = FakeXhr.current;
  const lateResponse = xhr.onload;
  controller.abort();
  lateResponse?.();
  await expect(request).rejects.toMatchObject({ name: "AbortError" });
  expect(xhr.abort).toHaveBeenCalledTimes(1);
  expectCleanedUp(xhr);
});

test.each(["timeout", "network", "native-abort"])(
  "settles and cleans up after %s",
  async (event) => {
    const controller = new AbortController();
    const remove = jest.spyOn(controller.signal, "removeEventListener");
    const request = encode(controller.signal);
    const xhr = FakeXhr.current;
    if (event === "timeout") xhr.ontimeout?.();
    else if (event === "network") xhr.onerror?.();
    else xhr.onabort?.();
    await expect(request).rejects.toThrow(
      event === "timeout"
        ? "시간이 초과"
        : event === "network"
          ? "network error"
          : "cancelled",
    );
    expectCleanedUp(xhr);
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
  },
);

test("preserves the HTTP status and cleans up a rejected response", async () => {
  const request = encode();
  const xhr = FakeXhr.current;
  xhr.status = 403;
  xhr.onload?.();
  await expect(request).rejects.toMatchObject({
    name: "NovelAiRequestError",
    status: 403,
  });
  expectCleanedUp(xhr);
});

test("cleans up when sending throws synchronously", async () => {
  FakeXhr.sendError = new Error("send failed");
  await expect(encode()).rejects.toThrow("send failed");
  expectCleanedUp(FakeXhr.current);
});
