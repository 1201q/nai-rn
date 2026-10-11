import type { PromptTokenTarget } from "./promptTokens/metrics";

// 마지막으로 포커스했던 프롬프트 입력칸과 커서 위치. 다른 탭(Chunks)에서 그 자리에
// 삽입하려고 기억해 둔다. 화면 상태라 저장하지 않는다.
let lastTarget: { target: PromptTokenTarget; offset: number } | null = null;

export function rememberPromptInsertTarget(
  target: PromptTokenTarget,
  offset: number,
) {
  lastTarget = { target, offset };
}

export function getPromptInsertTarget() {
  return lastTarget;
}

export function clearPromptInsertTarget() {
  lastTarget = null;
}
