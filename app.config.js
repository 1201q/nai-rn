const variant = process.env.APP_VARIANT ?? "production";

const config = {
  production: { id: "com.q1201.nairn", name: "NovelAI - Image Generator" },
  preview: { id: "com.q1201.nairn.preview", name: "NovelAI (Preview)" },
  development: { id: "com.q1201.nairn.dev", name: "NovelAI (Dev)" },
}[variant];

export default {
  expo: {
    name: config.name,
    slug: "nai-rn",
    version: "1.0.0",
    scheme: "nairn",
    orientation: "portrait",
    icon: "./assets/logo.png",
    userInterfaceStyle: "dark",
    ios: {
      supportsTablet: true,
      bundleIdentifier: config.id,
    },

    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/logo-mono.png",
        backgroundColor: "#13142C",
      },
      predictiveBackGestureEnabled: true,
      softwareKeyboardLayoutMode: "resize",
      package: config.id,
      permissions: [
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.READ_MEDIA_VISUAL_USER_SELECTED",
        "android.permission.READ_MEDIA_IMAGES",
        "android.permission.POST_NOTIFICATIONS",
      ],
    },
    web: {
      favicon: "./assets/favicon.png",
      bundler: "metro",
    },
    plugins: [
      "expo-router",
      "expo-secure-store",
      "expo-sqlite",
      "expo-image",
      [
        "expo-media-library",
        {
          photosPermission:
            "사진을 선택하고 저장하기 위해 사진 보관함 접근 권한이 필요합니다.",
          savePhotosPermission:
            "생성한 이미지를 사진 보관함에 저장하기 위해 권한이 필요합니다.",
          granularPermissions: ["photo"],
        },
      ],
      [
        "expo-font",
        {
          fonts: [
            "./assets/fonts/Pretendard-Regular.otf",
            "./assets/fonts/Pretendard-Medium.otf",
            "./assets/fonts/Pretendard-SemiBold.otf",
            "./assets/fonts/Pretendard-Bold.otf",
            "./assets/fonts/Pretendard-ExtraBold.otf",
          ],
        },
      ],
      "expo-asset",
      [
        "expo-image-picker",
        {
          photosPermission:
            "이미지를 가져와 메타데이터를 추출하기 위해 사진 보관함 접근 권한이 필요합니다.",
        },
      ],
      [
        "react-native-notify-kit",
        {
          android: {
            foregroundService: {
              types: ["dataSync"],
            },
          },
        },
      ],
      "expo-status-bar",
    ],
    extra: {
      eas: {
        projectId: "1dd3b0a5-a64b-48f6-bf4e-56ad2521e001",
      },
    },
  },
};
