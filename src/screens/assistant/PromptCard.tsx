import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Reanimated, {
  useAnimatedStyle,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useNavigation } from "@react-navigation/native";

import { useGenerationStore } from "../../store/generationStore";
import type { AssistantScreenNavigationProp } from "../../navigation/types";
import { light, styles } from "./styles";
import { PromptModePill, ScalePressable } from "./primitives";
import { PROMPT_MAX_HEIGHT, PROMPT_MIN_HEIGHT } from "./constants";

// 프롬프트 입력은 고빈도 편집. 텍스트를 로컬 state로 보유해 키 입력당 전체
// 화면 재렌더를 막고, store 동기화는 blur/전송/언마운트 시에만. 전송 시엔
// 최신 로컬값을 직접 전달해 stale 방지.
export function PromptCard({ inputHeight }: { inputHeight: SharedValue<number> }) {
  const navigation = useNavigation<AssistantScreenNavigationProp>();
  const prompt = useGenerationStore((s) => s.prompt);
  const setPrompt = useGenerationStore((s) => s.setPrompt);
  const negativePrompt = useGenerationStore((s) => s.negativePrompt);
  const setNegativePrompt = useGenerationStore((s) => s.setNegativePrompt);
  const isLoading = useGenerationStore((s) => s.isLoading);
  const generateImage = useGenerationStore((s) => s.generateImage);

  const [mode, setMode] = useState<"base" | "negative">("base");
  const [baseText, setBaseText] = useState(prompt);
  const [negText, setNegText] = useState(negativePrompt);
  const focusedRef = useRef(false);
  // 언마운트(네비게이션 등 blur 미발생) 대비 최신값 보존
  const latestRef = useRef({ base: prompt, neg: negativePrompt });

  const heights = useRef<Record<"base" | "negative", number>>({
    base: PROMPT_MIN_HEIGHT,
    negative: PROMPT_MIN_HEIGHT,
  });

  // 외부(저장소 로드 등) 변경은 포커스 아닐 때만 로컬에 반영 (타이핑 중엔 로컬 우선)
  useEffect(() => {
    if (!focusedRef.current) {
      setBaseText(prompt);
      latestRef.current.base = prompt;
    }
  }, [prompt]);
  useEffect(() => {
    if (!focusedRef.current) {
      setNegText(negativePrompt);
      latestRef.current.neg = negativePrompt;
    }
  }, [negativePrompt]);

  const onChangeText = (t: string) => {
    if (mode === "base") {
      setBaseText(t);
      latestRef.current.base = t;
    } else {
      setNegText(t);
      latestRef.current.neg = t;
    }
  };

  const flushBoth = () => {
    setPrompt(latestRef.current.base);
    setNegativePrompt(latestRef.current.neg);
  };

  // 언마운트 시 마지막 동기화 (blur 가 안 올 수 있음)
  useEffect(
    () => () => {
      setPrompt(latestRef.current.base);
      setNegativePrompt(latestRef.current.neg);
    },
    [setPrompt, setNegativePrompt],
  );

  const handleContentSizeChange = (e: {
    nativeEvent: { contentSize: { height: number } };
  }) => {
    const next = Math.min(
      PROMPT_MAX_HEIGHT,
      Math.max(PROMPT_MIN_HEIGHT, e.nativeEvent.contentSize.height),
    );
    heights.current[mode] = next;
    inputHeight.value = withTiming(next, { duration: 150 });
  };

  // 모드 전환은 콘텐츠 변화가 없어 onContentSizeChange 안 옴 → 기억한 높이로 즉시 반영
  useEffect(() => {
    inputHeight.value = withTiming(heights.current[mode], { duration: 150 });
  }, [mode, inputHeight]);

  const inputAnimStyle = useAnimatedStyle(() => ({
    height: inputHeight.value,
  }));

  const handleSubmit = () => {
    if (isLoading) return;
    flushBoth();
    generateImage(undefined, {
      prompt: latestRef.current.base,
      negativePrompt: latestRef.current.neg,
    });
  };

  return (
    <View style={styles.promptCard}>
      <Reanimated.View style={[styles.promptInputWrap, inputAnimStyle]}>
        <TextInput
          style={styles.promptInput}
          value={mode === "base" ? baseText : negText}
          onChangeText={onChangeText}
          onFocus={() => {
            focusedRef.current = true;
          }}
          onBlur={() => {
            focusedRef.current = false;
            flushBoth();
          }}
          onContentSizeChange={handleContentSizeChange}
          placeholder="Ready to help, ask anything…"
          placeholderTextColor={light.textHint}
          multiline
        />
        <View style={styles.expandButton}>
          <Ionicons name="scan-outline" size={16} color={light.textSecondary} />
        </View>
      </Reanimated.View>

      <View style={styles.promptActionRow}>
        <View style={styles.promptActionLeft}>
          <PromptModePill mode={mode} onChange={setMode} />
          <ScalePressable
            style={styles.characterButton}
            onPress={() => navigation.navigate("AssistantCharacter")}
          >
            <Ionicons
              name="person-outline"
              size={15}
              color={light.textSecondary}
            />
            <Text style={styles.characterButtonText}>Character</Text>
          </ScalePressable>
        </View>
        <ScalePressable style={styles.submitButton} onPress={handleSubmit}>
          {isLoading ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Ionicons name="arrow-up" size={22} color="#ffffff" />
          )}
        </ScalePressable>
      </View>
    </View>
  );
}
