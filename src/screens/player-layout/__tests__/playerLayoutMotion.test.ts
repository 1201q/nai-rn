import {
  fadeAfterContentThreshold,
  getContainedImageTarget,
  getDraggedSheetY,
  getPanelDragY,
  getPanelProgress,
  getSheetProgress,
  getSheetVisuals,
  getThumbnailVisuals,
  shouldClosePanel,
  shouldExpandSheet,
} from "../playerLayoutMotion";

describe("player layout sheet motion", () => {
  test("maps sheet endpoints to p=0 and p=1", () => {
    expect(getSheetProgress(700, 700)).toBe(0);
    expect(getSheetProgress(0, 700)).toBe(1);
  });

  test("keeps sheet-derived values aligned at the collapsed endpoint", () => {
    expect(getSheetVisuals(0)).toEqual({
      headerHeight: 76,
      fullHeaderTop: 20,
      bodyTop: 698,
      scrimOpacity: 0,
      tabBarY: 0,
      tabBarOpacity: 1,
      miniOpacity: 1,
      homeBarOpacity: 0,
      contentOpacity: 0,
    });
  });

  test("keeps sheet-derived values aligned at the expanded endpoint", () => {
    expect(getSheetVisuals(1)).toEqual({
      headerHeight: 130,
      fullHeaderTop: 74,
      bodyTop: 608,
      scrimOpacity: 0.55,
      tabBarY: 96,
      tabBarOpacity: 0,
      miniOpacity: 0,
      homeBarOpacity: 1,
      contentOpacity: 1,
    });
  });

  test("does not reveal full content before the 45 percent threshold", () => {
    expect(fadeAfterContentThreshold(0.45)).toBe(0);
    expect(fadeAfterContentThreshold(0.725)).toBeCloseTo(0.5);
  });

  test("uses distinct tab bar and mini bar fade multipliers", () => {
    const values = getSheetVisuals(0.5);

    expect(values.tabBarOpacity).toBeCloseTo(0.2);
    expect(values.miniOpacity).toBe(0);
  });

  test("uses the asymmetric open and close thresholds", () => {
    expect(shouldExpandSheet(false, -40)).toBe(false);
    expect(shouldExpandSheet(false, -41)).toBe(true);
    expect(shouldExpandSheet(true, 139)).toBe(true);
    expect(shouldExpandSheet(true, 140)).toBe(false);
  });

  test("limits direct dragging to the specified rubber-band range", () => {
    expect(getDraggedSheetY(0, -100, 700)).toBe(-40);
    expect(getDraggedSheetY(700, 100, 700)).toBe(760);
  });

  test("morphs one thumbnail through exact rounded endpoints", () => {
    expect(getThumbnailVisuals(0)).toEqual({
      left: 12,
      top: 16,
      width: 44,
      height: 44,
      borderRadius: 10,
    });
    expect(getThumbnailVisuals(0.5)).toEqual({
      left: 13,
      top: 75,
      width: 204,
      height: 252,
      borderRadius: 14,
    });
    expect(getThumbnailVisuals(1)).toEqual({
      left: 14,
      top: 134,
      width: 364,
      height: 460,
      borderRadius: 18,
    });
  });

  test("supports a proportionally fitted narrow-screen target", () => {
    expect(getThumbnailVisuals(1, 332, 419)).toEqual({
      left: 14,
      top: 134,
      width: 332,
      height: 419,
      borderRadius: 18,
    });
  });

  test("contains portrait, landscape, and square images without distortion", () => {
    expect(getContainedImageTarget(402, 832, 1216)).toEqual({
      left: 39,
      top: 134,
      width: 315,
      height: 460,
    });
    expect(getContainedImageTarget(402, 1216, 832)).toEqual({
      left: 14,
      top: 240,
      width: 364,
      height: 249,
    });
    expect(getContainedImageTarget(402, 1024, 1024)).toEqual({
      left: 14,
      top: 182,
      width: 364,
      height: 364,
    });
    expect(getContainedImageTarget(402, 640, 1472)).toEqual({
      left: 96,
      top: 134,
      width: 200,
      height: 460,
    });
  });

  test("gates panel progress until the sheet is fully expanded", () => {
    expect(getPanelProgress(true, 0, 738, 0.99)).toBe(0);
    expect(getPanelProgress(true, 369, 738, 1)).toBe(0.5);
    expect(getPanelProgress(false, 0, 738, 1)).toBe(0);
  });

  test("uses q for the second thumbnail morph and content fade", () => {
    expect(getThumbnailVisuals(1, 364, 460, 1)).toEqual({
      left: 14,
      top: 64,
      width: 44,
      height: 44,
      borderRadius: 10,
    });
    expect(getSheetVisuals(1, 1).contentOpacity).toBe(0);
    expect(getSheetVisuals(1, 1).homeBarOpacity).toBe(1);
  });

  test("closes the panel only after dragging beyond 150 pixels", () => {
    expect(shouldClosePanel(150)).toBe(false);
    expect(shouldClosePanel(151)).toBe(true);
    expect(getPanelDragY(-20, 738)).toBe(0);
    expect(getPanelDragY(800, 738)).toBe(738);
  });
});
