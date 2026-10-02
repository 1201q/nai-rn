// NovelAI의 qwen35_tokenizer.def에서 토큰 수 계산에 필요한 부분만 추려
// assets/tokenizers/qwen35_merges.def를 만든다.
//
// 원본에는 vocab(약 25만 항목)이 들어 있지만 토큰 "개수"는 merge 순위만으로 구할 수 있다.
// 원본을 그대로 넣으면 기기에서 17MB JSON을 파싱해야 하므로 merge 목록만 남긴다.
//
// 사용법:
//   curl -o qwen35_tokenizer.def https://novelai.net/tokenizer/compressed/qwen35_tokenizer.def
//   node scripts/build-qwen-tokenizer.js qwen35_tokenizer.def
const { createHash } = require("crypto");
const { readFileSync, writeFileSync } = require("fs");
const { join } = require("path");
const { deflateRawSync, inflateRawSync } = require("zlib");

const sourcePath = process.argv[2];
if (!sourcePath) {
  console.error(
    "usage: node scripts/build-qwen-tokenizer.js <qwen35_tokenizer.def>",
  );
  process.exit(1);
}

const sha256 = (data) =>
  createHash("sha256").update(data).digest("hex").toUpperCase();

const source = readFileSync(sourcePath);
const definition = JSON.parse(inflateRawSync(source).toString("utf8"));
const { config, merges } = definition;

if (config.ignoreMerges !== false || config.normalization !== "NFC") {
  throw new Error(`Unexpected tokenizer config: ${JSON.stringify(config)}`);
}
for (const pair of merges) {
  if (pair.length !== 2 || pair.some((part) => /[ \n]/.test(part) || !part)) {
    throw new Error(
      `Merge cannot be written as a line: ${JSON.stringify(pair)}`,
    );
  }
}

// 줄 번호가 merge 순위다.
const output = deflateRawSync(
  JSON.stringify({
    splitRegex: config.splitRegex,
    merges: merges.map((pair) => pair.join(" ")).join("\n"),
  }),
  { level: 9 },
);
const outputPath = join(
  __dirname,
  "..",
  "assets",
  "tokenizers",
  "qwen35_merges.def",
);
writeFileSync(outputPath, output);

console.log(`source  ${source.length} bytes  sha256 ${sha256(source)}`);
console.log(`merges  ${merges.length}`);
console.log(`output  ${output.length} bytes  sha256 ${sha256(output)}`);
