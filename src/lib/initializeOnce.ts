export function createInitializeOnce(initialize: () => Promise<void>) {
  let initPromise: Promise<void> | null = null;

  return () => {
    if (!initPromise) {
      initPromise = initialize().catch((error: unknown) => {
        initPromise = null;
        throw error;
      });
    }

    return initPromise;
  };
}
