import { useCallback, useState } from "react";
import {
  type LayoutChangeEvent,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { light, styles } from "../home/styles";
import { ImageArea } from "../home/ImageArea";
import { OptionChips } from "../home/OptionChips";
import { ScalePressable } from "../home/primitives";
import { GenerateButton } from "./GenerateButton";
import { useGenerationStore } from "../../store/generationStore";
import { useAppSheet } from "../../context/AppSheetContext";

export function MainPage({ requestOptions }: { requestOptions: () => void }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const anlasBalance = useGenerationStore((s) => s.anlasBalance);
  const batchCount = useGenerationStore((s) => s.batchCount);
  const [bottomSpacerHeight, setBottomSpacerHeight] = useState(0);
  const { open } = useAppSheet();

  const handleBottomAreaLayout = useCallback((event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height;
    setBottomSpacerHeight((current) =>
      current === 0 || height < current ? height : current,
    );
  }, []);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* 상단 헤더 */}
      <View style={styles.header}>
        <View style={styles.anlasChip}>
          <Ionicons name="diamond-outline" size={16} color={light.accent} />
          <Text style={styles.anlasChipText}>
            {anlasBalance ? anlasBalance.total.toLocaleString() : "—"}
          </Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerCircleButton}
            activeOpacity={0.78}
            accessibilityRole="button"
            accessibilityLabel="Settings"
            onPress={() => router.push("/settings")}
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
      <ImageArea />
      <View style={{ height: bottomSpacerHeight }} pointerEvents="none" />

      {/* 하단: 옵션 + 생성 버튼 (고정 높이) */}
      <View
        onLayout={handleBottomAreaLayout}
        style={[styles.bottomArea, { paddingBottom: insets.bottom + 16 }]}
      >
        {/* 옵션 요약 클릭 → 프롬프트 옵션 탭으로 이동 (시트 아님) */}
        <OptionChips openOptions={requestOptions} />
        <View style={styles.generateControlsRow}>
          <ScalePressable
            style={styles.batchCountButton}
            onPress={() => open("batchCount")}
          >
            <Ionicons
              name="albums-outline"
              size={18}
              color={light.textSecondary}
            />
            <Text style={styles.batchCountButtonText}>{batchCount}장</Text>
          </ScalePressable>
          <GenerateButton />
        </View>
      </View>
    </View>
  );
}
