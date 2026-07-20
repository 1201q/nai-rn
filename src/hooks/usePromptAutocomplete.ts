import { useCallback, useEffect, useRef } from "react";
import {
  type NativeSyntheticEvent,
  type TextInput,
  type TextInputSelectionChangeEventData,
} from "react-native";

import {
  getCurrentWord,
  insertTag,
  MIN_TRIGGER,
  parseQuery,
} from "../lib/autocomplete";
import { searchTags, type TagSuggestion } from "../lib/tagDb";
import { useSuggestionBarActions } from "../context/SuggestionBarContext";

const DEBOUNCE_MS = 150;

/**
 * 프롬프트 TextInput 에 태그 자동완성을 붙이는 훅. PromptAutocompleteInput 의
 * 로직과 동일하나, 화면별로 다른 입력 컴포넌트(로컬 state 보유 등)에 끼워넣을 수
 * 있도록 props 묶음으로 반환한다. 추천 데이터는 SuggestionBarProvider 로 흐른다.
 *
 * 반환 핸들러를 TextInput 에 연결:
 *   <TextInput
 *     onChangeText={ac.handleChangeText}
 *     onSelectionChange={ac.handleSelectionChange}
 *   />
 * 단 onBlur 는 호출부에서 합성(기존 blur 처리와 병행)하도록 clearSuggestions 로 노출.
 */
export function usePromptAutocomplete({
  value,
  onChangeText,
  inputRef,
}: {
  value: string;
  onChangeText: (v: string) => void;
  inputRef: React.RefObject<TextInput | null>;
}) {
  const textRef = useRef(value);
  const selectionRef = useRef({ start: 0, end: 0 });
  const selectionFrameRef = useRef<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqIdRef = useRef(0);
  // ref pattern: 스테일 클로저 없이 항상 최신 pick 핸들러
  const pickFnRef = useRef<(item: TagSuggestion) => void>(() => {});

  const barActions = useSuggestionBarActions();

  useEffect(() => {
    textRef.current = value;
  }, [value]);

  pickFnRef.current = (item: TagSuggestion) => {
    const { text, cursor } = insertTag(
      textRef.current,
      selectionRef.current.start,
      item.value,
    );
    textRef.current = text;
    selectionRef.current = { start: cursor, end: cursor };
    onChangeText(text);
    barActions?.clearSuggestions();
    inputRef.current?.focus();

    if (selectionFrameRef.current !== null) {
      cancelAnimationFrame(selectionFrameRef.current);
    }
    selectionFrameRef.current = requestAnimationFrame(() => {
      selectionFrameRef.current = null;
      inputRef.current?.setNativeProps({
        selection: { start: cursor, end: cursor },
      });
    });
  };

  useEffect(
    () => () => {
      if (selectionFrameRef.current !== null) {
        cancelAnimationFrame(selectionFrameRef.current);
      }
    },
    [],
  );

  const clearSuggestions = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    reqIdRef.current += 1;
    barActions?.clearSuggestions();
  }, [barActions]);

  const activateSuggestions = useCallback(() => {
    barActions?.setActive(true);
  }, [barActions]);

  const deactivateSuggestions = useCallback(() => {
    clearSuggestions();
    barActions?.setActive(false);
  }, [barActions, clearSuggestions]);

  const runSearch = useCallback(
    (text: string, caret: number) => {
      const { word } = getCurrentWord(text, caret);
      const { type, query } = parseQuery(word);
      const minLen = type ? 0 : MIN_TRIGGER;
      if (query.length < minLen) {
        clearSuggestions();
        return;
      }
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const id = ++reqIdRef.current;
      debounceRef.current = setTimeout(async () => {
        const results = await searchTags(query, type);
        if (id !== reqIdRef.current) return;
        if (results.length > 0) {
          barActions?.setSuggestions(results, (item) =>
            pickFnRef.current(item),
          );
        } else {
          clearSuggestions();
        }
      }, DEBOUNCE_MS);
    },
    [clearSuggestions, barActions],
  );

  const handleChangeText = useCallback(
    (text: string) => {
      textRef.current = text;
      onChangeText(text);
    },
    [onChangeText],
  );

  const handleSelectionChange = useCallback(
    (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
      const sel = e.nativeEvent.selection;
      selectionRef.current = sel;
      if (sel.start === sel.end) runSearch(textRef.current, sel.start);
      else clearSuggestions();
    },
    [runSearch, clearSuggestions],
  );

  return {
    handleChangeText,
    handleSelectionChange,
    clearSuggestions,
    activateSuggestions,
    deactivateSuggestions,
  };
}
