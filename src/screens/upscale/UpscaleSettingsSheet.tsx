import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import BottomSheet, {
  BottomSheetScrollView,
  type BottomSheetScrollViewMethods,
  BottomSheetView,
  BottomSheetTextInput,
  useBottomSheetTimingConfigs,
} from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import Reanimated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { SheetSelect } from "../../components/forms/SheetSelect";
import { Toggle } from "../../components/forms/FormControls";
import { Slider } from "../../components/forms/Slider";
import { SteppedSeekbar } from "../../components/forms/SteppedSeekbar";
import {
  GENERATION_SHEET_HEADER_HEIGHT,
  useGenerationChromeMetrics,
} from "../../hooks/useGenerationChromeMetrics";
import type { UpscaleSettings } from "../../store/upscaleQueueStore";
import { tokens } from "../../styles/tokens";
import {
  FixedSheetBackdrop,
  PredictiveBackSheetLayer,
  PressableSurface,
} from "../generation/sheets/SheetLayers";
import {
  SHEET_EASING,
  sheetChromeStyles,
} from "../generation/sheets/sheetChrome";
import {
  FORMATS,
  MODELS,
  noiseOptions,
  normalizeUpscaleSettings,
  scaleOptions,
  TILE_SIZES,
  SYNC_GAPS,
  upscaleSettingsSummary,
} from "./upscaleOptions";
import { UpscaleGpuMemory } from "./UpscaleGpuMemory";
import { UpscaleCpuSettings } from "./UpscaleCpuSettings";

export const UPSCALE_SELECT_PORTAL_HOST = "upscale-select-overlay";

const SETTINGS_BACKDROP_Z_INDEX = 70;
const SETTINGS_SHEET_Z_INDEX = 80;

const MODEL_LABELS = MODELS.map((option) => option.label);
const FORMAT_LABELS = FORMATS.map((option) => option.label);

type SelectKey = "model" | "format";

function SettingsHeader({
  summary,
  open,
  animatedIndex,
  onOpen,
  onClose,
}: {
  summary: string;
  open: boolean;
  animatedIndex: SharedValue<number>;
  onOpen: () => void;
  onClose: () => void;
}) {
  const summaryStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      animatedIndex.value,
      [0, 0.55, 1],
      [1, 0.2, 0],
      Extrapolation.CLAMP,
    ),
  }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      animatedIndex.value,
      [0, 0.45, 1],
      [0, 0.8, 1],
      Extrapolation.CLAMP,
    ),
  }));

  return (
    <View style={styles.header}>
      <Reanimated.View
        pointerEvents={open ? "none" : "auto"}
        accessibilityElementsHidden={open}
        importantForAccessibility={open ? "no-hide-descendants" : "auto"}
        style={[styles.headerLayer, summaryStyle]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Settings 펼치기"
          onPress={onOpen}
          style={({ pressed }) => [
            styles.summaryButton,
            pressed && styles.pressed,
          ]}
        >
          <Text numberOfLines={1} style={styles.summaryText}>
            {summary}
          </Text>
          <Ionicons
            name="chevron-up"
            size={17}
            color={tokens.color.textSecondary}
          />
        </Pressable>
      </Reanimated.View>

      <Reanimated.View
        pointerEvents={open ? "auto" : "none"}
        accessibilityElementsHidden={!open}
        importantForAccessibility={open ? "auto" : "no-hide-descendants"}
        style={[styles.headerLayer, styles.titleLayer, titleStyle]}
      >
        <View style={styles.headerSide}>
          <PressableSurface
            accessibilityLabel="Settings 닫기"
            onPress={onClose}
            style={styles.closeButton}
          >
            <Ionicons
              name="close-outline"
              size={22}
              color={tokens.color.textPrimary}
            />
          </PressableSurface>
        </View>
        <Text style={styles.title}>Settings</Text>
        <View style={styles.headerSide} />
      </Reanimated.View>
    </View>
  );
}

