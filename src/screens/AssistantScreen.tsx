import { useCallback, useEffect, useRef } from "react";
import { BackHandler, Text, TouchableOpacity, View } from "react-native";
import BottomSheet, {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
} from "react-native-reanimated";
import {
  KeyboardStickyView,
  useReanimatedKeyboardAnimation,
} from "react-native-keyboard-controller";
import { useNavigation } from "@react-navigation/native";

import type { AssistantScreenNavigationProp } from "../navigation/types";
import { light, styles } from "./assistant/styles";
import {
  PROMPT_MIN_HEIGHT,
  CHIP_ROW_HEIGHT,
  CHIP_ROW_GAP,
} from "./assistant/constants";
import { ImageArea } from "./assistant/ImageArea";
import { OptionChips } from "./assistant/OptionChips";
import { AssistantSuggestionBar } from "./assistant/SuggestionBar";
import { PromptCard } from "./assistant/PromptCard";
import { SuggestionBarProvider } from "../context/SuggestionBarContext";
import {
  OptionSheets,
  type SheetKey,
  type SheetRefs,
} from "./assistant/OptionSheets";

export function AssistantScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<AssistantScreenNavigationProp>();

  const sheetRefs: SheetRefs = {
    model: useRef<BottomSheet>(null),
    sampler: useRef<BottomSheet>(null),
    schedule: useRef<BottomSheet>(null),
    steps: useRef<BottomSheet>(null),
    cfg: useRef<BottomSheet>(null),
    cfgRescale: useRef<BottomSheet>(null),
    seed: useRef<BottomSheet>(null),
    resolution: useRef<BottomSheet>(null),
  };
  const activeSheetRef = useRef<SheetKey | null>(null);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        const active = activeSheetRef.current;
        if (active) {
          sheetRefs[active].current?.close();
          return true;
        }
        return false;
      },
    );
    return () => subscription.remove();
    // sheetRefs 는 마운트 동안 안정적이라 deps 불필요
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSheetChange = useCallback(
    (sheet: SheetKey, index: number) => {
      if (index >= 0) {
        activeSheetRef.current = sheet;
      } else if (activeSheetRef.current === sheet) {
        activeSheetRef.current = null;
      }
    },
    [],
  );

  const openSheet = useCallback(
    (key: SheetKey) => {
      sheetRefs[key].current?.snapToIndex(0);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
      />
    ),
    [],
  );

  // 입력창 높이(UI 스레드). PromptCard 가 구동, ImageArea 의 이미지 스케일이 이를 읽음.
  const inputHeight = useSharedValue(PROMPT_MIN_HEIGHT);

  // 키보드 진행도(0=닫힘, 1=열림). 키보드 올라오면 옵션 칩 줄을 접고, 같은 자리에
  // 태그 추천 바를 펼침(서로 반대 애니, UI 스레드, 재렌더 없음).
  const { progress } = useReanimatedKeyboardAnimation();
  const chipsAnimStyle = useAnimatedStyle(() => ({
    height: interpolate(progress.value, [0, 1], [CHIP_ROW_HEIGHT, 0]),
    marginBottom: interpolate(progress.value, [0, 1], [CHIP_ROW_GAP, 0]),
    opacity: interpolate(progress.value, [0, 1], [1, 0]),
  }));
  const suggestAnimStyle = useAnimatedStyle(() => ({
    height: interpolate(progress.value, [0, 1], [0, CHIP_ROW_HEIGHT]),
    marginBottom: interpolate(progress.value, [0, 1], [0, CHIP_ROW_GAP]),
    opacity: progress.value,
  }));

  return (
    <SuggestionBarProvider>
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      {/* 상단 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerCircleButton}
          activeOpacity={0.78}
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={22} color={light.textPrimary} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>test1</Text>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerCircleButton}
            activeOpacity={0.78}
            accessibilityRole="button"
            accessibilityLabel="History"
            onPress={() => navigation.navigate("AssistantHistory")}
          >
            <Ionicons name="time-outline" size={20} color={light.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerCircleButton}
            activeOpacity={0.78}
            accessibilityRole="button"
            accessibilityLabel="Settings"
            onPress={() => navigation.navigate("AssistantSettings")}
          >
            <Ionicons
              name="settings-outline"
              size={20}
              color={light.textPrimary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* 중단: 생성 이미지 영역 */}
      <ImageArea inputHeight={inputHeight} />

      {/* 하단: 옵션 + 프롬프트 */}
      <KeyboardStickyView
        style={[
          styles.bottomArea,
          { gap: 0, paddingBottom: insets.bottom + 16 },
        ]}
        offset={{ closed: 0, opened: 0 }}
      >
        <Animated.View style={[styles.optionChipsWrap, chipsAnimStyle]}>
          <OptionChips openSheet={openSheet} />
        </Animated.View>
        <Animated.View style={[styles.optionChipsWrap, suggestAnimStyle]}>
          <AssistantSuggestionBar />
        </Animated.View>
        <PromptCard inputHeight={inputHeight} />
      </KeyboardStickyView>

      <OptionSheets
        sheetRefs={sheetRefs}
        onSheetChange={handleSheetChange}
        renderBackdrop={renderBackdrop}
      />
    </View>
    </SuggestionBarProvider>
  );
}
