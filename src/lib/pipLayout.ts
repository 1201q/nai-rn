import { PixelRatio } from "react-native";

import { generationImagePipeline } from "../../modules/generation-image-pipeline";

// 창 기준 좌표(dp).
export type WindowRect = { x: number; y: number; width: number; height: number };

export type PipBackPhase = "progress" | "cancel" | "commit";

// 루트 뒤로가기 제스처 중 이미지가 줄어드는 최소 배율.
export const PIP_BACK_MIN_SCALE = 0.85;

// 캔버스 이미지의 마지막 위치. 플로팅 열기/캔버스 복귀 애니메이션의 출발/도착점.
let canvasImageRect: WindowRect | null = null;
// 시스템 PiP 진입 애니메이션 시작 영역으로 보낸 마지막 값 (지금 화면에 보이는 이미지: 캔버스 또는 플로팅).
let pipSourceRect: WindowRect | null = null;
let backProgress = 0;
const backListeners = new Set<(progress: number, phase: PipBackPhase) => void>();

export function setCanvasImageRect(rect: WindowRect) {
  canvasImageRect = rect;
}

export function getCanvasImageRect() {
  return canvasImageRect;
}

function sendSourceRect({ x, y, width, height }: WindowRect) {
  const ratio = PixelRatio.get();
  generationImagePipeline?.setPipSourceRect?.(
    Math.round(x * ratio), Math.round(y * ratio),
    Math.round(width * ratio), Math.round(height * ratio),
  );
}

export function reportPipSourceRect(rect: WindowRect) {
  pipSourceRect = rect;
  sendSourceRect(rect);
}

export function subscribePipBack(listener: (progress: number, phase: PipBackPhase) => void) {
  backListeners.add(listener);
  return () => {
    backListeners.delete(listener);
  };
}

function emitPipBack(progress: number, phase: PipBackPhase) {
  backProgress = progress;
  for (const listener of backListeners) listener(progress, phase);
}

export function updatePipBack(progress: number) {
  emitPipBack(progress, "progress");
}

export function cancelPipBack() {
  emitPipBack(0, "cancel");
}

// PiP 진입이 끝난 뒤 이미지 배율/시작 영역을 원래대로 되돌리는 시점.
export const PIP_BACK_RESET_DELAY_MS = 1000;

// 제스처로 줄어든 크기 그대로 PiP가 이어지도록 시작 영역을 중심 기준으로 줄여 보낸다.
export function commitPipBack() {
  const base = pipSourceRect;
  if (base) {
    const scale = 1 - (1 - PIP_BACK_MIN_SCALE) * backProgress;
    sendSourceRect({
      x: base.x + (base.width * (1 - scale)) / 2,
      y: base.y + (base.height * (1 - scale)) / 2,
      width: base.width * scale,
      height: base.height * scale,
    });
    setTimeout(() => {
      if (pipSourceRect === base) sendSourceRect(base);
    }, PIP_BACK_RESET_DELAY_MS);
  }
  emitPipBack(backProgress, "commit");
}
