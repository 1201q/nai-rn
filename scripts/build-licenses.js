// 오픈소스 라이선스 화면용 데이터(src/constants/licenses.json)를 생성.
//
// package.json의 dependencies와, npm 패키지가 아니라서 자동으로 잡히지 않는
// 번들 구성요소(EXTRAS)를 합친다. 의존성을 추가/업데이트하면 다시 실행:
//   node scripts/build-licenses.js

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "src", "constants", "licenses.json");

// npm 의존성 목록에 없는 폰트와 네이티브 라이브러리. file은 node_modules 안에
// 라이선스 원문이 있을 때만 지정한다.
const EXTRAS = [
  {
    name: "Pretendard",
    license: "OFL-1.1",
    copyright: "Copyright (c) 2021 Kil Hyung-jin",
    url: "https://github.com/orioncactus/pretendard/blob/main/LICENSE",
  },
  {
    name: "Ionicons",
    license: "MIT",
    copyright: "Copyright (c) 2015-present Ionic",
    url: "https://github.com/ionic-team/ionicons/blob/main/LICENSE",
  },
  {
    name: "Hermes",
    license: "MIT",
    copyright: "Copyright (c) Meta Platforms, Inc. and affiliates.",
    url: "https://github.com/facebook/hermes/blob/main/LICENSE",
  },
  {
    name: "Skia",
    license: "BSD-3-Clause",
    copyright: "Copyright (c) 2011 Google Inc.",
    url: "https://github.com/google/skia/blob/main/LICENSE",
  },
  {
    name: "OkHttp",
    license: "Apache-2.0",
    copyright: "Copyright Square, Inc.",
    url: "https://github.com/square/okhttp/blob/master/LICENSE.txt",
  },
  {
    name: "AndroidX",
    license: "Apache-2.0",
    copyright: "Copyright The Android Open Source Project",
    url: "https://www.apache.org/licenses/LICENSE-2.0",
  },
  // assets/tokenizers: NovelAI가 서빙하는 파일이지만 내용의 원본은 아래와 같다.
  {
    name: "CLIP tokenizer",
    license: "MIT",
    copyright: "Copyright (c) 2021 OpenAI",
    url: "https://github.com/openai/CLIP/blob/main/LICENSE",
  },
  {
    name: "T5 tokenizer",
    license: "Apache-2.0",
    copyright: "Copyright The T5 Authors",
    url: "https://github.com/google-research/text-to-text-transfer-transformer/blob/main/LICENSE",
  },
  {
    // 정확한 원본 모델은 미확인. 라이선스는 Qwen 계열 토크나이저 기준.
    name: "Qwen tokenizer",
    license: "Apache-2.0",
    copyright: "Copyright Alibaba Cloud",
    url: "https://huggingface.co/Qwen",
  },
];

function repositoryUrl(pkg) {
  const repo =
    typeof pkg.repository === "string" ? pkg.repository : pkg.repository?.url;
  if (pkg.homepage) return pkg.homepage;
  if (!repo) return `https://www.npmjs.com/package/${pkg.name}`;
  return repo
    .replace(/^git\+/, "")
    .replace(/^git:\/\//, "https://")
    .replace(/^github:/, "https://github.com/")
    .replace(/\.git$/, "");
}

function main() {
  const patched = fs.readdirSync(path.join(ROOT, "patches"));
  const { dependencies } = require(path.join(ROOT, "package.json"));

  const packages = Object.keys(dependencies).map((name) => {
    const dir = path.join(ROOT, "node_modules", name);
    const pkg = require(path.join(dir, "package.json"));
    const licenseFile = fs
      .readdirSync(dir)
      .find((file) => /^(licen[sc]e|copying)/i.test(file));

    return {
      name,
      version: pkg.version,
      license: pkg.license,
      url: repositoryUrl(pkg),
      // patch-package로 수정해서 쓰는 패키지 (Apache-2.0은 수정 사실 표기 필요)
      modified: patched.some((file) =>
        file.startsWith(`${name.replace("/", "+")}+`),
      ),
      text: licenseFile
        ? fs.readFileSync(path.join(dir, licenseFile), "utf8").trim()
        : null,
    };
  });

  const licenses = [
    ...packages,
    ...EXTRAS.map((extra) => ({
      name: extra.name,
      version: null,
      license: extra.license,
      url: extra.url,
      modified: false,
      text: extra.copyright,
    })),
  ].sort((a, b) => a.name.localeCompare(b.name));

  fs.writeFileSync(OUT, `${JSON.stringify(licenses, null, 2)}\n`);
  console.log(`${licenses.length} entries -> ${path.relative(ROOT, OUT)}`);
}

main();
