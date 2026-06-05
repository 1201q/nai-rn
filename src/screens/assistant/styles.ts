import { StyleSheet } from "react-native";

export const SLIDER_THUMB = 26;

// 이 화면 전용 라이트 팔레트 (공유 colors.ts 다크 토큰과 분리)
export const light = {
  bg: "#ffffff",
  surface: "#f4f4f3",
  surfaceAlt: "#ececeb",
  textPrimary: "#1c1c1c",
  textSecondary: "#6b6b6b",
  textHint: "#9a9a9a",
  border: "#e3e3e2",
  overlay: "rgba(0,0,0,0.28)",
  accent: "#fe9800",
} as const;

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: light.bg,
  },

  // 헤더
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  headerCircleButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: light.surface,
  },
  headerTitle: {
    fontFamily: "serif",
    fontSize: 20,
    fontWeight: "600",
    color: light.textPrimary,
  },

  // 중단: 이미지 영역
  imageScroll: {
    flex: 1,
  },
  imageScrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 16,
  },
  imageSlot: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  imageCard: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 18,
    backgroundColor: light.surfaceAlt,
    overflow: "hidden",
  },
  generatedImage: {
    width: "100%",
    height: "100%",
  },
  imageOverlayRow: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    gap: 8,
  },
  imageOverlayButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: light.overlay,
  },

  // 하단: 프롬프트 카드
  bottomArea: {
    paddingTop: 8,
    gap: 12,
  },
  promptCard: {
    marginHorizontal: 16,
    borderRadius: 22,
    backgroundColor: light.bg,
    borderWidth: 1,
    borderColor: light.border,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  promptInputWrap: {
    position: "relative",
    minHeight: 44,
    overflow: "hidden",
  },
  // 측정 자유(고정 height 없음) → onContentSizeChange 가 콘텐츠 실제 높이 보고.
  // absolute 라 wrapper(애니메이션 height)에 영향 안 줌.
  promptInput: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    minHeight: 44,
    maxHeight: 140,
    paddingRight: 36,
    fontSize: 16,
    color: light.textPrimary,
  },
  expandButton: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  promptActionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
  },
  promptActionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  promptModePill: {
    flexDirection: "row",
    alignItems: "center",
    height: 34,
    borderRadius: 999,
    backgroundColor: light.surface,
    padding: 3,
    overflow: "hidden",
  },
  promptModeSegment: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    zIndex: 1,
  },
  promptModeThumb: {
    position: "absolute",
    top: 3,
    bottom: 3,
    borderRadius: 999,
    backgroundColor: light.bg,
  },
  promptModeSegmentActive: {},
  characterButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: light.border,
    backgroundColor: light.bg,
  },
  characterButtonText: {
    fontSize: 13,
    fontWeight: "500",
    color: light.textSecondary,
  },
  promptModeText: {
    fontSize: 13,
    fontWeight: "500",
    color: light.textHint,
  },
  promptModeTextActive: {
    color: light.textPrimary,
  },
  plusButton: {
    width: 34,
    height: 34,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: light.border,
    backgroundColor: light.bg,
  },
  submitButton: {
    width: 34,
    height: 34,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: light.accent,
  },

  // 하단: 가로 스크롤 옵션
  optionScrollContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
  },
  optionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: light.surface,
  },
  optionChipActive: {
    backgroundColor: light.accent,
  },
  optionChipText: {
    fontSize: 14,
    fontWeight: "500",
    color: light.textSecondary,
  },
  optionChipUnit: {
    fontSize: 13,
    fontWeight: "400",
    color: light.textHint,
  },
  optionChipTextActive: {
    color: "#ffffff",
  },

  // 모델 선택 바텀시트 (라이트)
  sheetContainer: {
    zIndex: 20,
    elevation: 20,
  },
  sheetBackground: {
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    backgroundColor: light.bg,
  },
  sheetHandle: {
    width: 56,
    height: 5,
    backgroundColor: light.border,
  },
  sheetScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 2,
  },
  sheetTitle: {
    paddingHorizontal: 4,
    paddingTop: 8,
    paddingBottom: 12,
    color: light.textPrimary,
    fontSize: 20,
    fontWeight: "800",
  },
  sheetModelItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 50,
    paddingHorizontal: 12,
    marginHorizontal: -8,
    borderRadius: 14,
  },
  sheetModelItemLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sheetModelItemLabel: {
    color: light.textSecondary,
    fontSize: 17,
    fontWeight: "600",
  },
  sheetModelItemLabelActive: {
    color: light.accent,
  },
  sheetModelItemBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: light.surface,
  },
  sheetModelItemBadgeText: {
    color: light.textHint,
    fontSize: 11,
    fontWeight: "700",
  },
  sheetDivider: {
    height: 1,
    backgroundColor: light.border,
    marginVertical: 12,
  },

  // Steps 바텀시트
  stepsValueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    marginBottom: 28,
  },
  stepsButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: light.surface,
  },
  stepsButtonDisabled: {
    opacity: 0.4,
  },
  stepsValueCenter: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    gap: 6,
  },
  stepsValueInput: {
    minWidth: 56,
    height: 52,
    textAlign: "center",
    textAlignVertical: "center",
    fontSize: 44,
    lineHeight: 52,
    fontWeight: "bold",
    color: light.textPrimary,
    padding: 0,
    includeFontPadding: false,
  },
  stepsValueUnit: {
    fontSize: 16,
    fontWeight: "500",
    color: light.textHint,
  },
  stepsSliderTrack: {
    height: SLIDER_THUMB,
    justifyContent: "center",
    marginHorizontal: 4,
  },
  stepsSliderBase: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 6,
    borderRadius: 3,
    backgroundColor: light.surfaceAlt,
  },
  stepsSliderFill: {
    position: "absolute",
    left: 0,
    height: 6,
    borderRadius: 3,
    backgroundColor: light.accent,
  },
  stepsSliderThumb: {
    width: SLIDER_THUMB,
    height: SLIDER_THUMB,
    borderRadius: SLIDER_THUMB / 2,
    backgroundColor: light.bg,
    borderWidth: 2,
    borderColor: light.accent,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 3,
  },
  stepsRangeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    paddingHorizontal: 4,
  },
  stepsRangeLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: light.textHint,
  },

  // Seed 바텀시트
  seedSheetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
    marginBottom: 14,
  },
  seedSheetInput: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 18,
    fontWeight: "600",
    color: light.textPrimary,
    backgroundColor: light.surface,
    padding: 0,
    includeFontPadding: false,
  },
  seedSheetInputLocked: {
    color: light.textHint,
  },
  seedSheetButton: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: light.surface,
  },
  seedSheetButtonActive: {
    backgroundColor: "#fff3e0",
  },
  seedSheetHint: {
    paddingHorizontal: 4,
    fontSize: 13,
    fontWeight: "500",
    color: light.textHint,
  },
});
