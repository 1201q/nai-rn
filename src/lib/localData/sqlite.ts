import * as SQLite from "expo-sqlite";

// 같은 DB를 한 번만 연다. 열기에 실패하면 다음 호출에서 다시 시도한다.
export function createDatabaseOpener(name: string) {
  let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

  return () => {
    if (!dbPromise) {
      dbPromise = SQLite.openDatabaseAsync(name).catch((error: unknown) => {
        dbPromise = null;
        throw error;
      });
    }
    return dbPromise;
  };
}
