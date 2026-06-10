import React from "react";
import { Dimensions, Text, View } from "react-native";
import BottomSheet, {
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
import { BaseSheet } from "./BaseSheet";
import {
  BATCH_COUNT_CONFIG,
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
  | "resolution"
  | "batchCount";

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

function BatchCountSheet() {
  const batchCount = useGenerationStore((s) => s.batchCount);
  const setBatchCount = useGenerationStore((s) => s.setBatchCount);
  return (
    <NumericSheetContent
      value={batchCount}
      onChange={setBatchCount}
      cfg={BATCH_COUNT_CONFIG}
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
      <BaseSheet
        sheetRef={sheetRefs.imageImport}
        sheetKey="imageImport"
        onSheetChange={onSheetChange}
        renderBackdrop={renderBackdrop}
        enableDynamicSizing
        maxDynamicContentSize={Dimensions.get("window").height * 0.92}
        stickyHeaderIndices={[0]}
      >
        <ImageUploadSheet
          onClose={() => sheetRefs.imageImport.current?.close()}
        />
      </BaseSheet>

      <BaseSheet
        sheetRef={sheetRefs.model}
        sheetKey="model"
        onSheetChange={onSheetChange}
        renderBackdrop={renderBackdrop}
        snapPoints={[430]}
        enableDynamicSizing={false}
      >
        <ModelSheet onClose={() => sheetRefs.model.current?.close()} />
      </BaseSheet>

      <BaseSheet
        sheetRef={sheetRefs.sampler}
        sheetKey="sampler"
        onSheetChange={onSheetChange}
        renderBackdrop={renderBackdrop}
        snapPoints={[540]}
        enableDynamicSizing={false}
      >
        <SamplerSheet onClose={() => sheetRefs.sampler.current?.close()} />
      </BaseSheet>

      <BaseSheet
        sheetRef={sheetRefs.schedule}
        sheetKey="schedule"
        onSheetChange={onSheetChange}
        renderBackdrop={renderBackdrop}
        snapPoints={[360]}
        enableDynamicSizing={false}
      >
        <ScheduleSheet onClose={() => sheetRefs.schedule.current?.close()} />
      </BaseSheet>

      <BaseSheet
        sheetRef={sheetRefs.steps}
        sheetKey="steps"
        onSheetChange={onSheetChange}
        renderBackdrop={renderBackdrop}
        snapPoints={[320]}
        enableDynamicSizing={false}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
      >
        <StepsSheet />
      </BaseSheet>

      <BaseSheet
        sheetRef={sheetRefs.batchCount}
        sheetKey="batchCount"
        onSheetChange={onSheetChange}
        renderBackdrop={renderBackdrop}
        snapPoints={[320]}
        enableDynamicSizing={false}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
      >
        <BatchCountSheet />
      </BaseSheet>

      <BaseSheet
        sheetRef={sheetRefs.cfg}
        sheetKey="cfg"
        onSheetChange={onSheetChange}
        renderBackdrop={renderBackdrop}
        snapPoints={[320]}
        enableDynamicSizing={false}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
      >
        <CfgSheet />
      </BaseSheet>

      <BaseSheet
        sheetRef={sheetRefs.cfgRescale}
        sheetKey="cfgRescale"
        onSheetChange={onSheetChange}
        renderBackdrop={renderBackdrop}
        snapPoints={[320]}
        enableDynamicSizing={false}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
      >
        <CfgRescaleSheet />
      </BaseSheet>

      <BaseSheet
        sheetRef={sheetRefs.seed}
        sheetKey="seed"
        onSheetChange={onSheetChange}
        renderBackdrop={renderBackdrop}
        snapPoints={[260]}
        enableDynamicSizing={false}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
      >
        <SeedSheet />
      </BaseSheet>

      <BaseSheet
        sheetRef={sheetRefs.resolution}
        sheetKey="resolution"
        onSheetChange={onSheetChange}
        renderBackdrop={renderBackdrop}
        enableDynamicSizing
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
      >
        <ResolutionSheet
          onClose={() => sheetRefs.resolution.current?.close()}
        />
      </BaseSheet>
    </>
  );
}
