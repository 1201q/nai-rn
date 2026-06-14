import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Animated as RNAnimated,
  BackHandler,
  StyleSheet,
  Text,
  View,
} from "react-native";
import BottomSheet, {
  BottomSheetScrollView,
  TouchableOpacity as BottomSheetTouchableOpacity,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import Reanimated, {
  FadeIn,
  SlideInLeft,
  SlideInRight,
} from "react-native-reanimated";

import {
  MODELS,
  NOISE_SCHEDULES,
  SAMPLERS,
  type NoiseSchedule,
} from "../../constants/generation";
import {
  getI2IEffectiveResolution,
  useGenerationStore,
} from "../../store/generationStore";
import { formatDecimal, triggerSelectionHaptic } from "../option/helpers";
import { light, styles } from "./styles";
import { SheetItem } from "./primitives";
import { useScalePress } from "./useScalePress";
import { NumericSheetContent } from "./NumericSheet";
import { SeedSheetContent } from "./SeedSheet";
import { ResolutionSheetContent } from "./ResolutionSheet";
import { ImageUploadSheet } from "./ImageUploadSheet";
import {
  BATCH_COUNT_CONFIG,
  CFG_CONFIG,
  CFG_RESCALE_CONFIG,
  STEPS_CONFIG,
} from "./constants";

export type OptionRoute =
  | "menu"
  | "model"
  | "sampler"
  | "schedule"
  | "steps"
  | "cfg"
  | "cfgRescale"
  | "seed"
  | "resolution"
  | "batchCount"
  | "metadata"
  | "i2i";

export type OptionsSheetHandle = {
  openAt: (route?: OptionRoute) => void;
  close: () => void;
};

// 고정 2포인트 — 라우트 전환 시 리사이즈 금지(과거 높이-측정 버그 회피).
type TransitionDirection = "forward" | "back";

const SNAP_POINTS = ["60%", "92%"];
const ROUTE_ENTER_FORWARD = SlideInRight.duration(140);
const ROUTE_ENTER_BACK = SlideInLeft.duration(140);
const ROUTE_FADE_IN = FadeIn.duration(100);
const IMAGE_PREVIEW_FRAME_ASPECT = 1.58;
const DETAIL_TITLES: Partial<Record<OptionRoute, string>> = {
  model: "Model",
  sampler: "Sampler",
  schedule: "Noise Schedule",
  steps: "Steps",
  cfg: "CFG Scale",
  cfgRescale: "CFG Rescale",
  seed: "Seed",
  resolution: "Resolution",
  batchCount: "Batch Count",
  metadata: "Metadata Extract",
  i2i: "I2I",
};

const I2I_STRENGTH_CONFIG = {
  title: "Strength",
  unit: "strength",
  min: 0.01,
  max: 0.99,
  step: 0.01,
  precision: 2,
};

const I2I_NOISE_CONFIG = {
  title: "Noise",
  unit: "noise",
  min: 0,
  max: 0.99,
  step: 0.01,
  precision: 2,
};

// --- 상세 라우트 본문 (각자 자기 슬라이스만 구독) ---

function ModelSheet({
  onClose,
  showTitle = true,
}: {
  onClose: () => void;
  showTitle?: boolean;
}) {
  const model = useGenerationStore((s) => s.model);
  const setModel = useGenerationStore((s) => s.setModel);
  return (
    <>
      {showTitle ? <Text style={styles.sheetTitle}>Model</Text> : null}
      {MODELS.flatMap((item, index) => {
        const el = (
          <SheetItem
            key={item.value}
            item={item}
            isActive={model === item.value}
            recommendedValue="nai-diffusion-4-5-full"
            onPress={() => {
              setModel(item.value);
              onClose();
            }}
          />
        );
        return index === 1
          ? [el, <View key="model-divider" style={styles.sheetDivider} />]
          : [el];
      })}
    </>
  );
}

function SamplerSheet({
  onClose,
  showTitle = true,
}: {
  onClose: () => void;
  showTitle?: boolean;
}) {
  const sampler = useGenerationStore((s) => s.sampler);
  const setSampler = useGenerationStore((s) => s.setSampler);
  return (
    <>
      {showTitle ? <Text style={styles.sheetTitle}>Sampler</Text> : null}
      {SAMPLERS.flatMap((item, index) => {
        const el = (
          <SheetItem
            key={item.value}
            item={item}
            isActive={sampler === item.value}
            recommendedValue="k_euler_ancestral"
            onPress={() => {
              setSampler(item.value);
              onClose();
            }}
          />
        );
        return index === 5
          ? [el, <View key="sampler-divider" style={styles.sheetDivider} />]
          : [el];
      })}
    </>
  );
}

function ScheduleSheet({
  onClose,
  showTitle = true,
}: {
  onClose: () => void;
  showTitle?: boolean;
}) {
  const noiseSchedule = useGenerationStore((s) => s.noiseSchedule);
  const setNoiseSchedule = useGenerationStore((s) => s.setNoiseSchedule);
  return (
    <>
      {showTitle ? (
        <Text style={styles.sheetTitle}>Noise Schedule</Text>
      ) : null}
      {NOISE_SCHEDULES.flatMap((item, index) => {
        const el = (
          <SheetItem
            key={item.value}
            item={item}
            isActive={noiseSchedule === item.value}
            recommendedValue="karras"
            onPress={() => {
              setNoiseSchedule(item.value as NoiseSchedule);
              onClose();
            }}
          />
        );
        return index === 2
          ? [el, <View key="schedule-divider" style={styles.sheetDivider} />]
          : [el];
      })}
    </>
  );
}

function StepsSheet() {
  const steps = useGenerationStore((s) => s.steps);
  const setSteps = useGenerationStore((s) => s.setSteps);
  return (
    <NumericSheetContent
      value={steps}
      onChange={setSteps}
      cfg={STEPS_CONFIG}
      showTitle={false}
    />
  );
}

function BatchCountSheet() {
  const batchCount = useGenerationStore((s) => s.batchCount);
  const setBatchCount = useGenerationStore((s) => s.setBatchCount);
  return (
    <NumericSheetContent
      value={batchCount}
      onChange={setBatchCount}
      cfg={BATCH_COUNT_CONFIG}
      showTitle={false}
    />
  );
}

function CfgSheet() {
  const promptGuidance = useGenerationStore((s) => s.promptGuidance);
  const setPromptGuidance = useGenerationStore((s) => s.setPromptGuidance);
  return (
    <NumericSheetContent
      value={promptGuidance}
      onChange={setPromptGuidance}
      cfg={CFG_CONFIG}
      showTitle={false}
    />
  );
}

function CfgRescaleSheet() {
  const promptGuidanceRescale = useGenerationStore(
    (s) => s.promptGuidanceRescale,
  );
  const setPromptGuidanceRescale = useGenerationStore(
    (s) => s.setPromptGuidanceRescale,
  );
  return (
    <NumericSheetContent
      value={promptGuidanceRescale}
      onChange={setPromptGuidanceRescale}
      cfg={CFG_RESCALE_CONFIG}
      showTitle={false}
    />
  );
}

function SeedSheet() {
  const seed = useGenerationStore((s) => s.seed);
  const setSeed = useGenerationStore((s) => s.setSeed);
  const seedLocked = useGenerationStore((s) => s.seedLocked);
  const setSeedLocked = useGenerationStore((s) => s.setSeedLocked);
  return (
    <SeedSheetContent
      seed={seed}
      locked={seedLocked}
      onChangeSeed={setSeed}
      onToggleLock={() => setSeedLocked(!seedLocked)}
      showTitle={false}
    />
  );
}

function ResolutionSheet({ onClose }: { onClose: () => void }) {
  const resolution = useGenerationStore((s) => s.resolution);
  const setResolution = useGenerationStore((s) => s.setResolution);
  return (
    <ResolutionSheetContent
      resolution={resolution}
      onChange={setResolution}
      onClose={onClose}
      showTitle={false}
    />
  );
}

function I2ISheet() {
  const sourceImage = useGenerationStore((s) => s.i2iSourceImage);
  const setSourceImage = useGenerationStore((s) => s.setI2ISourceImage);
  const strength = useGenerationStore((s) => s.i2iStrength);
  const setStrength = useGenerationStore((s) => s.setI2IStrength);
  const noise = useGenerationStore((s) => s.i2iNoise);
  const setNoise = useGenerationStore((s) => s.setI2INoise);
  const clearI2I = useGenerationStore((s) => s.clearI2I);
  const setMessage = useGenerationStore((s) => s.setMessage);
  const [busy, setBusy] = useState(false);

  const effectiveResolution = sourceImage
    ? getI2IEffectiveResolution(sourceImage)
    : null;

  async function handlePick() {
    if (busy) return;
    try {
      setBusy(true);
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 1,
        base64: false,
      });
      if (result.canceled || !result.assets[0]) {
        return;
      }

      const asset = result.assets[0];
      setSourceImage({
        uri: asset.uri,
        width: asset.width || 64,
        height: asset.height || 64,
      });
    } catch {
      setMessage("I2I 이미지를 선택하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {sourceImage ? (
        <View
          style={[
            i2iStyles.previewCard,
            { aspectRatio: IMAGE_PREVIEW_FRAME_ASPECT },
          ]}
        >
          <ExpoImage
            source={{ uri: sourceImage.uri }}
            contentFit="contain"
            contentPosition="center"
            transition={120}
            style={i2iStyles.previewImage}
          />
        </View>
      ) : (
        <BottomSheetTouchableOpacity
          activeOpacity={0.82}
          disabled={busy}
          onPress={handlePick}
          style={i2iStyles.uploadCard}
        >
          {busy ? (
            <ActivityIndicator color={light.textSecondary} />
          ) : (
            <>
              <Ionicons
                name="image-outline"
                size={28}
                color={light.textSecondary}
              />
              <Text style={i2iStyles.uploadText}>이미지 선택</Text>
            </>
          )}
        </BottomSheetTouchableOpacity>
      )}

      {sourceImage ? (
        <>
          <View style={i2iStyles.actionRow}>
            <BottomSheetTouchableOpacity
              activeOpacity={0.72}
              disabled={busy}
              onPress={handlePick}
              style={i2iStyles.secondaryButton}
            >
              {busy ? (
                <ActivityIndicator size="small" color={light.textSecondary} />
              ) : (
                <>
                  <Ionicons name="refresh" size={15} color={light.textSecondary} />
                  <Text style={i2iStyles.secondaryButtonText}>다시 선택</Text>
                </>
              )}
            </BottomSheetTouchableOpacity>
            <BottomSheetTouchableOpacity
              activeOpacity={0.72}
              onPress={() => {
                triggerSelectionHaptic();
                clearI2I();
              }}
              style={i2iStyles.secondaryButton}
            >
              <Ionicons name="close" size={15} color={light.textSecondary} />
              <Text style={i2iStyles.secondaryButtonText}>끄기</Text>
            </BottomSheetTouchableOpacity>
          </View>
          {effectiveResolution ? (
            <Text style={i2iStyles.sizeText}>
              {effectiveResolution.width}x{effectiveResolution.height}
            </Text>
          ) : null}
          <NumericSheetContent
            value={strength}
            onChange={setStrength}
            cfg={I2I_STRENGTH_CONFIG}
          />
          <NumericSheetContent
            value={noise}
            onChange={setNoise}
            cfg={I2I_NOISE_CONFIG}
          />
        </>
      ) : null}
    </>
  );
}

