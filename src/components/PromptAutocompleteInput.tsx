// 태그 자동완성이 붙은 멀티라인 프롬프트 TextInput.
//
// React Native은 커서 픽셀 좌표를 제공하지 않음 -> 웹처럼 커서 옆에 띄우지 못하고
// 후보 목록을 입력창 바로 아래에 배치(높이는 onLayout으로 측정).

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputSelectionChangeEventData,
  type StyleProp,
  type TextStyle,
  View,
} from "react-native";

import {
  getCurrentWord,
  insertTag,
  MIN_TRIGGER,
  parseQuery,
} from "../lib/autocomplete";
import { searchTags, type TagSuggestion, type TagType } from "../lib/tagDb";
import { colors } from "../styles/colors";

const DEBOUNCE_MS = 150;
const ROW_HEIGHT = 44;
const MAX_VISIBLE = 6;

const TYPE_COLOR: Record<TagType, string> = {
  general: colors.blue500,
  artist: colors.orange500,
  character: colors.green500,
  copyright: colors.purple500,
};

function formatCount(n: number): string {
  return n >= 1000 ? `${Math.floor(n / 1000)}k` : String(n);
}

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
  // 최신 텍스트. 동기적으로 갱신해 onSelectionChange가 fresh 값을 읽게 함
  // (`value` prop은 키 입력보다 렌더 한 박자 늦음).
  const textRef = useRef(value);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqIdRef = useRef(0);

  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [suggestions, setSuggestions] = useState<TagSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [inputHeight, setInputHeight] = useState(0);

  // 외부에서 value가 바뀔 때(예: 저장된 옵션 로딩) textRef 동기화.
  // 입력 중에는 handleChangeText가 이미 갱신함.
  useEffect(() => {
    textRef.current = value;
  }, [value]);

  const closeDropdown = useCallback(() => {
    setOpen(false);
    setSuggestions([]);
  }, []);

  const runSearch = useCallback(
    (text: string, caret: number) => {
      const { word } = getCurrentWord(text, caret);
      const { type, query } = parseQuery(word);
      // 명시적 네임스페이스(artist:, character: …)는 첫 글자부터 브라우징,
      // 그냥 단어는 MIN_TRIGGER 글자 이상이어야 검색.
      const minLen = type ? 0 : MIN_TRIGGER;
      if (query.length < minLen) {
        closeDropdown();
        return;
      }
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        const id = ++reqIdRef.current;
        const results = await searchTags(query, type);
        if (id !== reqIdRef.current) return; // 더 새 쿼리가 이걸 대체함
        setSuggestions(results);
        setOpen(results.length > 0);
      }, DEBOUNCE_MS);
    },
    [closeDropdown],
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
    // 커서가 한 점일 때만 검색(범위 선택 중엔 안 함).
    if (sel.start === sel.end) runSearch(textRef.current, sel.start);
    else closeDropdown();
  }

  function handlePick(item: TagSuggestion) {
    const { text, cursor } = insertTag(value, selection.start, item.value);
    textRef.current = text;
    onChangeText(text);
    setSelection({ start: cursor, end: cursor });
    closeDropdown();
    inputRef.current?.focus();
  }

  return (
    <View style={styles.wrap}>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChangeText}
        selection={selection}
        onSelectionChange={handleSelectionChange}
        onBlur={closeDropdown}
        onLayout={(e) => setInputHeight(e.nativeEvent.layout.height)}
        multiline
        textAlignVertical="top"
        placeholderTextColor={colors.colorTextTertiary}
        style={style}
      />
      {open ? (
        <View style={[styles.dropdown, { top: inputHeight + 2 }]}>
          <ScrollView
            keyboardShouldPersistTaps="always"
            nestedScrollEnabled
            style={{ maxHeight: ROW_HEIGHT * MAX_VISIBLE }}
          >
            {suggestions.map((item, i) => (
              <Pressable
                key={`${item.label}-${i}`}
                style={({ pressed }) => [
                  styles.row,
                  pressed && styles.rowPressed,
                ]}
                onPress={() => handlePick(item)}
              >
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: TYPE_COLOR[item.type] },
                  ]}
                />
                <Text style={styles.rowLabel} numberOfLines={1}>
                  {item.label}
                </Text>
                <Text style={styles.rowCount}>{formatCount(item.count)}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "relative",
  },
  dropdown: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 1000,
    elevation: 8,
    backgroundColor: colors.colorBackgroundSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.colorBorderTertiary,
    overflow: "hidden",
  },
  row: {
    height: ROW_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    columnGap: 10,
  },
  rowPressed: {
    backgroundColor: colors.colorBackgroundTertiary,
  },
  badge: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  rowLabel: {
    flex: 1,
    color: colors.colorTextPrimary,
    fontSize: 14,
  },
  rowCount: {
    color: colors.colorTextTertiary,
    fontSize: 12,
  },
});
