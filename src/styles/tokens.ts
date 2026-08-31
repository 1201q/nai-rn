import { Platform } from "react-native";

// 디자인 토큰 - design 스킬(tokens/*.css)을 RN 상수로 이식.
// 다크 전용. 리디자인 전반에서 재사용.

export const tokens = {
  color: {
    app: "#121116", // 앱 캔버스 / 화면 배경
    card: "#1C1B22", // 기본 카드 / 행 배경
    cardAlt: "#19181E", // 교차 타일 배경
    sunken: "#15141A", // 드롭다운 / 옵션 리스트 배경
    raised: "#24232B", // 팝오버 / 컨텍스트 메뉴
    toast: "#2C2B34", // 토스트 전용 표면 - raised보다 한 단계 밝음
    overlay: "rgba(28,27,34,0.88)", // floating 글래스 pill/바 (blur 대용 solid)
    scrim: "rgba(18,17,22,0.75)", // 이미지 딤 스크림

    accent: "#FFC93C", // 워엄 앰버 - 모든 인터랙티브/활성 상태
    accentHover: "#FFDA7A",
    accentActive: "#E6AF22",
    onAccent: "#17130A", // 앰버 위에 얹는 텍스트/아이콘 색

    textPrimary: "#F5F5F5",
    textSecondary: "#D4D4D8",
    textTertiary: "#8A8A8E",
    textMuted: "#6E6E74",
    textDisabled: "#9C9CA3",
    negative: "#F0A0A0",

    borderSubtle: "rgba(255,255,255,0.08)",
    borderSubtleStrong: "rgba(255,255,255,0.15)",
    borderNegative: "rgba(239,110,110,0.45)",
    promptBorder: "#2B2A30",

    // 캐릭터/레퍼런스 회전 아이덴티티 색
    badge1: "#FFC93C",
    badge2: "#FDA4AF",
    badge3: "#C4B5FD",
    badge4: "#7DD3FC",

    placeholderStripe: "rgba(255,255,255,0.045)",
  },

  radius: {
    settings: 26, // settings multi-row and parameter containers
    sm: 9, // 칩, 썸네일 아이콘
    md: 12, // 옵션 행, 리스트 아이템
    lg: 16, // 카드, 레퍼런스 행
    xl: 20, // 텍스트 영역, 프롬프트 패널
    "2xl": 24, // 히어로 타일
    "3xl": 28, // 캔버스 / 이미지 프레임
    pill: 999,
  },

  space: {
    1: 2,
    2: 4,
    3: 6,
    4: 8,
    5: 10,
    6: 12,
    7: 14,
    8: 16,
    9: 18,
    10: 20,
    12: 24,
    14: 28,
    16: 32,
    20: 40,
  },

  // 다크 UI: 그림자는 부드럽고 검정, 색 없음. RN shadow* + elevation 조합.
  shadow: {
    floatSm: {
      shadowColor: "#000000",
      shadowOpacity: 0.4,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 8,
    },
    floatMd: {
      shadowColor: "#000000",
      shadowOpacity: 0.45,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 8 },
      elevation: 12,
    },
  },

  // Pretendard 웨이트별 fontFamily 이름 (app.config.js expo-font 번들명과 일치).
  font: {
    regular: "Pretendard-Regular",
    medium: "Pretendard-Medium",
    semibold: "Pretendard-SemiBold",
    bold: "Pretendard-Bold",
    extrabold: "Pretendard-ExtraBold",
  },

  // 타입 스케일 (px)
  type: {
    "2xl": 28, // 화면 타이틀
    xl: 20, // 섹션 헤더
    lg: 19, // 히어로 값
    md: 16, // 행 라벨, primary 버튼
    base: 15, // 카드 타이틀, 본문
    sm: 14, // 보조 라벨, 탭 라벨
    xs: 13, // 메타 행, 타임스탬프
    "2xs": 12, // 상태 텍스트, 글자수
    "3xs": 11, // eyebrow / 섹션 kicker
  },

  tracking: {
    tight: -0.4,
    normal: 0,
    wide: 0.7, // uppercase eyebrow (0.06em ≒ 0.7px @ 12px)
  },
} as const;

// 대각선 스트라이프(placeholder) 대용 - 모노 폰트 (플랫폼 시스템 모노)
export const monoFont = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "monospace",
}) as string;
