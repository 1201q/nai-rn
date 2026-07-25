import { createInitializeOnce } from "../initializeOnce";

describe("createInitializeOnce", () => {
  test("shares one initialization across concurrent calls", async () => {
    const initialize = jest.fn(async () => {});
    const ensureInitialized = createInitializeOnce(initialize);

    const first = ensureInitialized();
    const second = ensureInitialized();

    expect(second).toBe(first);
    await Promise.all([first, second]);
    expect(ensureInitialized()).toBe(first);
    expect(initialize).toHaveBeenCalledTimes(1);
  });

  test("allows initialization to retry after a failure", async () => {
    let attempt = 0;
    const initialize = jest.fn(async () => {
      attempt += 1;
      if (attempt === 1) {
        throw new Error("initialization failed");
      }
    });
    const ensureInitialized = createInitializeOnce(initialize);

    await expect(ensureInitialized()).rejects.toThrow("initialization failed");
    await expect(ensureInitialized()).resolves.toBeUndefined();
    expect(initialize).toHaveBeenCalledTimes(2);
  });
});
