import React from "react";
import { Text, View } from "react-native";
import BottomSheet, {
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";

import {
  MODELS,
  NOISE_SCHEDULES,
  SAMPLERS,
  type NoiseSchedule,
} from "../../constants/generation";
import { useGenerationStore } from "../../store/generationStore";
import { styles } from "./styles";
import { SheetItem } from "./primitives";
import { NumericSheetContent } from "./NumericSheet";
import { SeedSheetContent } from "./SeedSheet";
import { ResolutionSheetContent } from "./ResolutionSheet";
import { ImageUploadSheet } from "./ImageUploadSheet";
import {
  CFG_CONFIG,
  CFG_RESCALE_CONFIG,
  STEPS_CONFIG,
} from "./constants";

export type SheetKey =
  | "imageImport"
  | "model"
  | "sampler"
  | "schedule"
  | "steps"
  | "cfg"
  | "cfgRescale"
  | "seed"
  | "resolution";

export type SheetRefs = Record<
  SheetKey,
  React.RefObject<BottomSheet | null>
>;

// --- 시트별 내용 (각자 자기 슬라이스만 구독) ---

function ModelSheet({ onClose }: { onClose: () => void }) {
  const model = useGenerationStore((s) => s.model);
  const setModel = useGenerationStore((s) => s.setModel);
  return (
    <>
      <Text style={styles.sheetTitle}>Model</Text>
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

function SamplerSheet({ onClose }: { onClose: () => void }) {
  const sampler = useGenerationStore((s) => s.sampler);
  const setSampler = useGenerationStore((s) => s.setSampler);
  return (
    <>
      <Text style={styles.sheetTitle}>Sampler</Text>
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

function ScheduleSheet({ onClose }: { onClose: () => void }) {
  const noiseSchedule = useGenerationStore((s) => s.noiseSchedule);
  const setNoiseSchedule = useGenerationStore((s) => s.setNoiseSchedule);
  return (
    <>
      <Text style={styles.sheetTitle}>Noise Schedule</Text>
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
  return <NumericSheetContent value={steps} onChange={setSteps} cfg={STEPS_CONFIG} />;
}

function CfgSheet() {
  const promptGuidance = useGenerationStore((s) => s.promptGuidance);
  const setPromptGuidance = useGenerationStore((s) => s.setPromptGuidance);
  return (
    <NumericSheetContent
      value={promptGuidance}
      onChange={setPromptGuidance}
      cfg={CFG_CONFIG}
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
    />
  );
}

// --- 8개 BottomSheet 셸 (store 미구독 → 안 재렌더) ---

export function OptionSheets({
  sheetRefs,
  onSheetChange,
  renderBackdrop,
}: {
  sheetRefs: SheetRefs;
  onSheetChange: (sheet: SheetKey, index: number) => void;
  renderBackdrop: (props: BottomSheetBackdropProps) => React.ReactElement;
}) {
  return (
    <>
      <BottomSheet
        ref={sheetRefs.imageImport}
        index={-1}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        style={styles.sheetContainer}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.sheetHandle}
        enableDynamicSizing
        onChange={(index) => onSheetChange("imageImport", index)}
      >
        <BottomSheetScrollView
          contentContainerStyle={styles.sheetScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <ImageUploadSheet
            onClose={() => sheetRefs.imageImport.current?.close()}
          />
        </BottomSheetScrollView>
      </BottomSheet>

      <BottomSheet
        ref={sheetRefs.model}
        index={-1}
        snapPoints={[430]}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        style={styles.sheetContainer}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.sheetHandle}
        enableDynamicSizing={false}
        onChange={(index) => onSheetChange("model", index)}
      >
        <BottomSheetScrollView
          contentContainerStyle={styles.sheetScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <ModelSheet onClose={() => sheetRefs.model.current?.close()} />
        </BottomSheetScrollView>
      </BottomSheet>

      <BottomSheet
        ref={sheetRefs.sampler}
        index={-1}
        snapPoints={[540]}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        style={styles.sheetContainer}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.sheetHandle}
        enableDynamicSizing={false}
        onChange={(index) => onSheetChange("sampler", index)}
      >
        <BottomSheetScrollView
          contentContainerStyle={styles.sheetScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <SamplerSheet onClose={() => sheetRefs.sampler.current?.close()} />
        </BottomSheetScrollView>
      </BottomSheet>

      <BottomSheet
        ref={sheetRefs.schedule}
        index={-1}
        snapPoints={[360]}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        style={styles.sheetContainer}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.sheetHandle}
        enableDynamicSizing={false}
        onChange={(index) => onSheetChange("schedule", index)}
      >
        <BottomSheetScrollView
          contentContainerStyle={styles.sheetScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <ScheduleSheet onClose={() => sheetRefs.schedule.current?.close()} />
        </BottomSheetScrollView>
      </BottomSheet>

      <BottomSheet
        ref={sheetRefs.steps}
        index={-1}
        snapPoints={[320]}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        style={styles.sheetContainer}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.sheetHandle}
        enableDynamicSizing={false}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        onChange={(index) => onSheetChange("steps", index)}
      >
        <BottomSheetScrollView
          contentContainerStyle={styles.sheetScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <StepsSheet />
        </BottomSheetScrollView>
      </BottomSheet>

      <BottomSheet
        ref={sheetRefs.cfg}
        index={-1}
        snapPoints={[320]}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        style={styles.sheetContainer}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.sheetHandle}
        enableDynamicSizing={false}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        onChange={(index) => onSheetChange("cfg", index)}
      >
        <BottomSheetScrollView
          contentContainerStyle={styles.sheetScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <CfgSheet />
        </BottomSheetScrollView>
      </BottomSheet>

      <BottomSheet
        ref={sheetRefs.cfgRescale}
        index={-1}
        snapPoints={[320]}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        style={styles.sheetContainer}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.sheetHandle}
        enableDynamicSizing={false}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        onChange={(index) => onSheetChange("cfgRescale", index)}
      >
        <BottomSheetScrollView
          contentContainerStyle={styles.sheetScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <CfgRescaleSheet />
        </BottomSheetScrollView>
      </BottomSheet>

      <BottomSheet
        ref={sheetRefs.seed}
        index={-1}
        snapPoints={[260]}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        style={styles.sheetContainer}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.sheetHandle}
        enableDynamicSizing={false}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        onChange={(index) => onSheetChange("seed", index)}
      >
        <BottomSheetScrollView
          contentContainerStyle={styles.sheetScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <SeedSheet />
        </BottomSheetScrollView>
      </BottomSheet>

      <BottomSheet
        ref={sheetRefs.resolution}
        index={-1}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        style={styles.sheetContainer}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.sheetHandle}
        enableDynamicSizing
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        onChange={(index) => onSheetChange("resolution", index)}
      >
        <BottomSheetScrollView
          contentContainerStyle={styles.sheetScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <ResolutionSheet
            onClose={() => sheetRefs.resolution.current?.close()}
          />
        </BottomSheetScrollView>
      </BottomSheet>
    </>
  );
}
