import { useEffect, useRef, useState } from "react";
import {
  Animated as RNAnimated,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import {
  KeyboardAwareScrollView,
  KeyboardStickyView,
  type KeyboardAwareScrollViewRef,
} from "react-native-keyboard-controller";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";

import {
  type CharacterPrompt,
  useGenerationStore,
} from "../store/generationStore";
import type { CharacterScreenNavigationProp } from "../navigation/types";
import { SuggestionBarProvider } from "../context/SuggestionBarContext";
import { usePromptAutocomplete } from "../hooks/usePromptAutocomplete";
import { triggerSelectionHaptic, BADGE_COLORS } from "./option/helpers";
import { StickySuggestionBar } from "./home/SuggestionBar";
import { FloatingPillHeader } from "../components/FloatingPillHeader";
import { ScreenEdgeFade } from "../components/ScreenEdgeFade";
import { light } from "./home/styles";

const MAX_CHARACTER_PROMPTS = 6;
const TEXTAREA_MIN_HEIGHT = 88;
const CHARACTER_LAYOUT = LinearTransition.duration(220);
const CHARACTER_BODY_ENTERING = FadeIn.duration(140);
const CHARACTER_BODY_EXITING = FadeOut.duration(100);

// 캐릭터 프롬프트 입력도 고빈도 편집. PromptCard 와 동일하게 텍스트를 로컬
// state 로 보유해 키 입력당 store 갱신(전체 배열 재생성 + 재렌더 + persist write)을
// 막고, store 동기화는 blur/언마운트(카드 접힘·네비) 시에만.
function LabeledPromptInput({
  label,
  negative,
  value,
  onCommit,
}: {
  label: string;
  negative?: boolean;
  value: string;
  onCommit: (v: string) => void;
}) {
  const inputRef = useRef<TextInput>(null);
  const focusedRef = useRef(false);
  const [text, setText] = useState(value);
  const [inputHeight, setInputHeight] = useState(TEXTAREA_MIN_HEIGHT);
  const latestRef = useRef(value);

  // 외부(import 등) 변경은 포커스 아닐 때만 로컬에 반영 (타이핑 중엔 로컬 우선)
  useEffect(() => {
    if (!focusedRef.current) {
      setText(value);
      latestRef.current = value;
    }
  }, [value]);

  const onChangeText = (t: string) => {
    setText(t);
    latestRef.current = t;
  };
  const autocomplete = usePromptAutocomplete({
    value: text,
    onChangeText,
    inputRef,
  });

  // 언마운트(카드 접힘/네비 등 blur 미발생) 대비 최종 동기화
  useEffect(
    () => () => onCommit(latestRef.current),
    // onCommit 은 매 렌더 새 함수지만 cleanup 만 쓰고, 커밋은 store getState 기반이라
    // stale 위험 없음 → 의도적으로 deps 비움
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <View style={styles.labeledInput}>
      <Text style={[styles.inputLabel, negative && styles.negativeLabel]}>
        {label}
      </Text>
      <TextInput
        ref={inputRef}
        value={text}
        onChangeText={autocomplete.handleChangeText}
        selection={autocomplete.selection}
        onSelectionChange={autocomplete.handleSelectionChange}
        onFocus={() => {
          focusedRef.current = true;
        }}
        onBlur={() => {
          focusedRef.current = false;
          onCommit(latestRef.current);
          autocomplete.clearSuggestions();
        }}
        multiline
        textAlignVertical="top"
        placeholderTextColor={light.textHint}
        onContentSizeChange={(e) =>
          setInputHeight(
            Math.max(TEXTAREA_MIN_HEIGHT, e.nativeEvent.contentSize.height),
          )
        }
        style={[styles.textArea, { height: inputHeight }]}
      />
    </View>
  );
}

function CharacterPromptCard({
  item,
  index,
  expanded,
  onToggleExpand,
  onUpdate,
}: {
  item: CharacterPrompt;
  index: number;
  expanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (values: Partial<Omit<CharacterPrompt, "id">>) => void;
}) {
  const badgeColor = BADGE_COLORS[index % BADGE_COLORS.length];
  const title = item.prompt.trim() || `Character ${index + 1}`;

  return (
    <Animated.View
      layout={CHARACTER_LAYOUT}
      style={[
        styles.characterCard,
        !item.enabled && styles.characterCardDisabled,
      ]}
    >
      <View style={styles.characterCardHeader}>
        <TouchableOpacity
          style={styles.characterCardHeaderMain}
          activeOpacity={0.78}
          onPress={onToggleExpand}
        >
          <View style={styles.characterAvatar}>
            <Ionicons
              name="person-outline"
              size={20}
              color={light.textSecondary}
            />
          </View>
          <View
            style={[styles.characterBadge, { backgroundColor: badgeColor }]}
          >
            <Text style={styles.characterBadgeText}>{index + 1}</Text>
          </View>
          <Text style={styles.characterCardTitle} numberOfLines={1}>
            {title}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.characterHeaderIcon}
          activeOpacity={0.78}
          onPress={() => {
            onUpdate({ enabled: !item.enabled });
            triggerSelectionHaptic();
          }}
        >
          <Ionicons
            name={item.enabled ? "eye-outline" : "eye-off-outline"}
            size={22}
            color={item.enabled ? light.textPrimary : light.textHint}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.characterHeaderIcon}
          activeOpacity={0.78}
          onPress={onToggleExpand}
        >
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={20}
            color={light.textHint}
          />
        </TouchableOpacity>
      </View>
      {expanded ? (
        <Animated.View
          entering={CHARACTER_BODY_ENTERING}
          exiting={CHARACTER_BODY_EXITING}
          layout={CHARACTER_LAYOUT}
          style={styles.characterCardBody}
        >
          <LabeledPromptInput
            label="Base"
            value={item.prompt}
            onCommit={(next) => onUpdate({ prompt: next })}
          />
          <LabeledPromptInput
            label="Negative"
            negative
            value={item.negativePrompt}
            onCommit={(next) => onUpdate({ negativePrompt: next })}
          />
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

export function CharacterScreen({ embedded }: { embedded?: boolean } = {}) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<CharacterScreenNavigationProp>();
  const characterPrompts = useGenerationStore((s) => s.characterPrompts);
  const setCharacterPrompts = useGenerationStore((s) => s.setCharacterPrompts);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const scrollY = useRef(new RNAnimated.Value(0)).current;
  const scrollRef = useRef<KeyboardAwareScrollViewRef>(null);

  function toggleExpand(id: string) {
    setExpandedIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }

  function addCharacterPrompt() {
    if (characterPrompts.length >= MAX_CHARACTER_PROMPTS) {
      return;
    }

    const id = `character-${Date.now()}-${characterPrompts.length}`;
    setCharacterPrompts([
      ...characterPrompts,
      { id, prompt: "", negativePrompt: "", enabled: true },
    ]);
    setExpandedIds((current) => [...current, id]);
    triggerSelectionHaptic();
  }

  function updateCharacterPrompt(
    id: string,
    nextValues: Partial<Omit<CharacterPrompt, "id">>,
  ) {
    // 항상 최신 배열 기준으로 갱신. (한 카드의 Base/Negative 가 접힘·언마운트 시
    // 동시에 커밋될 때 closure 의 stale 배열로 서로 덮어쓰는 것 방지)
    const current = useGenerationStore.getState().characterPrompts;
    setCharacterPrompts(
      current.map((item) =>
        item.id === id ? { ...item, ...nextValues } : item,
      ),
    );
  }

  const canAddCharacterPrompt = characterPrompts.length < MAX_CHARACTER_PROMPTS;

  return (
    <SuggestionBarProvider>
      <View style={styles.screen}>
        <StatusBar style="dark" />

        <KeyboardAwareScrollView
          ref={scrollRef}
          bottomOffset={72}
          scrollEventThrottle={16}
          onScroll={RNAnimated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false },
          )}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 56 },
            embedded
              ? { paddingBottom: insets.bottom + 80 }
              : { paddingBottom: insets.bottom + 48 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {characterPrompts.length > 0 ? (
            <View style={styles.editEntryRow}>
              <Text style={styles.editEntryCount}>
                캐릭터 ({characterPrompts.length})
              </Text>
            </View>
          ) : null}

          {characterPrompts.map((item, index) => (
            <CharacterPromptCard
              key={item.id}
              item={item}
              index={index}
              expanded={expandedIds.includes(item.id)}
              onToggleExpand={() => toggleExpand(item.id)}
              onUpdate={(values) => updateCharacterPrompt(item.id, values)}
            />
          ))}

          <Animated.View layout={CHARACTER_LAYOUT}>
            <TouchableOpacity
              style={[
                styles.addCharacterButton,
                !canAddCharacterPrompt && styles.addCharacterButtonDisabled,
              ]}
              activeOpacity={0.78}
              disabled={!canAddCharacterPrompt}
              onPress={addCharacterPrompt}
            >
              <Ionicons name="add" size={18} color={light.textPrimary} />
              <Text style={styles.addCharacterText}>
                Add Character ({characterPrompts.length}/{MAX_CHARACTER_PROMPTS}
                )
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </KeyboardAwareScrollView>

        <ScreenEdgeFade
          topHeight={insets.top + 64}
          bottomHeight={embedded ? insets.bottom + 140 : insets.bottom + 40}
        />

        <FloatingPillHeader
          title="Character"
          scrollY={scrollY}
          topInset={insets.top}
          variant="solid"
          onTitlePress={() =>
            scrollRef.current?.scrollTo({ y: 0, animated: true })
          }
          left={
            !embedded ? (
              <TouchableOpacity
                style={styles.headerCircleButton}
                activeOpacity={0.78}
                accessibilityRole="button"
                accessibilityLabel="Back"
                onPress={() => navigation.goBack()}
              >
                <Ionicons
                  name="chevron-back"
                  size={22}
                  color={light.textPrimary}
                />
              </TouchableOpacity>
            ) : undefined
          }
          right={
            characterPrompts.length > 0 ? (
              <TouchableOpacity
                style={styles.headerEditButton}
                activeOpacity={0.78}
                accessibilityRole="button"
                accessibilityLabel="캐릭터 편집"
                onPress={() => navigation.navigate("CharacterEdit")}
              >
                <Ionicons
                  name="create-outline"
                  size={22}
                  color={light.textPrimary}
                />
              </TouchableOpacity>
            ) : undefined
          }
        />

        <KeyboardStickyView
          style={styles.suggestionSticky}
          offset={{ closed: 0, opened: 0 }}
        >
          <StickySuggestionBar />
        </KeyboardStickyView>
      </View>
    </SuggestionBarProvider>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: light.bg,
  },
  headerCircleButton: {
    width: 44,
    height: 44,
    marginLeft: 16,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: light.surface,
  },
  headerEditButton: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 12,
  },
  editEntryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  editEntryCount: {
    fontSize: 14,
    fontWeight: "600",
    color: light.textSecondary,
  },
  characterCard: {
    borderRadius: 16,
    backgroundColor: light.surface,
    overflow: "hidden",
  },
  characterCardDisabled: {
    opacity: 0.5,
  },
  characterCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 12,
    paddingRight: 6,
    height: 56,
  },
  characterCardHeaderMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  characterAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: light.surfaceAlt,
  },
  characterBadge: {
    minWidth: 24,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 7,
    paddingHorizontal: 6,
  },
  characterBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
  },
  characterCardTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: light.textPrimary,
  },
  characterHeaderIcon: {
    width: 40,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  characterCardBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 12,
  },
  labeledInput: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: light.textSecondary,
  },
  negativeLabel: {
    color: light.accent,
  },
  textArea: {
    minHeight: TEXTAREA_MIN_HEIGHT,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: light.border,
    backgroundColor: light.bg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    lineHeight: 20,
    includeFontPadding: false,
    color: light.textPrimary,
  },
  addCharacterButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: light.border,
    backgroundColor: light.surface,
  },
  addCharacterButtonDisabled: {
    opacity: 0.5,
  },
  addCharacterText: {
    fontSize: 14,
    fontWeight: "600",
    color: light.textPrimary,
  },
  suggestionSticky: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    elevation: 20,
  },
});
