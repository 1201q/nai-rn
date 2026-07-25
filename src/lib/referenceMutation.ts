export function createKeyedMutationQueue() {
  const tails = new Map<string, Promise<void>>();

  const run = <T>(
    keys: readonly string[],
    operation: () => Promise<T>,
  ): Promise<T> => {
    const uniqueKeys = [...new Set(keys)];
    const dependencies = uniqueKeys.flatMap((key) => {
      const tail = tails.get(key);
      return tail ? [tail] : [];
    });
    const result = Promise.all(dependencies).then(operation);
    const tail = result.then(
      () => undefined,
      () => undefined,
    );

    uniqueKeys.forEach((key) => {
      tails.set(key, tail);
    });
    void tail.then(() => {
      uniqueKeys.forEach((key) => {
        if (tails.get(key) === tail) tails.delete(key);
      });
    });

    return result;
  };

  return { run };
}

export function createMutationVersionTracker() {
  const versions = new Map<string, number>();

  const start = (key: string) => {
    const version = (versions.get(key) ?? 0) + 1;
    versions.set(key, version);
    return version;
  };

  const isLatest = (key: string, version: number) =>
    versions.get(key) === version;

  const clear = (key: string) => {
    versions.delete(key);
  };

  return { clear, isLatest, start };
}
