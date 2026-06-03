import { useCallback, useEffect, useRef, useState } from "react";
import {
  type NativeSyntheticEvent,
  TextInput,
  type TextInputSelectionChangeEventData,
  type StyleProp,
  type TextStyle,
} from "react-native";

import {
  getCurrentWord,
  insertTag,
  MIN_TRIGGER,
  parseQuery,
} from "../lib/autocomplete";
import { searchTags, type TagSuggestion } from "../lib/tagDb";
import { useSuggestionBarActions } from "../context/SuggestionBarContext";
import { colors } from "../styles/colors";

const DEBOUNCE_MS = 150;

export function PromptAutocompleteInput({
  value,
  onChangeText,
  style,
}: {
  value: string;
  onChangeText: (v: string) => void;
  style?: StyleProp<TextStyle>;
}) {
  const inputRef = useRef<TextInput>(null);
  const textRef = useRef(value);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqIdRef = useRef(0);
  // ref pattern: always-fresh pick handler without stale closure issues
  const pickFnRef = useRef<(item: TagSuggestion) => void>(() => {});

  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const barActions = useSuggestionBarActions();

  useEffect(() => {
    textRef.current = value;
  }, [value]);

  pickFnRef.current = (item: TagSuggestion) => {
    const { text, cursor } = insertTag(value, selection.start, item.value);
    textRef.current = text;
    onChangeText(text);
    setSelection({ start: cursor, end: cursor });
    barActions?.clearSuggestions();
    inputRef.current?.focus();
  };

  const clearSuggestions = useCallback(() => {
    barActions?.clearSuggestions();
  }, [barActions]);

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
      debounceRef.current = setTimeout(async () => {
        const id = ++reqIdRef.current;
        const results = await searchTags(query, type);
        if (id !== reqIdRef.current) return;
        if (results.length > 0) {
          barActions?.setSuggestions(results, (item) => pickFnRef.current(item));
        } else {
          clearSuggestions();
        }
      }, DEBOUNCE_MS);
    },
    [clearSuggestions, barActions],
  );

  function handleChangeText(text: string) {
    textRef.current = text;
    onChangeText(text);
  }

  function handleSelectionChange(
    e: NativeSyntheticEvent<TextInputSelectionChangeEventData>,
  ) {
    const sel = e.nativeEvent.selection;
    setSelection(sel);
    if (sel.start === sel.end) runSearch(textRef.current, sel.start);
    else clearSuggestions();
  }

  return (
    <TextInput
      ref={inputRef}
      value={value}
      onChangeText={handleChangeText}
      selection={selection}
      onSelectionChange={handleSelectionChange}
      onBlur={clearSuggestions}
      multiline
      textAlignVertical="top"
      placeholderTextColor={colors.colorTextTertiary}
      style={style}
    />
  );
}
