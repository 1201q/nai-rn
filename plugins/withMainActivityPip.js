const { withAndroidManifest, AndroidConfig } = require("expo/config-plugins");

// 생성 이미지 PiP: 메인 Activity 자체를 PiP로 보낸다 (modules/generation-image-pipeline MainActivityPip).
module.exports = function withMainActivityPip(config) {
  return withAndroidManifest(config, (config) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(config.modResults);
    activity.$["android:supportsPictureInPicture"] = "true";
    return config;
  });
};