// --- 루트 메뉴 ---

function MenuRow({
  label,
  value,
  active,
  disabled,
  isToggle,
  onPress,
}: {
  label: string;
  value?: string;
  active?: boolean;
  disabled?: boolean;
  isToggle?: boolean;
  onPress?: () => void;
}) {
  const { anim, onPressIn, onPressOut, scale } = useScalePress({
    scaleTo: 0.96,
  });
  const backgroundColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(25,27,49,0)", light.surface],
  });

  return (
    <BottomSheetTouchableOpacity
      activeOpacity={1}
      disabled={disabled}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={onPress}
    >
      <RNAnimated.View
        style={[
          styles.sheetMenuRow,
          { transform: [{ scale }], backgroundColor },
        ]}
      >
        <Text
          style={[
            styles.sheetMenuLabel,
            disabled && styles.sheetMenuLabelDisabled,
          ]}
        >
          {label}
        </Text>
        <View style={styles.sheetMenuValueRow}>
          {value ? (
            <Text
              style={[styles.sheetMenuValue, active && styles.sheetMenuValueActive]}
              numberOfLines={1}
            >
              {value}
            </Text>
          ) : null}
          {!disabled && !isToggle && (
            <Ionicons name="chevron-forward" size={18} color={light.textHint} />
          )}
        </View>
      </RNAnimated.View>
    </BottomSheetTouchableOpacity>
  );
}

