// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const prettierConfig = require("eslint-config-prettier/flat");

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: [
      "dist/*",
      "android/*",
      "ios/*",
      "artifacts/*",
      ".claude/*",
      ".agents/*",
      ".expo/*",
      // 브라우저에서 바로 여는 HTML 목업. 스크립트끼리 전역을 공유한다.
      "docs/*",
    ],
  },
  {
    rules: {
      // React Compiler를 쓰지 않는다. immutability는 Reanimated shared value의
      // `.value` 대입을 오류로 잡아 오탐이 대부분이라 끈다.
      "react-hooks/immutability": "off",
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
    },
  },
  {
    // jest.mock 팩토리 안에서는 require가 필요하다.
    files: ["**/__tests__/**"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["scripts/**/*.js"],
    languageOptions: {
      globals: {
        __dirname: "readonly",
        require: "readonly",
        module: "writable",
        process: "readonly",
        console: "readonly",
      },
    },
  },
]);
