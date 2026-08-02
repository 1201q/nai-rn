import { playerLayoutTokens as theme } from "./playerLayoutTokens";

export function clamp(value: number, min: number, max: number) {
  "worklet";
  return Math.min(max, Math.max(min, value));
}

export function lerp(start: number, end: number, progress: number) {
  "worklet";
  return start + (end - start) * progress;
}

export function getSheetProgress(sheetY: number, collapsed: number) {
  "worklet";
  if (collapsed <= 0) return 1;
  return 1 - clamp(sheetY / collapsed, 0, 1);
}

export function getDraggedSheetY(
  base: number,
  translationY: number,
  collapsed: number,
) {
  "worklet";
  const minSheetY = base <= 0 ? 0 : theme.motion.openThreshold;

  return clamp(
    base + translationY,
    minSheetY,
    collapsed + theme.motion.closedRubberBand,
  );
}

export function shouldExpandSheet(
  wasExpanded: boolean,
  translationY: number,
) {
  "worklet";
  return wasExpanded
    ? translationY < theme.motion.closeThreshold
    : translationY < theme.motion.openThreshold;
}

export function getPanelProgress(
  panelOpen: boolean,
  panelDrag: number,
  panelTravel: number,
  sheetProgress: number,
) {
  "worklet";
  if (!panelOpen || panelTravel <= 0 || sheetProgress <= 0.99) return 0;
  return 1 - clamp(panelDrag / panelTravel, 0, 1);
}

export function getPanelDragY(translationY: number, panelTravel: number) {
  "worklet";
  return clamp(translationY, 0, panelTravel);
}

export function shouldClosePanel(translationY: number) {
  "worklet";
  return translationY > theme.motion.panelCloseThreshold;
}

export function getImageFrame(
  viewportWidth: number,
  maxFrameHeight: number = theme.layout.fullImageHeight,
) {
  "worklet";
  const frameWidth = Math.min(
    theme.layout.fullImageWidth,
    Math.max(0, viewportWidth - theme.layout.mainInset * 2),
  );
  const frameHeight = Math.min(
    maxFrameHeight,
    (frameWidth / theme.layout.fullImageWidth) *
      theme.layout.fullImageHeight,
  );
  const frameLeft = theme.layout.fullImageLeft;

  return {
    left: Math.round(frameLeft),
    top: theme.layout.fullImageTop,
    width: Math.round(frameWidth),
    height: Math.round(frameHeight),
  };
}

export function getContainedImageTarget(
  viewportWidth: number,
  sourceWidth: number,
  sourceHeight: number,
  maxFrameHeight: number = theme.layout.fullImageHeight,
) {
  "worklet";
  const frame = getImageFrame(viewportWidth, maxFrameHeight);
  const safeSourceWidth = Math.max(1, sourceWidth);
  const safeSourceHeight = Math.max(1, sourceHeight);
  const scale = Math.min(
    frame.width / safeSourceWidth,
    frame.height / safeSourceHeight,
  );
  const width = Math.round(safeSourceWidth * scale);
  const height = Math.round(safeSourceHeight * scale);

  return {
    left: Math.round(frame.left + (frame.width - width) / 2),
    top: Math.round(frame.top + (frame.height - height) / 2),
    width,
    height,
  };
}

export function getExpandedSheetGeometry(viewportHeight: number) {
  "worklet";
  const controlsTop =
    viewportHeight -
    theme.layout.fullBottomPadding -
    theme.layout.fullGenerateHeight;
  const actionTop = Math.round(
    controlsTop -
      theme.layout.imageActionToControlsGap -
      theme.layout.imageActionHeight,
  );
  const imageFrameHeight = Math.round(
    Math.min(
      theme.layout.fullImageHeight,
      Math.max(
        theme.layout.miniImageSize,
        actionTop -
          theme.layout.imageToActionGap -
          theme.layout.fullImageTop,
      ),
    ),
  );

  return {
    actionTop,
    actionTopCollapsed: actionTop + theme.layout.actionTravel,
    controlsTop: Math.round(controlsTop),
    imageFrameHeight,
  };
}

export function fadeAfterContentThreshold(progress: number) {
  "worklet";
  return Math.max(
    0,
    (progress - theme.motion.contentFadeStart) /
      theme.motion.contentFadeRange,
  );
}

export function getThumbnailVisuals(
  progress: number,
  expandedWidth: number = theme.layout.fullImageWidth,
  expandedHeight: number = theme.layout.fullImageHeight,
  panelProgress = 0,
  expandedLeft: number = theme.layout.fullImageLeft,
  expandedTop: number = theme.layout.fullImageTop,
) {
  "worklet";
  const p = clamp(progress, 0, 1);
  const q = clamp(panelProgress, 0, 1);
  const sheetLeft = lerp(
    theme.layout.miniImageLeft,
    expandedLeft,
    p,
  );
  const sheetTop = lerp(
    theme.layout.miniImageTop,
    expandedTop,
    p,
  );
  const sheetWidth = lerp(
    theme.layout.miniImageSize,
    expandedWidth,
    p,
  );
  const sheetHeight = lerp(
    theme.layout.miniImageSize,
    expandedHeight,
    p,
  );
  const sheetRadius = lerp(
    theme.radius.thumbnail,
    theme.radius.account,
    p,
  );

  return {
    left: Math.round(lerp(sheetLeft, theme.layout.fullImageLeft, q)),
    top: Math.round(lerp(sheetTop, theme.layout.dockImageTop, q)),
    width: Math.round(lerp(sheetWidth, theme.layout.miniImageSize, q)),
    height: Math.round(lerp(sheetHeight, theme.layout.miniImageSize, q)),
    borderRadius: Math.round(
      lerp(sheetRadius, theme.radius.thumbnail, q),
    ),
  };
}

export function getSheetVisuals(
  progress: number,
  panelProgress = 0,
  actionTopExpanded: number = theme.layout.actionTopExpanded,
  actionTopCollapsed: number = theme.layout.actionTopCollapsed,
) {
  "worklet";
  const p = clamp(progress, 0, 1);
  const q = clamp(panelProgress, 0, 1);
  const contentOpacity = fadeAfterContentThreshold(p * (1 - q));

  return {
    headerHeight: Math.round(
      theme.layout.sheetHeaderCollapsed +
        p *
          (theme.layout.sheetHeaderExpanded -
            theme.layout.sheetHeaderCollapsed),
    ),
    fullHeaderTop: Math.round(
      theme.layout.fullHeaderTopCollapsed +
        p *
          (theme.layout.fullHeaderTopExpanded -
            theme.layout.fullHeaderTopCollapsed),
    ),
    bodyTop: Math.round(
      actionTopExpanded +
        (1 - p) *
          (actionTopCollapsed - actionTopExpanded),
    ),
    scrimOpacity: p * theme.motion.scrimMaxOpacity,
    tabBarY: Math.round(p * theme.layout.tabBarTravel),
    tabBarOpacity:
      1 - Math.min(1, p * theme.motion.tabBarFadeMultiplier),
    miniOpacity: 1 - Math.min(1, p * theme.motion.miniFadeMultiplier),
    contentOpacity,
  };
}
