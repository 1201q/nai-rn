import { useCallback, useEffect, useRef } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import BottomSheet, {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import type { MainScreenNavigationProp } from "../../navigation/types";
import { light, styles } from "../home/styles";
import { ImageArea } from "../home/ImageArea";
import { OptionChips } from "../home/OptionChips";
import { ScalePressable } from "../home/primitives";
import { useGenerationStore } from "../../store/generationStore";
import {
  OptionSheets,
  type SheetKey,
  type SheetRefs,
} from "../home/OptionSheets";

export function MainPage() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<MainScreenNavigationProp>();
  const anlasBalance = useGenerationStore((s) => s.anlasBalance);
  const isLoading = useGenerationStore((s) => s.isLoading);
  const queueTotal = useGenerationStore((s) => s.queueTotal);
  const queueIndex = useGenerationStore((s) => s.queueIndex);
  const requestQueueCancel = useGenerationStore((s) => s.requestQueueCancel);
  const generateImage = useGenerationStore((s) => s.generateImage);

  const sheetRefs: SheetRefs = {
    imageImport: useRef<BottomSheet>(null),
    model: useRef<BottomSheet>(null),
    sampler: useRef<BottomSheet>(null),
    schedule: useRef<BottomSheet>(null),
    steps: useRef<BottomSheet>(null),
    cfg: useRef<BottomSheet>(null),
    cfgRescale: useRef<BottomSheet>(null),
    seed: useRef<BottomSheet>(null),
    resolution: useRef<BottomSheet>(null),
    batchCount: useRef<BottomSheet>(null),
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

  const handleGenerate = () => {
    if (isLoading) {
      requestQueueCancel();
      return;
    }
    generateImage();
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      {/* 상단 헤더 */}
      <View style={styles.header}>
        <View style={styles.anlasChip}>
          <Ionicons name="diamond-outline" size={14} color={light.accent} />
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
            onPress={() => navigation.navigate("Settings")}
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

      {/* 하단: 옵션 + 생성 버튼 (고정 높이) */}
      <View style={[styles.bottomArea, { paddingBottom: insets.bottom + 16 }]}>
        <OptionChips openSheet={openSheet} />
        <ScalePressable style={styles.generateButton} onPress={handleGenerate}>
          {isLoading ? (
            queueTotal > 1 ? (
              <Text style={styles.generateButtonText}>
                취소 ({queueIndex}/{queueTotal})
              </Text>
            ) : (
              <ActivityIndicator color="#ffffff" size="small" />
            )
          ) : (
            <>
              <Ionicons name="sparkles" size={18} color="#ffffff" />
              <Text style={styles.generateButtonText}>생성</Text>
            </>
          )}
        </ScalePressable>
      </View>

      <OptionSheets
        sheetRefs={sheetRefs}
        onSheetChange={handleSheetChange}
        renderBackdrop={renderBackdrop}
      />
    </View>
  );
}
