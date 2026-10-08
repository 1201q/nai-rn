import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  Platform,
  type NativeSyntheticEvent,
  type TextInput,
  type TextInputSelectionChangeEventData,
} from "react-native";

import {
  type AutocompleteRange,
  getAutocompleteEdit,
  getAutocompleteRange,
  getCurrentWord,
  insertTag,
  MIN_TRIGGER,
  parseQuery,
} from "../lib/autocomplete";
import {
  expandDeletionOverPromptChunks,
  findPromptChunkReferences,
  getPromptChunkTrigger,
  searchPromptChunks,
  snapCaretToPromptChunk,
} from "../lib/promptChunks";
import { rememberPromptInsertTarget } from "../lib/promptInsertTarget";
import type { PromptTokenTarget } from "../lib/promptTokens/metrics";
import { searchTags } from "../lib/tagDb";
import {
  useSuggestionBarActions,
  type PromptSuggestion,
} from "../context/SuggestionBarContext";
import { usePromptChunkStore } from "../store/promptChunkStore";

const DEBOUNCE_MS = 150;
const SELECTION_RELEASE_MS = 250;
// Android는 Backspace의 커서 이벤트를 글자 변경보다 먼저 보낸다. 그 사이에 커서를
// 옮기면 삭제가 꼬이므로, 글자 변경이 뒤따르지 않는 것을 확인한 뒤에 옮긴다.
const CHUNK_SNAP_DELAY_MS = 50;
// Android는 입력창 네이티브 쪽이 Prompt Chunk 참조를 한 덩어리로 다룬다(커서 보정,
// 통째 삭제). JS가 글자 변경 없이 커서만 옮기면 Android에서 줄 높이가 풀리므로
// 거기서는 아래 JS 보정을 쓰지 않는다.
const CHUNK_EDITING_IN_JS = Platform.OS !== "android";

