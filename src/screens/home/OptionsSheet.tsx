import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Animated as RNAnimated, BackHandler, Text, View } from "react-native";
import BottomSheet, {
  BottomSheetScrollView,
  TouchableOpacity as BottomSheetTouchableOpacity,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
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
import { useGenerationStore } from "../../store/generationStore";
import { formatDecimal, triggerSelectionHaptic } from "../option/helpers";
import { light, styles } from "./styles";
import { SheetItem } from "./primitives";
import { useScalePress } from "./useScalePress";
import { NumericSheetContent } from "./NumericSheet";
import { SeedSheetContent } from "./SeedSheet";
import { ResolutionSheetContent } from "./ResolutionSheet";
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
  | "batchCount";

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
    outputRange: ["rgba(244,244,243,0)", light.surface],
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
  onRequestImageImport,
}: {
  onSelect: (route: OptionRoute) => void;
  onRequestImageImport: () => void;
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
      <MenuRow label="Metadata Extract" onPress={onRequestImageImport} />
      <MenuRow label="I2I" value="Off" disabled />
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
    onRequestImageImport: () => void;
  }
>(function OptionsSheet(
  { onOpenChange, renderBackdrop, onRequestImageImport },
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
                onRequestImageImport={onRequestImageImport}
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
            ) : null}
          </Reanimated.View>
        </Reanimated.View>
      </BottomSheetScrollView>
    </BottomSheet>
  );
});
