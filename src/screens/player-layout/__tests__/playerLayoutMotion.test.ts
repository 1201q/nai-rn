import {
  fadeAfterContentThreshold,
  getContainedImageTarget,
  getDraggedSheetY,
  getExpandedSheetGeometry,
  getImageFrame,
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
      headerHeight: 68,
      fullHeaderTop: 20,
      bodyTop: 782,
      scrimOpacity: 0,
      tabBarY: 0,
      tabBarOpacity: 1,
      miniOpacity: 1,
      contentOpacity: 0,
    });
  });

  test("keeps sheet-derived values aligned at the expanded endpoint", () => {
    expect(getSheetVisuals(1)).toEqual({
      headerHeight: 130,
      fullHeaderTop: 54,
      bodyTop: 692,
      scrimOpacity: 0.55,
      tabBarY: 96,
      tabBarOpacity: 0,
      miniOpacity: 0,
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
    expect(getDraggedSheetY(0, -100, 700)).toBe(0);
    expect(getDraggedSheetY(700, -800, 700)).toBe(-40);
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
      top: 64,
      width: 204,
      height: 306,
      borderRadius: 14,
    });
    expect(getThumbnailVisuals(1)).toEqual({
      left: 14,
      top: 112,
      width: 364,
      height: 568,
      borderRadius: 18,
    });
  });

  test("supports a proportionally fitted narrow-screen target", () => {
    expect(getThumbnailVisuals(1, 332, 419)).toEqual({
      left: 14,
      top: 112,
      width: 332,
      height: 419,
      borderRadius: 18,
    });
  });

  test("fits the image and actions above bottom controls without overlap", () => {
    expect(getExpandedSheetGeometry(864)).toEqual({
      actionTop: 692,
      actionTopCollapsed: 782,
      entryTop: 742,
      imageFrameHeight: 568,
    });
    expect(getExpandedSheetGeometry(800)).toEqual({
      actionTop: 628,
      actionTopCollapsed: 718,
      entryTop: 678,
      imageFrameHeight: 506,
    });
    expect(getImageFrame(402, 568)).toEqual({
      left: 14,
      top: 112,
      width: 364,
      height: 568,
    });
  });

  test("contains portrait, landscape, and square images without distortion", () => {
    expect(getContainedImageTarget(402, 832, 1216)).toEqual({
      left: 14,
      top: 130,
      width: 364,
      height: 532,
    });
    expect(getContainedImageTarget(402, 1216, 832)).toEqual({
      left: 14,
      top: 272,
      width: 364,
      height: 249,
    });
    expect(getContainedImageTarget(402, 1024, 1024)).toEqual({
      left: 14,
      top: 214,
      width: 364,
      height: 364,
    });
    expect(getContainedImageTarget(402, 640, 1472)).toEqual({
      left: 73,
      top: 112,
      width: 247,
      height: 568,
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
      top: 52,
      width: 44,
      height: 44,
      borderRadius: 10,
    });
    expect(getSheetVisuals(1, 1).contentOpacity).toBe(0);
  });

  test("closes the panel only after dragging beyond 150 pixels", () => {
    expect(shouldClosePanel(150)).toBe(false);
    expect(shouldClosePanel(151)).toBe(true);
    expect(getPanelDragY(-20, 738)).toBe(0);
    expect(getPanelDragY(800, 738)).toBe(738);
  });

});
