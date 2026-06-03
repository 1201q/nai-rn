const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// 미리 빌드된 SQLite 사전(assets/tags.db)을 정적 에셋으로 번들.
config.resolver.assetExts.push("db");

module.exports = config;
