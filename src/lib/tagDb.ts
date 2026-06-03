// 미리 빌드된 태그 사전(assets/tags.db)에 대한 런타임 접근.
//
// SQLite 파일은 에셋으로 동봉되며 첫 실행 시 SQLite 디렉토리로 복사됨
// (importDatabaseFromAssetAsync는 복사본이 이미 있으면 no-op). 이후 쿼리는
// 디스크에서 실행 — 사전이 JS 힙에 올라오지 않아 앱 시작·메모리 부담 없음.
//
// .db 재생성: node scripts/build-tags-db.js

import * as SQLite from "expo-sqlite";

export type TagType = "general" | "artist" | "character" | "copyright";

export interface TagSuggestion {
  label: string;
  value: string;
  count: number;
  type: TagType;
}

// 버전 붙인 파일명: assets/tags.db가 바뀌면 숫자를 올림 -> 앱 업데이트 시
// SQLite 디렉토리의 낡은 복사본을 재사용하지 않고 새로 복사함.
const DB_NAME = "tags-v3.db";

const MIN_PREFIX = 2;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.importDatabaseFromAssetAsync(DB_NAME, {
      assetId: require("../../assets/tags.db"),
    }).then(() => SQLite.openDatabaseAsync(DB_NAME));
  }
  return dbPromise;
}

interface TagRow {
  label: string;
  count: number;
  type: TagType;
}

/**
 * 사전에 대한 substring 검색. search_key 어디든 매칭("kantoku"가
 * "nenekantoku"와 "kurumi (kantoku)"를 찾음), prefix 매칭을 우선 정렬한 뒤
 * 빈도순. 네임스페이스가 없으면 MIN_PREFIX 미만 쿼리는 [] 반환.
 *
 * search_key로 매칭(artist 라벨은 `artist:` 접두사가 제거돼 있음) → "wlop"이
 * "artist:wlop"을 찾음. 네임스페이스 + 빈 쿼리(예: `artist:`)면 해당 타입의
 * 인기 태그를 브라우징.
 *
 * LIKE '%q%'는 풀 테이블 스캔(20만 행에 ~20ms)이라 입력 디바운스 뒤에선 무방.
 * 느려지면 trigram FTS 인덱스가 더 빠름.
 */
export async function searchTags(
  prefix: string,
  type: TagType | null = null,
  limit = 15,
): Promise<TagSuggestion[]> {
  const q = prefix.trim().toLowerCase();
  if (!type && q.length < MIN_PREFIX) return [];

  const db = await getDb();

  let rows: TagRow[];
  if (q.length === 0) {
    // 위 가드 때문에 여기선 type이 null이 아님이 보장됨.
    rows = await db.getAllAsync<TagRow>(
      "SELECT label, count, type FROM tags WHERE type = ? ORDER BY count DESC LIMIT ?",
      type,
      limit,
    );
  } else {
    const esc = q.replace(/[%_\\]/g, "\\$&"); // LIKE 와일드카드 이스케이프
    const contains = `%${esc}%`;
    const starts = `${esc}%`;
    rows = type
      ? await db.getAllAsync<TagRow>(
          "SELECT label, count, type FROM tags WHERE search_key LIKE ? ESCAPE '\\' AND type = ? ORDER BY (search_key LIKE ? ESCAPE '\\') DESC, count DESC LIMIT ?",
          contains,
          type,
          starts,
          limit,
        )
      : await db.getAllAsync<TagRow>(
          "SELECT label, count, type FROM tags WHERE search_key LIKE ? ESCAPE '\\' ORDER BY (search_key LIKE ? ESCAPE '\\') DESC, count DESC LIMIT ?",
          contains,
          starts,
          limit,
        );
  }

  return rows.map((r) => ({
    label: r.label,
    value: r.label, // 이 사전은 value === label
    count: r.count,
    type: r.type,
  }));
}