function MenuTile({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  const { anim, onPressIn, onPressOut, scale } = useScalePress({
    scaleTo: 0.96,
  });
  const backgroundColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [light.surface, light.surfaceAlt],
  });

  return (
    <View style={styles.sheetMenuTileCell}>
      <BottomSheetTouchableOpacity
        activeOpacity={1}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={onPress}
      >
        <RNAnimated.View
          style={[
            styles.sheetMenuTile,
            { transform: [{ scale }], backgroundColor },
          ]}
        >
          <Text style={styles.sheetMenuTileLabel} numberOfLines={1}>
            {label}
          </Text>
          <Text style={styles.sheetMenuTileValue} numberOfLines={1}>
            {value}
          </Text>
        </RNAnimated.View>
      </BottomSheetTouchableOpacity>
    </View>
  );
}

function OptionsMenu({
  onSelect,
}: {
  onSelect: (route: OptionRoute) => void;
}) {
  const model = useGenerationStore((s) => s.model);
  const resolution = useGenerationStore((s) => s.resolution);
  const seed = useGenerationStore((s) => s.seed);
  const seedLocked = useGenerationStore((s) => s.seedLocked);
  const steps = useGenerationStore((s) => s.steps);
  const promptGuidance = useGenerationStore((s) => s.promptGuidance);
  const promptGuidanceRescale = useGenerationStore(
    (s) => s.promptGuidanceRescale,
  );
  const sampler = useGenerationStore((s) => s.sampler);
  const noiseSchedule = useGenerationStore((s) => s.noiseSchedule);
  const varietyPlus = useGenerationStore((s) => s.varietyPlus);
  const setVarietyPlus = useGenerationStore((s) => s.setVarietyPlus);
  const i2iSourceImage = useGenerationStore((s) => s.i2iSourceImage);

  const modelText = MODELS.find((m) => m.value === model)?.label ?? model;
  const samplerText =
    SAMPLERS.find((s) => s.value === sampler)?.label ?? sampler;
  const scheduleText =
    NOISE_SCHEDULES.find((n) => n.value === noiseSchedule)?.label ??
    noiseSchedule;
  let seedText = `${seed}`;
  if (seed === 0) {
    seedText = "Random";
  } else if (seedLocked) {
    seedText = `${seed} Lock`;
  }

  return (
    <>
      <Text style={styles.sheetTitle}>Options</Text>

      <Text style={styles.sheetMenuGroupLabel}>Core</Text>
      <View style={styles.sheetMenuTileRow}>
        <MenuTile
          label="Model"
          value={modelText}
          onPress={() => onSelect("model")}
        />
        <MenuTile
          label="Resolution"
          value={`${resolution.width}x${resolution.height}`}
          onPress={() => onSelect("resolution")}
        />
      </View>
      <MenuRow label="Seed" value={seedText} onPress={() => onSelect("seed")} />

      <Text style={styles.sheetMenuGroupLabel}>Parameter Options</Text>
      <View style={styles.sheetMenuTileRow}>
        <MenuTile
          label="Steps"
          value={`${steps}`}
          onPress={() => onSelect("steps")}
        />
        <MenuTile
          label="CFG Scale"
          value={formatDecimal(promptGuidance)}
          onPress={() => onSelect("cfg")}
        />
        <MenuTile
          label="CFG Rescale"
          value={formatDecimal(promptGuidanceRescale, 2)}
          onPress={() => onSelect("cfgRescale")}
        />
      </View>
      <MenuRow
        label="Sampler"
        value={samplerText}
        onPress={() => onSelect("sampler")}
      />
      <MenuRow
        label="Schedule"
        value={scheduleText}
        onPress={() => onSelect("schedule")}
      />
      <MenuRow
        label="Variety+"
        value={varietyPlus ? "On" : "Off"}
        active={varietyPlus}
        isToggle
        onPress={() => {
          triggerSelectionHaptic();
          setVarietyPlus(!varietyPlus);
        }}
      />

      <Text style={styles.sheetMenuGroupLabel}>Reference</Text>
      <MenuRow label="Metadata Extract" onPress={() => onSelect("metadata")} />
      <MenuRow
        label="I2I"
        value={i2iSourceImage ? "On" : "Off"}
        active={Boolean(i2iSourceImage)}
        onPress={() => onSelect("i2i")}
      />
      <MenuRow label="Vibe Transfer" value="Off" disabled />
      <MenuRow label="Precise Ref" value="Off" disabled />
    </>
  );
}

