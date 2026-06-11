import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  type LayoutChangeEvent,
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
import { OptionSheets } from "../home/OptionSheets";
import type { OptionRoute, OptionsSheetHandle } from "../home/OptionsSheet";

export function MainPage({
  onSheetOpenChange,
}: {
  onSheetOpenChange?: (isOpen: boolean) => void;
}) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<MainScreenNavigationProp>();
  const anlasBalance = useGenerationStore((s) => s.anlasBalance);
  const isLoading = useGenerationStore((s) => s.isLoading);
  const queueTotal = useGenerationStore((s) => s.queueTotal);
  const queueIndex = useGenerationStore((s) => s.queueIndex);
  const batchCount = useGenerationStore((s) => s.batchCount);
  const requestQueueCancel = useGenerationStore((s) => s.requestQueueCancel);
  const generateImage = useGenerationStore((s) => s.generateImage);
  const [bottomSpacerHeight, setBottomSpacerHeight] = useState(0);

  const optionsRef = useRef<OptionsSheetHandle>(null);
  const imageImportRef = useRef<BottomSheet>(null);
  const openSheetsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        // OptionsSheet 는 자체 백(상세→메뉴→닫기)을 소유. 여기선 imageImport 만.
        if (openSheetsRef.current.has("imageImport")) {
          imageImportRef.current?.close();
          return true;
        }
        return false;
      },
    );
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    return () => {
      onSheetOpenChange?.(false);
    };
  }, [onSheetOpenChange]);

  const setSheetOpen = useCallback(
    (id: string, open: boolean) => {
      const set = openSheetsRef.current;
      const had = set.size > 0;
      if (open) set.add(id);
      else set.delete(id);
      const has = set.size > 0;
      if (had !== has) onSheetOpenChange?.(has);
    },
    [onSheetOpenChange],
  );

  const handleSheetChange = useCallback(
    (sheet: string, index: number) => {
      setSheetOpen(sheet, index >= 0);
    },
    [setSheetOpen],
  );

  const handleOptionsOpenChange = useCallback(
    (open: boolean) => setSheetOpen("options", open),
    [setSheetOpen],
  );

  const openOptions = useCallback((route?: OptionRoute) => {
    optionsRef.current?.openAt(route);
  }, []);

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

  const handleBottomAreaLayout = useCallback((event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height;
    setBottomSpacerHeight((current) =>
      current === 0 || height < current ? height : current,
    );
  }, []);

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
      <View style={{ height: bottomSpacerHeight }} pointerEvents="none" />

      {/* 하단: 옵션 + 생성 버튼 (고정 높이) */}
      <View
        onLayout={handleBottomAreaLayout}
        style={[styles.bottomArea, { paddingBottom: insets.bottom + 16 }]}
      >
        <OptionChips openOptions={openOptions} />
        <View style={styles.generateControlsRow}>
          <ScalePressable
            style={styles.batchCountButton}
            onPress={() => openOptions("batchCount")}
          >
            <Ionicons
              name="albums-outline"
              size={18}
              color={light.textSecondary}
            />
            <Text style={styles.batchCountButtonText}>{batchCount}장</Text>
          </ScalePressable>
          <View style={styles.generateButtonWrap}>
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
        </View>
      </View>

      <OptionSheets
        optionsRef={optionsRef}
        imageImportRef={imageImportRef}
        onOptionsOpenChange={handleOptionsOpenChange}
        onSheetChange={handleSheetChange}
        renderBackdrop={renderBackdrop}
      />
    </View>
  );
}
