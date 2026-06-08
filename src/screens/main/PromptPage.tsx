import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { useGenerationStore } from "../../store/generationStore";
import { CharacterScreen } from "../CharacterScreen";
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
  const focusedRef = useRef(false);
  const [text, setText] = useState(value);
  const latestRef = useRef(value);

  useEffect(() => {
    if (!focusedRef.current) {
      setText(value);
      latestRef.current = value;
    }
  }, [value]);

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
        value={text}
        onChangeText={(t) => {
          setText(t);
          latestRef.current = t;
        }}
        onFocus={() => {
          focusedRef.current = true;
        }}
        onBlur={() => {
          focusedRef.current = false;
          onCommit(latestRef.current);
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
    <View style={[styles.tabScreen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <Text style={styles.headerTitle}>Prompt</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAwareScrollView
        bottomOffset={24}
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
    </View>
  );
}

export function PromptPage() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<PromptTab>("prompt");

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      <View style={styles.content}>
        {tab === "prompt" ? <PromptTabContent /> : <CharacterScreen embedded />}
      </View>

      {/* 하단 플로팅 세그먼트 탭 */}
      <View style={[styles.tabBarWrap, { bottom: insets.bottom + 16 }]}>
        <View style={styles.tabBar}>
          {TABS.map(({ key, label, icon }) => {
            const active = tab === key;
            return (
              <Pressable
                key={key}
                onPress={() => setTab(key)}
                style={[styles.tab, active && styles.tabActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Ionicons
                  name={icon}
                  size={20}
                  color={active ? light.textPrimary : light.textSecondary}
                />
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
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
    fontFamily: "serif",
    fontSize: 20,
    fontWeight: "600",
    color: light.textPrimary,
  },
  headerSpacer: {
    width: 44,
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
  tabBarWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: light.bg,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: light.border,
    padding: 4,
    gap: 4,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
  },
  tabActive: {
    backgroundColor: light.surface,
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