/** Connect change/selection handlers and activate/deactivate on focus/blur. */
export function usePromptAutocomplete({
  value,
  onChangeText,
  inputRef,
  channel,
  insertTarget,
}: {
  value: string;
  onChangeText: (v: string) => void;
  inputRef: React.RefObject<Pick<TextInput, "focus"> | null>;
  channel: "base" | "negative";
  // 넘기면 이 입력칸의 커서 위치를 Prompt Chunk 삽입 위치로 기억한다.
  insertTarget?: PromptTokenTarget;
}) {
  const textRef = useRef(value);
  const selectionRef = useRef({ start: 0, end: 0 });
  const rangeRef = useRef<AutocompleteRange | null>(null);
  const beforeSelectionRef = useRef<{
    selection: AutocompleteRange;
    range: AutocompleteRange | null;
  } | null>(null);
  const channelRef = useRef(channel);
  const ownerRef = useRef(Symbol("prompt-autocomplete"));
  const focusedRef = useRef(false);
  const pendingSelectionRef = useRef<{
    target: AutocompleteRange;
    previous: AutocompleteRange | null;
  } | null>(null);
  const selectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selection, setSelection] = useState<AutocompleteRange>();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqIdRef = useRef(0);
  const pickFnRef = useRef<
    (item: PromptSuggestion, replace?: AutocompleteRange) => void
  >(() => {});
  const barActions = useSuggestionBarActions();
  const insertTargetRef = useRef(insertTarget);
  const caretRef = useRef(0);

  useLayoutEffect(() => {
    insertTargetRef.current = insertTarget;
  });

  const syncInsertTarget = useCallback((offset: number) => {
    caretRef.current = offset;
    if (focusedRef.current && insertTargetRef.current) {
      rememberPromptInsertTarget(insertTargetRef.current, offset);
    }
  }, []);

  const releaseSelection = useCallback(() => {
    if (selectionTimerRef.current) clearTimeout(selectionTimerRef.current);
    selectionTimerRef.current = null;
    pendingSelectionRef.current = null;
    setSelection(undefined);
  }, []);

  // 커서를 지정한 위치로 옮기고, native가 따라올 때까지만 잡아 둔다.
  const forceSelection = useCallback(
    (target: AutocompleteRange, previous: AutocompleteRange) => {
      if (selectionTimerRef.current) clearTimeout(selectionTimerRef.current);
      pendingSelectionRef.current = { target, previous };
      setSelection(target);
      selectionTimerRef.current = setTimeout(
        releaseSelection,
        SELECTION_RELEASE_MS,
      );
    },
    [releaseSelection],
  );

  const clearSuggestions = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = null;
    reqIdRef.current += 1;
    barActions?.clearSuggestions(ownerRef.current);
  }, [barActions]);

  useLayoutEffect(() => {
    if (channelRef.current !== channel || textRef.current !== value) {
      clearSuggestions();
      releaseSelection();
      rangeRef.current = null;
      beforeSelectionRef.current = null;
      selectionRef.current = { start: 0, end: 0 };
    }
    channelRef.current = channel;
    textRef.current = value;
  }, [channel, clearSuggestions, releaseSelection, value]);

  pickFnRef.current = (item, replace) => {
    const caret = selectionRef.current.start;
    const range = rangeRef.current;
    const tagRange =
      range && caret >= range.start && caret <= range.end ? range : undefined;
    const { text, cursor } = insertTag(
      textRef.current,
      caret,
      item.value,
      replace ?? tagRange,
    );
    const previous = selectionRef.current;
    const target = { start: cursor, end: cursor };
    releaseSelection();
    if (previous.start !== cursor || previous.end !== cursor) {
      pendingSelectionRef.current = { target, previous };
      setSelection(target);
      // Native acknowledgement is not guaranteed; never hold the caret indefinitely.
      selectionTimerRef.current = setTimeout(
        releaseSelection,
        SELECTION_RELEASE_MS,
      );
    }
    textRef.current = text;
    selectionRef.current = target;
    syncInsertTarget(cursor);
    rangeRef.current = null;
    beforeSelectionRef.current = null;
    onChangeText(text);
    clearSuggestions();
    inputRef.current?.focus();
  };

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (selectionTimerRef.current) clearTimeout(selectionTimerRef.current);
      if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
      reqIdRef.current += 1;
      focusedRef.current = false;
      barActions?.setActive(ownerRef.current, false);
    },
    [barActions],
  );

  const activateSuggestions = useCallback(() => {
    clearSuggestions();
    rangeRef.current = null;
    beforeSelectionRef.current = null;
    focusedRef.current = true;
    barActions?.setActive(ownerRef.current, true);
    syncInsertTarget(caretRef.current);
  }, [barActions, clearSuggestions, syncInsertTarget]);

  const deactivateSuggestions = useCallback(() => {
    focusedRef.current = false;
    rangeRef.current = null;
    beforeSelectionRef.current = null;
    clearSuggestions();
    releaseSelection();
    barActions?.setActive(ownerRef.current, false);
  }, [barActions, clearSuggestions, releaseSelection]);

  const runSearch = useCallback(
    (text: string, caret: number) => {
      clearSuggestions();
      if (!focusedRef.current || !barActions?.isActive(ownerRef.current))
        return;
      const id = reqIdRef.current;
      const isCurrent = () =>
        id === reqIdRef.current &&
        focusedRef.current &&
        barActions.isActive(ownerRef.current) &&
        textRef.current === text &&
        selectionRef.current.start === caret &&
        selectionRef.current.end === caret;
      // `@검색어`는 Prompt Chunk만 찾는다. 태그 검색과 섞지 않는다.
      const trigger = getPromptChunkTrigger(text, caret);
      if (trigger) {
        const { chunks, categories } = usePromptChunkStore.getState();
        const results = searchPromptChunks(
          chunks,
          categories,
          trigger.query,
        ).map((chunk): PromptSuggestion => ({
          type: "chunk",
          label: chunk.name,
          value: `!macro:${chunk.name}!`,
          color: chunk.color,
        }));
        if (results.length > 0) {
          barActions.setSuggestions(ownerRef.current, results, (item) => {
            if (isCurrent() && results.includes(item)) {
              pickFnRef.current(item, { start: trigger.start, end: caret });
            }
          });
        }
        return;
      }
      const { word } = getCurrentWord(text, caret);
      const { type, query } = parseQuery(word);
      if (query.length < (type ? 0 : MIN_TRIGGER)) return;
      debounceRef.current = setTimeout(async () => {
        debounceRef.current = null;
        if (!isCurrent()) return;
        try {
          const results = await searchTags(query, type);
          if (!isCurrent()) return;
          if (results.length > 0) {
            barActions.setSuggestions(ownerRef.current, results, (item) => {
              if (
                isCurrent() &&
                results.some(
                  (result) =>
                    result.value === item.value && result.type === item.type,
                )
              ) {
                pickFnRef.current(item);
              }
            });
          }
        } catch {
          if (isCurrent()) clearSuggestions();
        }
      }, DEBOUNCE_MS);
    },
    [clearSuggestions, barActions],
  );

  const handleChangeText = useCallback(
    (text: string) => {
      if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
      snapTimerRef.current = null;
      const previousText = textRef.current;
      if (text === previousText) return;
      let edit = getAutocompleteEdit(previousText, text, selectionRef.current);
      let previousRange = rangeRef.current;
      const beforeSelection = beforeSelectionRef.current;
      if (beforeSelection) {
        const precedingEdit = getAutocompleteEdit(
          previousText,
          text,
          beforeSelection.selection,
        );
        if (
          selectionRef.current.start === selectionRef.current.end &&
          precedingEdit.end === selectionRef.current.start &&
          precedingEdit.start === beforeSelection.selection.start &&
          precedingEdit.previousEnd === beforeSelection.selection.end
        ) {
          // A native selection event can describe the edit before its text arrives.
          edit = precedingEdit;
          previousRange = beforeSelection.range;
        }
      }
      beforeSelectionRef.current = null;
      // Prompt Chunk 참조의 일부만 지워지면 참조 전체를 지운다.
      let forcedCaret: number | null = null;
      if (
        CHUNK_EDITING_IN_JS &&
        edit.end === edit.start &&
        edit.previousEnd > edit.start
      ) {
        const expanded = expandDeletionOverPromptChunks(
          previousText,
          edit.start,
          edit.previousEnd,
          findPromptChunkReferences(
            previousText,
            usePromptChunkStore.getState().chunks,
          ),
        );
        if (expanded) {
          text = expanded.text;
          edit = {
            start: expanded.caret,
            previousEnd: expanded.caret + previousText.length - text.length,
            end: expanded.caret,
          };
          forcedCaret = expanded.caret;
        }
      }
      const nextRange = getAutocompleteRange(text, edit.end);
      let end: number;
      if (
        previousRange &&
        edit.start >= previousRange.start &&
        edit.previousEnd <= previousRange.end
      ) {
        end = previousRange.end + text.length - previousText.length;
      } else if (getCurrentWord(previousText, edit.start).word.length === 0) {
        // Input at a token's start is a new tag, not the existing right-hand tag.
        end = edit.end;
      } else {
        end =
          getAutocompleteRange(previousText, edit.start).end +
          text.length -
          previousText.length;
      }
      rangeRef.current = {
        start: nextRange.start,
        end: Math.min(nextRange.end, Math.max(edit.end, end)),
      };
      releaseSelection();
      if (forcedCaret !== null) {
        forceSelection(
          { start: forcedCaret, end: forcedCaret },
          selectionRef.current,
        );
      }
      textRef.current = text;
      selectionRef.current = { start: edit.end, end: edit.end };
      syncInsertTarget(edit.end);
      onChangeText(text);
      // Text changes must invalidate searches even when the native caret does not move.
      runSearch(text, edit.end);
    },
    [
      forceSelection,
      onChangeText,
      releaseSelection,
      runSearch,
      syncInsertTarget,
    ],
  );

  const handleSelectionChange = useCallback(
    (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
      // 탭으로 포커스할 때 커서 이벤트가 focus보다 먼저 올 수 있다.
      if (!focusedRef.current) {
        caretRef.current = e.nativeEvent.selection.start;
      }
      if (!focusedRef.current || !barActions?.isActive(ownerRef.current))
        return;
      const sel = e.nativeEvent.selection;
      if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
      snapTimerRef.current = null;
      const pending = pendingSelectionRef.current;
      if (pending) {
        if (
          sel.start === pending.target.start &&
          sel.end === pending.target.end
        ) {
          selectionRef.current = sel;
          syncInsertTarget(sel.start);
          releaseSelection();
          return;
        }
        if (
          sel.start === pending.previous?.start &&
          sel.end === pending.previous.end
        ) {
          // Ignore at most one stale pre-completion event, not arbitrary user moves.
          pending.previous = null;
          return;
        }
        releaseSelection();
      }
      if (CHUNK_EDITING_IN_JS && sel.start === sel.end) {
        // 커서가 Prompt Chunk 참조 안으로 들어오면 경계로 밀어낸다.
        const previousCaret = selectionRef.current.start;
        snapTimerRef.current = setTimeout(() => {
          snapTimerRef.current = null;
          const current = selectionRef.current;
          if (current.start !== sel.start || current.end !== sel.end) return;
          const caret = snapCaretToPromptChunk(
            findPromptChunkReferences(
              textRef.current,
              usePromptChunkStore.getState().chunks,
            ),
            sel.start,
            previousCaret,
          );
          if (caret === sel.start) return;
          const target = { start: caret, end: caret };
          forceSelection(target, sel);
          selectionRef.current = target;
          syncInsertTarget(caret);
        }, CHUNK_SNAP_DELAY_MS);
      }
      if (
        sel.start === selectionRef.current.start &&
        sel.end === selectionRef.current.end
      )
        return;
      beforeSelectionRef.current = {
        selection: selectionRef.current,
        range: rangeRef.current,
      };
      rangeRef.current = null;
      selectionRef.current = sel;
      syncInsertTarget(sel.start);
      if (sel.start === sel.end) runSearch(textRef.current, sel.start);
      else clearSuggestions();
    },
    [
      barActions,
      runSearch,
      clearSuggestions,
      forceSelection,
      releaseSelection,
      syncInsertTarget,
    ],
  );

  return {
    selection,
    handleChangeText,
    handleSelectionChange,
    clearSuggestions,
    activateSuggestions,
    deactivateSuggestions,
  };
}
