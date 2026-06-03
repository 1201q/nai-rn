// tags.json으로부터 미리 빌드된 SQLite 사전(assets/tags.db)을 생성.
//
// 이유: tags.json은 ~28MB / 30만 항목. JS 번들에 import하면 앱 시작마다 배열
// 전체를 JS 힙에 파싱함. 대신 SQLite 파일로 동봉하고 필요할 때만 쿼리(검색이
// 디스크에서 처리됨).
//
// 사전이 바뀔 때마다 1회 실행:
//   node scripts/build-tags-db.js
//
// Node 내장 node:sqlite(Node >= 22.5) 사용 -> 네이티브 빌드 단계 없음.

const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const SOURCE =
  process.env.TAGS_JSON || path.join(__dirname, "..", "assets", "tags.json");
const OUT = path.join(__dirname, "..", "assets", "tags.db");

function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error(`tags.json 없음: ${SOURCE}`);
    console.error("TAGS_JSON 환경변수로 경로 지정.");
    process.exit(1);
  }

  console.log(`Reading ${SOURCE} ...`);
  const tags = JSON.parse(fs.readFileSync(SOURCE, "utf8"));
  console.log(`Parsed ${tags.length} tags.`);

  // 매 실행마다 새로 빌드.
  if (fs.existsSync(OUT)) fs.rmSync(OUT);

  const db = new DatabaseSync(OUT);
  db.exec("PRAGMA journal_mode = OFF;");
  db.exec("PRAGMA synchronous = OFF;");
  // `value` 컬럼 제거: 이 사전은 모든 행에서 value === label(검증됨)이라
  // 두 번 저장하지 않고 런타임에 복원.
  //
  // `search_key`는 검색이 매칭하는 대상. artist 라벨은 `artist:` 네임스페이스
  // 접두사를 가짐(예: "artist:wlop") -> search_key에선 접두사를 떼서 유저가
  // "wlop"만 쳐도 찾게 함. 표시·삽입은 풀 라벨 그대로.
  db.exec(`
    CREATE TABLE tags (
      label      TEXT NOT NULL,
      count      INTEGER NOT NULL,
      type       TEXT NOT NULL,
      search_key TEXT NOT NULL
    );
  `);

  const insert = db.prepare(
    "INSERT INTO tags (label, count, type, search_key) VALUES (?, ?, ?, ?)",
  );

  const ARTIST_PREFIX = "artist:";
  const seen = new Set(); // 중복 제거: 같은 라벨이 여러 타입으로 존재함
  let inserted = 0;

  db.exec("BEGIN");
  for (const t of tags) {
    if (seen.has(t.label)) continue; // 파일이 count 내림차순 -> 첫(최고 count) 항목 유지
    seen.add(t.label);

    const lower = t.label.toLowerCase();
    const isArtist = lower.startsWith(ARTIST_PREFIX);
    // 일부 중복 행에서 artist 라벨이 `general`로 잘못 분류됨 -> 보정.
    const type = isArtist ? "artist" : t.type;
    const searchKey = isArtist ? lower.slice(ARTIST_PREFIX.length) : lower;

    insert.run(t.label, t.count | 0, type, searchKey);
    inserted++;
  }
  db.exec("COMMIT");
  console.log(`중복 제거 후 ${inserted}개 삽입 (원본 ${tags.length}개).`);

  // 인덱스 없음: substring 검색은 LIKE '%q%'(어떤 인덱스도 못 타는 풀스캔),
  // 네임스페이스 브라우징은 타입별 스캔. 둘 다 입력 디바운스 뒤라 충분히 빠름.
  // 인덱스 두면 동봉 파일만 커짐.
  db.exec("VACUUM;");

  const row = db.prepare("SELECT COUNT(*) AS n FROM tags").get();
  console.log(`생성 완료 ${OUT} (${row.n} 행).`);

  // 스모크 테스트: 쿼리가 라벨 중간에 있어도 substring 매칭돼야 함.
  const sample = db
    .prepare(
      "SELECT label, type FROM tags WHERE search_key LIKE '%kantoku%' ORDER BY count DESC LIMIT 3",
    )
    .all();
  console.log("Sample '%kantoku%':", sample);

  db.close();

  const bytes = fs.statSync(OUT).size;
  console.log(`Size: ${(bytes / 1024 / 1024).toFixed(1)} MB`);
}

main();