// 접으면 현재 설정 요약만 보이고, 펼치면 설정 전체가 나오는 2단계 시트.
export function UpscaleSettingsSheetHost({
  open,
  settings,
  disabled,
  predictiveBackProgress,
  onOpenChange,
  onChange,
}: {
  open: boolean;
  settings: UpscaleSettings;
  // 업스케일 중에는 설정을 바꿀 수 없다.
  disabled: boolean;
  predictiveBackProgress: SharedValue<number>;
  onOpenChange: (open: boolean) => void;
  onChange: (settings: UpscaleSettings) => void;
}) {
  const sheetRef = useRef<BottomSheet>(null);
  const scrollRef = useRef<BottomSheetScrollViewMethods>(null);
  const { height: windowHeight } = useWindowDimensions();
  const { promptCollapsedHeight, utilitySheetTop, sheetContentPaddingBottom } =
    useGenerationChromeMetrics();
  const animatedIndex = useSharedValue(0);
  const [openSelect, setOpenSelect] = useState<SelectKey | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const animationConfigs = useBottomSheetTimingConfigs({
    duration: 300,
    easing: SHEET_EASING,
  });
  const snapPoints = useMemo(
    () => [
      promptCollapsedHeight,
      Math.max(promptCollapsedHeight, windowHeight - utilitySheetTop),
    ],
    [promptCollapsedHeight, utilitySheetTop, windowHeight],
  );

  useEffect(() => {
    sheetRef.current?.snapToIndex(open ? 1 : 0);
    if (!open) scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [open]);

  const handleSheetAnimate = useCallback(
    (_fromIndex: number, toIndex: number) => {
      // Keep back handling in sync before the opening animation finishes.
      if (toIndex > 0) onOpenChange(true);
    },
    [onOpenChange],
  );
  const handleSheetSettled = useCallback(
    (index: number) => {
      onOpenChange(index > 0);
      predictiveBackProgress.value = withTiming(0, {
        duration: 300,
        easing: SHEET_EASING,
      });
    },
    [onOpenChange, predictiveBackProgress],
  );
  const openSheet = useCallback(() => onOpenChange(true), [onOpenChange]);
  const closeSheet = useCallback(() => onOpenChange(false), [onOpenChange]);

  function change(patch: Partial<UpscaleSettings>) {
    onChange(normalizeUpscaleSettings({ ...settings, ...patch }));
  }

  const modelLabel = MODELS.find(
    (option) => option.value === settings.model,
  )!.label;
  const formatLabel = FORMATS.find(
    (option) => option.value === settings.format,
  )!.label;

  return (
    <>
      <FixedSheetBackdrop
        animatedIndex={animatedIndex}
        appearsOnIndex={1}
        disappearsOnIndex={0}
        visible={open}
        zIndex={SETTINGS_BACKDROP_Z_INDEX}
        accessibilityLabel="Settings 닫기"
        onPress={closeSheet}
      />
      <PredictiveBackSheetLayer
        scaleEnabled={false}
        progress={predictiveBackProgress}
        zIndex={SETTINGS_SHEET_Z_INDEX}
      >
        <BottomSheet
          ref={sheetRef}
          index={open ? 1 : 0}
          snapPoints={snapPoints}
          animatedIndex={animatedIndex}
          animationConfigs={animationConfigs}
          animateOnMount={false}
          enableDynamicSizing={false}
          enableOverDrag={false}
          enablePanDownToClose={false}
          handleStyle={sheetChromeStyles.handleArea}
          handleIndicatorStyle={sheetChromeStyles.handleIndicator}
          containerStyle={styles.sheetContainer}
          backgroundStyle={sheetChromeStyles.sheetBackground}
          onAnimate={handleSheetAnimate}
          onChange={handleSheetSettled}
        >
          <BottomSheetView style={sheetChromeStyles.sheetBody}>
            <SettingsHeader
              summary={upscaleSettingsSummary(settings)}
              open={open}
              animatedIndex={animatedIndex}
              onOpen={openSheet}
              onClose={closeSheet}
            />
            <BottomSheetScrollView
              ref={scrollRef}
              style={styles.scroll}
              contentContainerStyle={[
                styles.scrollContent,
                { paddingBottom: sheetContentPaddingBottom },
              ]}
              showsVerticalScrollIndicator={false}
              scrollEnabled={openSelect === null}
            >
              <View
                pointerEvents={open && !disabled ? "auto" : "none"}
                accessibilityElementsHidden={!open}
                importantForAccessibility={
                  open ? "auto" : "no-hide-descendants"
                }
                style={[styles.fields, disabled && styles.disabled]}
              >
                <SheetSelect
                  label="Model"
                  value={modelLabel}
                  options={MODEL_LABELS}
                  onChange={(label) =>
                    change({
                      model: MODELS.find((option) => option.label === label)!
                        .value,
                    })
                  }
                  open={openSelect === "model"}
                  onOpenChange={(next) => setOpenSelect(next ? "model" : null)}
                  portalHostName={UPSCALE_SELECT_PORTAL_HOST}
                />

                <View style={styles.section}>
                  <Text style={styles.eyebrow}>UPSCALE SETTINGS</Text>
                  <SteppedSeekbar
                    label="Scale"
                    stops={scaleOptions(settings.model)}
                    value={settings.scale}
                    onChange={(scale) => change({ scale })}
                  />
                  <SteppedSeekbar
                    label="Denoise"
                    stops={noiseOptions(settings.model, settings.scale)}
                    value={settings.noise}
                    onChange={(noise) => change({ noise })}
                  />
                  <SteppedSeekbar
                    label="Tile size"
                    stops={TILE_SIZES}
                    value={settings.tileSize}
                    onChange={(tileSize) => change({ tileSize })}
                  />
                  {settings.limitGpuPerformance ? (
                    <Text style={styles.hint}>
                      GPU 성능 제한이 켜져 있어 GPU 타일은 최대 100으로
                      적용됩니다. 자동 계산값이 더 작으면 그 값을 사용합니다.
                    </Text>
                  ) : null}
                </View>

                <SheetSelect
                  label="Format"
                  value={formatLabel}
                  options={FORMAT_LABELS}
                  onChange={(label) =>
                    change({
                      format: FORMATS.find((option) => option.label === label)!
                        .value,
                    })
                  }
                  open={openSelect === "format"}
                  onOpenChange={(next) => setOpenSelect(next ? "format" : null)}
                  portalHostName={UPSCALE_SELECT_PORTAL_HOST}
                />
                <View
                  pointerEvents={settings.format === "png" ? "none" : "auto"}
                  accessibilityElementsHidden={settings.format === "png"}
                  importantForAccessibility={
                    settings.format === "png" ? "no-hide-descendants" : "auto"
                  }
                  style={[
                    styles.section,
                    settings.format === "png" && styles.disabled,
                  ]}
                >
                  <View style={styles.qualityHeader}>
                    <Text style={styles.qualityLabel}>Image quality</Text>
                    <Text style={styles.qualityValue}>
                      {settings.format === "png"
                        ? "무손실"
                        : `${settings.format === "jpg" ? settings.jpgQuality : settings.webpQuality}%`}
                    </Text>
                  </View>
                  <Slider
                    accessibilityLabel="Image quality"
                    value={
                      settings.format === "webp"
                        ? settings.webpQuality
                        : settings.jpgQuality
                    }
                    min={1}
                    max={100}
                    step={1}
                    precision={0}
                    pill
                    jumpOnTap
                    trackBg={tokens.color.sunken}
                    thumbBorderWidth={0}
                    onValueChange={(quality) =>
                      change(
                        settings.format === "webp"
                          ? { webpQuality: quality }
                          : { jpgQuality: quality },
                      )
                    }
                    onSlidingComplete={(quality) =>
                      change(
                        settings.format === "webp"
                          ? { webpQuality: quality }
                          : { jpgQuality: quality },
                      )
                    }
                  />
                </View>
                <View style={styles.section}>
                  <Text style={styles.eyebrow}>SAVE SETTINGS</Text>
                  <View style={styles.qualityHeader}>
                    <Text style={styles.qualityLabel}>원본 파일명 유지</Text>
                    <Toggle
                      label="원본 파일명 유지"
                      value={settings.keepOriginalFilename}
                      disabled={disabled}
                      onChange={(keepOriginalFilename) =>
                        change({ keepOriginalFilename })
                      }
                    />
                  </View>
                  <Text style={styles.hint}>
                    원본 이름이 없으면 자동 이름을 사용합니다. 확장자는 출력
                    형식에 맞추며 같은 이름은 덮어쓰지 않습니다.
                  </Text>
                  <Text style={styles.qualityLabel}>저장 앨범</Text>
                  <BottomSheetTextInput
                    accessibilityLabel="저장 앨범"
                    placeholder="기본 갤러리 위치"
                    placeholderTextColor={tokens.color.textTertiary}
                    value={settings.albumName}
                    editable={!disabled}
                    maxLength={80}
                    autoCorrect={false}
                    returnKeyType="done"
                    onChangeText={(albumName) => change({ albumName })}
                    style={styles.albumInput}
                  />
                  <Text style={styles.hint}>
                    앨범 이름을 입력하면 그 앨범에 저장하고, 없으면 만듭니다.
                    비워 두면 기본 위치에 저장합니다.
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="고급 옵션"
                  accessibilityState={{ expanded: advancedOpen, disabled }}
                  disabled={disabled}
                  onPress={() => setAdvancedOpen((current) => !current)}
                  style={styles.qualityHeader}
                >
                  <Text style={styles.qualityLabel}>고급 옵션</Text>
                  <Ionicons
                    name={advancedOpen ? "chevron-up" : "chevron-down"}
                    size={18}
                    color={tokens.color.textSecondary}
                  />
                </Pressable>
                {advancedOpen ? (
                  <View style={styles.section}>
                    <UpscaleCpuSettings
                      active={open && !disabled}
                      disabled={disabled}
                      settings={settings}
                      onChange={change}
                    />
                    <View style={styles.qualityHeader}>
                      <Text style={styles.qualityLabel}>
                        Limit GPU Performance
                      </Text>
                      <Toggle
                        label="Limit GPU Performance"
                        value={settings.limitGpuPerformance}
                        disabled={disabled}
                        onChange={(limitGpuPerformance) =>
                          change({ limitGpuPerformance })
                        }
                      />
                    </View>
                    <Text style={styles.hint}>
                      자동·수동 타일 모두 GPU에서는 최대 100으로 제한합니다.
                      CPU에는 적용되지 않습니다. 실제 적용 타일은 완료 목록에
                      표시됩니다.
                    </Text>
                    <View style={styles.qualityHeader}>
                      <Text style={styles.qualityLabel}>TTA mode</Text>
                      <Toggle
                        label="TTA mode"
                        value={settings.ttaMode}
                        disabled={disabled}
                        onChange={(ttaMode) => change({ ttaMode })}
                      />
                    </View>
                    <Text style={styles.hint}>
                      8가지 방향으로 추론한 결과를 합칩니다. 처리 시간과 메모리
                      사용량이 늘어납니다.
                    </Text>
                    {settings.model !== "waifu2x-cunet" ? (
                      <View style={styles.section}>
                        <SteppedSeekbar
                          label="Real-CUGAN Sync Gap"
                          stops={[...SYNC_GAPS]}
                          value={settings.syncGap}
                          onChange={(syncGap) =>
                            change({
                              syncGap: syncGap as UpscaleSettings["syncGap"],
                            })
                          }
                        />
                        <Text style={styles.hint}>
                          타일을 나눠 처리할 때 적용됩니다. 0은 비활성화,
                          기본값은 3입니다.
                        </Text>
                      </View>
                    ) : null}
                    <UpscaleGpuMemory active={open && !disabled} />
                  </View>
                ) : null}
              </View>
            </BottomSheetScrollView>
          </BottomSheetView>
        </BottomSheet>
      </PredictiveBackSheetLayer>
    </>
  );
}

const styles = StyleSheet.create({
  albumInput: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.regular,
    fontSize: 15,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    backgroundColor: tokens.color.sunken,
  },
  hint: {
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  qualityHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  qualityLabel: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.medium,
    fontSize: 15,
  },
  qualityValue: {
    color: tokens.color.textSecondary,
    fontFamily: tokens.font.medium,
    fontSize: 15,
    fontVariant: ["tabular-nums"],
  },
  sheetContainer: {
    zIndex: 80,
    elevation: 80,
  },
  header: {
    height: GENERATION_SHEET_HEADER_HEIGHT,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.color.borderSubtle,
  },
  headerLayer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  titleLayer: {
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  summaryButton: {
    flex: 1,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  summaryText: {
    flex: 1,
    color: tokens.color.textSecondary,
    fontFamily: tokens.font.regular,
    fontSize: 15,
    lineHeight: 20,
  },
  // 좌우 칸을 같은 너비로 두어 제목이 항상 가운데에 온다.
  headerSide: {
    flex: 1,
    alignItems: "flex-start",
  },
  title: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: 16,
    letterSpacing: -0.3,
    // 글자 높이 중심을 닫기 아이콘 중심에 맞춘다.
    top: -1,
  },
  closeButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 18,
    paddingHorizontal: 16,
  },
  fields: {
    gap: 24,
  },
  section: {
    gap: 18,
  },
  eyebrow: {
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.semibold,
    fontSize: 12,
    letterSpacing: 0.8,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: tokens.opacity.pressed,
  },
});