// --- 라우티드 단일 시트 ---

export const OptionsSheet = forwardRef<
  OptionsSheetHandle,
  {
    onOpenChange: (open: boolean) => void;
    renderBackdrop: (props: BottomSheetBackdropProps) => React.ReactElement;
  }
>(function OptionsSheet(
  { onOpenChange, renderBackdrop },
  ref,
) {
  const sheetRef = useRef<BottomSheet>(null);
  const [route, setRoute] = useState<OptionRoute>("menu");
  const [transitionDirection, setTransitionDirection] =
    useState<TransitionDirection>("forward");
  const routeRef = useRef<OptionRoute>("menu");
  const openRef = useRef(false);

  const goTo = useCallback((next: OptionRoute, direction?: TransitionDirection) => {
    if (routeRef.current === next) return;
    setTransitionDirection(direction ?? (next === "menu" ? "back" : "forward"));
    routeRef.current = next;
    setRoute(next);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      openAt: (next = "menu") => {
        goTo(next, next === "menu" ? "back" : "forward");
        sheetRef.current?.snapToIndex(0);
      },
      close: () => sheetRef.current?.close(),
    }),
    [goTo],
  );

  const handleChange = useCallback(
    (index: number) => {
      const open = index >= 0;
      if (open !== openRef.current) {
        openRef.current = open;
        onOpenChange(open);
      }
      if (!open) goTo("menu", "back");
      // 닫힐 때 다음 열림은 항상 메뉴부터
      if (!open) goTo("menu");
    },
    [goTo, onOpenChange],
  );

  // 헤더 백 / Android 백 공통: 상세면 메뉴로, 메뉴면 시트 닫기.
  const back = useCallback(() => {
    if (routeRef.current !== "menu") {
      goTo("menu", "back");
    } else {
      sheetRef.current?.close();
    }
  }, [goTo]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!openRef.current) return false;
      back();
      return true;
    });
    return () => sub.remove();
  }, [back]);

  const backToMenu = useCallback(() => goTo("menu", "back"), [goTo]);
  const routeEntering =
    transitionDirection === "forward" ? ROUTE_ENTER_FORWARD : ROUTE_ENTER_BACK;

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={SNAP_POINTS}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      style={styles.sheetContainer}
      containerStyle={styles.sheetContainer}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.sheetHandle}
      enableDynamicSizing={false}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      onChange={handleChange}
    >
      {route !== "menu" && (
        <Reanimated.View
          key={`header-${route}`}
          entering={routeEntering}
          style={styles.sheetRouteContent}
        >
          <Reanimated.View entering={ROUTE_FADE_IN} style={styles.sheetBackHeader}>
            <BottomSheetTouchableOpacity
              style={styles.sheetBackButton}
              onPress={back}
            >
              <Ionicons name="chevron-back" size={22} color={light.textPrimary} />
            </BottomSheetTouchableOpacity>
            <Text style={styles.sheetBackTitle} numberOfLines={1}>
              {DETAIL_TITLES[route]}
            </Text>
          </Reanimated.View>
        </Reanimated.View>
      )}

      <BottomSheetScrollView
        key={route}
        contentContainerStyle={styles.sheetScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Reanimated.View
          key={route}
          entering={routeEntering}
          style={styles.sheetRouteContent}
        >
          <Reanimated.View entering={ROUTE_FADE_IN} style={styles.sheetRouteContent}>
            {route === "menu" ? (
              <OptionsMenu
                onSelect={(next) => goTo(next, "forward")}
              />
            ) : route === "model" ? (
              <ModelSheet onClose={backToMenu} showTitle={false} />
            ) : route === "sampler" ? (
              <SamplerSheet onClose={backToMenu} showTitle={false} />
            ) : route === "schedule" ? (
              <ScheduleSheet onClose={backToMenu} showTitle={false} />
            ) : route === "steps" ? (
              <StepsSheet />
            ) : route === "cfg" ? (
              <CfgSheet />
            ) : route === "cfgRescale" ? (
              <CfgRescaleSheet />
            ) : route === "seed" ? (
              <SeedSheet />
            ) : route === "resolution" ? (
              <ResolutionSheet onClose={backToMenu} />
            ) : route === "batchCount" ? (
              <BatchCountSheet />
            ) : route === "metadata" ? (
              <ImageUploadSheet
                onClose={() => sheetRef.current?.close()}
                showTitle={false}
              />
            ) : route === "i2i" ? (
              <I2ISheet />
            ) : null}
          </Reanimated.View>
        </Reanimated.View>
      </BottomSheetScrollView>
    </BottomSheet>
  );
});

const i2iStyles = StyleSheet.create({
  uploadCard: {
    height: 160,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: light.border,
    borderStyle: "dashed",
    backgroundColor: light.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  uploadText: {
    color: light.textSecondary,
    fontSize: 15,
    fontWeight: "600",
  },
  previewCard: {
    width: "100%",
    maxHeight: 220,
    minHeight: 150,
    borderRadius: 18,
    backgroundColor: light.surface,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
  },
  secondaryButton: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: light.surface,
  },
  secondaryButtonText: {
    color: light.textSecondary,
    fontSize: 13,
    fontWeight: "700",
  },
  sizeText: {
    alignSelf: "center",
    marginTop: 6,
    marginBottom: 8,
    color: light.textHint,
    fontSize: 13,
    fontWeight: "700",
  },
});
