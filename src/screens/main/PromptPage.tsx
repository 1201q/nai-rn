import { useEffect, useRef, useState } from "react";
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import {
  KeyboardAwareScrollView,
  KeyboardStickyView,
} from "react-native-keyboard-controller";

import { useGenerationStore } from "../../store/generationStore";
import { CharacterScreen } from "../CharacterScreen";
import { SuggestionBarProvider } from "../../context/SuggestionBarContext";
import { usePromptAutocomplete } from "../../hooks/usePromptAutocomplete";
import { StickySuggestionBar } from "../home/SuggestionBar";
import { light } from "../home/styles";

type PromptTab = "prompt" | "character";

const TABS: {
  key: PromptTab;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: "prompt", label: "프롬프트", icon: "document-text-outline" },
  { key: "character", label: "캐릭터 프롬프트", icon: "person-outline" },
];

// base/negative 입력도 고빈도 편집. PromptCard 와 동일하게 로컬 state 로 보유,
// store 동기화는 blur/언마운트 시에만.
function PromptField({
  label,
  value,
  onCommit,
  minHeight,
}: {
  label: string;
  value: string;
  onCommit: (v: string) => void;
  minHeight: number;
}) {
  const inputRef = useRef<TextInput>(null);
  const focusedRef = useRef(false);
  const [text, setText] = useState(value);
  const latestRef = useRef(value);

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

  // 언마운트(탭 전환/네비 등 blur 미발생) 대비 최종 동기화
  useEffect(
    () => () => onCommit(latestRef.current),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{label}</Text>
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
        style={[styles.cardInput, { minHeight }]}
      />
    </View>
  );
}

function PromptTabContent() {
  const insets = useSafeAreaInsets();
  const prompt = useGenerationStore((s) => s.prompt);
  const setPrompt = useGenerationStore((s) => s.setPrompt);
  const negativePrompt = useGenerationStore((s) => s.negativePrompt);
  const setNegativePrompt = useGenerationStore((s) => s.setNegativePrompt);

  return (
    <SuggestionBarProvider>
      <View style={[styles.tabScreen, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Prompt</Text>
        </View>

        <KeyboardAwareScrollView
          bottomOffset={72}
          contentContainerStyle={[
            styles.tabContent,
            { paddingBottom: insets.bottom + 96 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <PromptField
            label="Prompt"
            value={prompt}
            onCommit={setPrompt}
            minHeight={220}
          />
          <PromptField
            label="Negative Prompt"
            value={negativePrompt}
            onCommit={setNegativePrompt}
            minHeight={120}
          />
        </KeyboardAwareScrollView>

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

const TAB_BAR_PADDING = 4;
const PILL_TIMING = { duration: 200, easing: Easing.bezier(0.4, 0, 0.2, 1) };

export function PromptPage() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<PromptTab>("prompt");
  const activeTabRef = useRef<PromptTab>("prompt");
  const tabLayouts = useRef<
    Partial<Record<PromptTab, { x: number; width: number }>>
  >({});
  const pillX = useSharedValue(0);
  const pillWidth = useSharedValue(0);

  const pillStyle = useAnimatedStyle(() => ({
    left: pillX.value,
    width: pillWidth.value,
  }));

  const handleTabLayout = (key: PromptTab) => (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    if (width === 0) return;
    tabLayouts.current[key] = { x, width };
    if (key === activeTabRef.current) {
      // content-area 기준 x → absolute 좌표로 변환
      pillX.value = x;
      pillWidth.value = width;
    }
  };

  const handleTabPress = (key: PromptTab) => {
    activeTabRef.current = key;
    setTab(key);
    const layout = tabLayouts.current[key];
    if (layout) {
      pillX.value = withTiming(layout.x, PILL_TIMING);
      pillWidth.value = withTiming(layout.width, PILL_TIMING);
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      <View style={styles.content}>
        {tab === "prompt" ? <PromptTabContent /> : <CharacterScreen embedded />}
      </View>

      {/* 하단 플로팅 세그먼트 탭 */}
      <View style={[styles.tabBarWrap, { bottom: insets.bottom + 16 }]}>
        <View style={styles.tabBarShadow}>
          <BlurView intensity={60} tint="light" style={styles.tabBar}>
            <Animated.View
              style={[styles.slidingPill, pillStyle]}
              pointerEvents="none"
            />
            {TABS.map(({ key, label, icon }) => {
              const active = tab === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => handleTabPress(key)}
                  onLayout={handleTabLayout(key)}
                  style={styles.tab}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Ionicons
                    name={icon}
                    size={20}
                    color={active ? light.textPrimary : light.textSecondary}
                  />
                  <Text
                    style={[styles.tabLabel, active && styles.tabLabelActive]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </BlurView>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: light.bg,
  },
  content: {
    flex: 1,
  },
  tabScreen: {
    flex: 1,
  },
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: light.textPrimary,
  },
  tabContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 12,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: light.border,
    backgroundColor: light.bg,
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 8,
  },
  cardLabel: {
    fontSize: 13,
    color: light.textSecondary,
  },
  cardInput: {
    fontSize: 15,
    lineHeight: 22,
    color: light.textPrimary,
    padding: 0,
  },
  suggestionSticky: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    elevation: 20,
  },
  tabBarWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  tabBarShadow: {
    borderRadius: 999,
    shadowColor: "#00000076",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  tabBar: {
    flexDirection: "row",
    borderRadius: 999,
    padding: 4,
    gap: 4,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,1)",
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
  },
  slidingPill: {
    position: "absolute",
    top: TAB_BAR_PADDING,
    bottom: TAB_BAR_PADDING,
    borderRadius: 999,
    backgroundColor: light.surfaceAlt,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: light.textSecondary,
  },
  tabLabelActive: {
    color: light.textPrimary,
  },
});
