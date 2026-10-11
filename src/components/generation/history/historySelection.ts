import { createStore } from "zustand/vanilla";

// 선택이 바뀔 때 시트 전체가 아니라 구독한 타일과 헤더만 다시 그리도록
// 선택 상태를 컨트롤러의 React state 밖에 둔다.
export type HistorySelectionState = {
  // 사용자가 고른 id. 이후 삭제된 항목이 섞여 있을 수 있다.
  raw: Set<string>;
  available: Set<string>;
  // available이 DB의 전체 id를 담고 있는지
  complete: boolean;
  // raw 중 지금 존재하는 id
  ids: Set<string>;
};

function existingIds(raw: Set<string>, available: Set<string>) {
  const valid = [...raw].filter((id) => available.has(id));
  return valid.length === raw.size ? raw : new Set(valid);
}

export function createHistorySelectionStore() {
  return createStore<HistorySelectionState>(() => ({
    raw: new Set(),
    available: new Set(),
    complete: false,
    ids: new Set(),
  }));
}

export type HistorySelectionStore = ReturnType<
  typeof createHistorySelectionStore
>;

export function setSelectedIds(store: HistorySelectionStore, raw: Set<string>) {
  store.setState((state) => ({
    raw,
    ids: existingIds(raw, state.available),
  }));
}

export function setAvailableIds(
  store: HistorySelectionStore,
  available: Set<string>,
  complete: boolean,
) {
  store.setState((state) => ({
    available,
    complete,
    ids: existingIds(state.raw, available),
  }));
}

export function isAllSelected(state: HistorySelectionState) {
  return (
    state.complete &&
    state.ids.size > 0 &&
    state.ids.size === state.available.size
  );
}
