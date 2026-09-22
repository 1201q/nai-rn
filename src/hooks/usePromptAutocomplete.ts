import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
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
import { searchTags, type TagSuggestion } from "../lib/tagDb";
import { useSuggestionBarActions } from "../context/SuggestionBarContext";

const DEBOUNCE_MS = 150;
const SELECTION_RELEASE_MS = 250;

/** Connect change/selection handlers and activate/deactivate on focus/blur. */
export function usePromptAutocomplete({
  value,
  onChangeText,
  inputRef,
  channel,
}: {
  value: string;
  onChangeText: (v: string) => void;
  inputRef: React.RefObject<Pick<TextInput, "focus"> | null>;
  channel: "base" | "negative";
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
  const [selection, setSelection] = useState<AutocompleteRange>();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqIdRef = useRef(0);
  const pickFnRef = useRef<(item: TagSuggestion) => void>(() => {});
  const barActions = useSuggestionBarActions();

  const releaseSelection = useCallback(() => {
    if (selectionTimerRef.current) clearTimeout(selectionTimerRef.current);
    selectionTimerRef.current = null;
    pendingSelectionRef.current = null;
    setSelection(undefined);
  }, []);

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

  pickFnRef.current = (item) => {
    const caret = selectionRef.current.start;
    const range = rangeRef.current;
    const { text, cursor } = insertTag(
      textRef.current,
      caret,
      item.value,
      range && caret >= range.start && caret <= range.end ? range : undefined,
    );
    const previous = selectionRef.current;
    const target = { start: cursor, end: cursor };
    releaseSelection();
    if (previous.start !== cursor || previous.end !== cursor) {
      pendingSelectionRef.current = { target, previous };
      setSelection(target);
      // Native acknowledgement is not guaranteed; never hold the caret indefinitely.
      selectionTimerRef.current = setTimeout(releaseSelection, SELECTION_RELEASE_MS);
    }
    textRef.current = text;
    selectionRef.current = target;
    rangeRef.current = null;
    beforeSelectionRef.current = null;
    onChangeText(text);
    clearSuggestions();
    inputRef.current?.focus();
  };

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (selectionTimerRef.current) clearTimeout(selectionTimerRef.current);
    reqIdRef.current += 1;
    focusedRef.current = false;
    barActions?.setActive(ownerRef.current, false);
  }, [barActions]);

  const activateSuggestions = useCallback(() => {
    clearSuggestions();
    rangeRef.current = null;
    beforeSelectionRef.current = null;
    focusedRef.current = true;
    barActions?.setActive(ownerRef.current, true);
  }, [barActions, clearSuggestions]);

  const deactivateSuggestions = useCallback(() => {
    focusedRef.current = false;
    rangeRef.current = null;
    beforeSelectionRef.current = null;
    clearSuggestions();
    releaseSelection();
    barActions?.setActive(ownerRef.current, false);
  }, [barActions, clearSuggestions, releaseSelection]);

  const runSearch = useCallback((text: string, caret: number) => {
    clearSuggestions();
    if (!focusedRef.current || !barActions?.isActive(ownerRef.current)) return;
    const { word } = getCurrentWord(text, caret);
    const { type, query } = parseQuery(word);
    if (query.length < (type ? 0 : MIN_TRIGGER)) return;
    const id = reqIdRef.current;
    const isCurrent = () =>
      id === reqIdRef.current && focusedRef.current &&
      barActions.isActive(ownerRef.current) && textRef.current === text &&
      selectionRef.current.start === caret && selectionRef.current.end === caret;
    debounceRef.current = setTimeout(async () => {
      debounceRef.current = null;
      if (!isCurrent()) return;
      try {
        const results = await searchTags(query, type);
        if (!isCurrent()) return;
        if (results.length > 0) {
          barActions.setSuggestions(ownerRef.current, results, (item) => {
            if (isCurrent() && results.some(result => result.value === item.value && result.type === item.type)) {
              pickFnRef.current(item);
            }
          });
        }
      } catch {
        if (isCurrent()) clearSuggestions();
      }
    }, DEBOUNCE_MS);
  }, [clearSuggestions, barActions]);

  const handleChangeText = useCallback((text: string) => {
    const previousText = textRef.current;
    if (text === previousText) return;
    let edit = getAutocompleteEdit(previousText, text, selectionRef.current);
    let previousRange = rangeRef.current;
    const beforeSelection = beforeSelectionRef.current;
    if (beforeSelection) {
      const precedingEdit = getAutocompleteEdit(previousText, text, beforeSelection.selection);
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
    const nextRange = getAutocompleteRange(text, edit.end);
    let end: number;
    if (previousRange && edit.start >= previousRange.start && edit.previousEnd <= previousRange.end) {
      end = previousRange.end + text.length - previousText.length;
    } else if (getCurrentWord(previousText, edit.start).word.length === 0) {
      // Input at a token's start is a new tag, not the existing right-hand tag.
      end = edit.end;
    } else {
      end = getAutocompleteRange(previousText, edit.start).end + text.length - previousText.length;
    }
    rangeRef.current = { start: nextRange.start, end: Math.min(nextRange.end, Math.max(edit.end, end)) };
    releaseSelection();
    textRef.current = text;
    selectionRef.current = { start: edit.end, end: edit.end };
    onChangeText(text);
    // Text changes must invalidate searches even when the native caret does not move.
    runSearch(text, edit.end);
  }, [onChangeText, releaseSelection, runSearch]);

  const handleSelectionChange = useCallback((e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
    if (!focusedRef.current || !barActions?.isActive(ownerRef.current)) return;
    const sel = e.nativeEvent.selection;
    const pending = pendingSelectionRef.current;
    if (pending) {
      if (sel.start === pending.target.start && sel.end === pending.target.end) {
        selectionRef.current = sel;
        releaseSelection();
        return;
      }
      if (sel.start === pending.previous?.start && sel.end === pending.previous.end) {
        // Ignore at most one stale pre-completion event, not arbitrary user moves.
        pending.previous = null;
        return;
      }
      releaseSelection();
    }
    if (sel.start === selectionRef.current.start && sel.end === selectionRef.current.end) return;
    beforeSelectionRef.current = { selection: selectionRef.current, range: rangeRef.current };
    rangeRef.current = null;
    selectionRef.current = sel;
    if (sel.start === sel.end) runSearch(textRef.current, sel.start);
    else clearSuggestions();
  }, [barActions, runSearch, clearSuggestions, releaseSelection]);

  return {
    selection,
    handleChangeText,
    handleSelectionChange,
    clearSuggestions,
    activateSuggestions,
    deactivateSuggestions,
  };
}
