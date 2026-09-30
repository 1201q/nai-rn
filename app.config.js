const variant = process.env.APP_VARIANT ?? "production";

const config = {
  // 공식 NovelAI 앱으로 오인되지 않도록 브랜드명을 앱 이름 앞에 쓰지 않는다 (One UI 9 위험 앱 판정 대응).
  production: { id: "com.q1201.nairn", name: "NAI Studio" },
  preview: { id: "com.q1201.nairn.preview", name: "NAI Studio (Preview)" },
  development: { id: "com.q1201.nairn.dev", name: "NAI Studio (Dev)" },
}[variant];

export default {
  expo: {
    name: config.name,
    slug: "nai-rn",
    version: "1.0.0",
    runtimeVersion: {
      policy: "fingerprint",
    },
    updates: {
      url: "https://u.expo.dev/1dd3b0a5-a64b-48f6-bf4e-56ad2521e001",
    },
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
      // API 토큰과 로컬 DB를 백업·기기 이전 대상에서 제외한다.
      allowBackup: false,
      // READ/WRITE_EXTERNAL_STORAGE는 Expo 템플릿이 maxSdkVersion 32로 추가하므로 따로 적지 않는다.
      permissions: [
        "android.permission.POST_NOTIFICATIONS",
        "android.permission.POST_PROMOTED_NOTIFICATIONS",
        "android.permission.WAKE_LOCK",
      ],
      // 앱이 쓰지 않는 권한 차단.
      // - SYSTEM_ALERT_WINDOW: Expo 템플릿 기본값 (다른 앱 위에 표시)
      // - READ_MEDIA_*: expo-media-library 플러그인이 추가. 이미지 선택은 시스템 Photo Picker,
      //   저장은 writeOnly라 Android 13+에서 사진 읽기 권한이 필요 없다 (Play 사진 권한 정책 대응).
      blockedPermissions: [
        "android.permission.SYSTEM_ALERT_WINDOW",
        "android.permission.READ_MEDIA_IMAGES",
        "android.permission.READ_MEDIA_VISUAL_USER_SELECTED",
      ],
    },
    web: {
      favicon: "./assets/favicon.png",
      bundler: "metro",
    },
    plugins: [
      "expo-router",
      // allowBackup: false라 백업 규칙 파일을 매니페스트에 넣지 않는다.
      ["expo-secure-store", { configureAndroidBackup: false }],
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
          // 동영상 촬영을 하지 않으므로 RECORD_AUDIO를 추가하지 않는다.
          microphonePermission: false,
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
