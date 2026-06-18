import { useEffect } from "react";
import { Text, View } from "react-native";
import Reanimated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

import { light, styles } from "../home/styles";
import { ScalePressable } from "../home/primitives";
import {
  selectOverallPercent,
  useGenerationStore,
} from "../../store/generationStore";

// 생성 진행률 구독을 이 작은 leaf에 격리 (step 갱신이 MainPage 전체를 리렌더하지 않도록).
export function GenerateButton() {
  const isLoading = useGenerationStore((s) => s.isLoading);
  const queueTotal = useGenerationStore((s) => s.queueTotal);
  const queueIndex = useGenerationStore((s) => s.queueIndex);
  const percent = useGenerationStore(selectOverallPercent);
  const generateImage = useGenerationStore((s) => s.generateImage);
  const requestQueueCancel = useGenerationStore((s) => s.requestQueueCancel);

  const fill = useSharedValue(0);
  useEffect(() => {
    // 350ms 간격 갱신 사이를 부드럽게 보간 (UI 스레드).
    fill.value = isLoading
      ? withTiming(percent, { duration: 300, easing: Easing.linear })
      : 0;
  }, [percent, isLoading, fill]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${fill.value * 100}%`,
  }));

  const handlePress = () => {
    if (isLoading) {
      requestQueueCancel();
      return;
    }
    generateImage();
  };

  const pct = Math.round(percent * 100);

  return (
    <View style={styles.generateButtonWrap}>
      <ScalePressable
        style={
          isLoading
            ? [styles.generateButton, styles.generateButtonLoading]
            : styles.generateButton
        }
        onPress={handlePress}
      >
        {isLoading && (
          <Reanimated.View style={[styles.generateButtonFill, fillStyle]} />
        )}
        <View style={styles.generateButtonContent}>
          {isLoading ? (
            <Text style={styles.generateButtonText}>
              {queueTotal > 1
                ? `취소 (${queueIndex}/${queueTotal}) · ${pct}%`
                : `취소 · ${pct}%`}
            </Text>
          ) : (
            <>
              <Ionicons name="sparkles" size={18} color={light.accentText} />
              <Text style={styles.generateButtonText}>생성</Text>
            </>
          )}
        </View>
      </ScalePressable>
    </View>
  );
}
