import {
  createKeyedMutationQueue,
  createMutationVersionTracker,
} from "../referenceMutation";

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("createKeyedMutationQueue", () => {
  test("runs mutations for the same key in order", async () => {
    const queue = createKeyedMutationQueue();
    const first = createDeferred<void>();
    const calls: string[] = [];

    const firstResult = queue.run(["reference"], async () => {
      calls.push("first:start");
      await first.promise;
      calls.push("first:end");
    });
    const secondResult = queue.run(["reference"], async () => {
      calls.push("second");
    });

    await Promise.resolve();
    expect(calls).toEqual(["first:start"]);

    first.resolve();
    await Promise.all([firstResult, secondResult]);
    expect(calls).toEqual(["first:start", "first:end", "second"]);
  });

  test("continues the queue after a failed mutation", async () => {
    const queue = createKeyedMutationQueue();
    const calls: string[] = [];

    const failed = queue.run(["reference"], async () => {
      calls.push("failed");
      throw new Error("failure");
    });
    const next = queue.run(["reference"], async () => {
      calls.push("next");
    });

    await expect(failed).rejects.toThrow("failure");
    await next;
    expect(calls).toEqual(["failed", "next"]);
  });

  test("makes a multi-key mutation wait for every related key", async () => {
    const queue = createKeyedMutationQueue();
    const first = createDeferred<void>();
    const second = createDeferred<void>();
    const calls: string[] = [];

    const firstResult = queue.run(["first"], () => first.promise);
    const secondResult = queue.run(["second"], () => second.promise);
    const bulkResult = queue.run(["first", "second"], async () => {
      calls.push("bulk");
    });

    await Promise.resolve();
    first.resolve();
    await firstResult;
    await Promise.resolve();
    expect(calls).toEqual([]);

    second.resolve();
    await Promise.all([secondResult, bulkResult]);
    expect(calls).toEqual(["bulk"]);
  });
});

describe("createMutationVersionTracker", () => {
  test("accepts only the latest mutation version", () => {
    const tracker = createMutationVersionTracker();
    const first = tracker.start("reference");
    const second = tracker.start("reference");

    expect(tracker.isLatest("reference", first)).toBe(false);
    expect(tracker.isLatest("reference", second)).toBe(true);

    tracker.clear("reference");
    expect(tracker.isLatest("reference", second)).toBe(false);
  });
});
