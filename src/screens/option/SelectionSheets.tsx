import type { ReactElement, RefObject } from "react";
import { Text, View } from "react-native";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import type { BottomSheetBackdropProps } from "@gorhom/bottom-sheet";

import {
  MODELS,
  NAI_RESOLUTIONS,
  NOISE_SCHEDULES,
  SAMPLERS,
  type NaiResolution,
  type NoiseSchedule,
} from "../../constants/generation";
import { findResolutionPreset } from "./helpers";
import { SelectionSheetItem } from "./OptionControls";
import { styles } from "./styles";

type SelectionSheetName = "model" | "resolution" | "sampler" | "noiseSchedule";

export function SelectionSheets({
  modelSheetRef,
  resolutionSheetRef,
  samplerSheetRef,
  noiseScheduleSheetRef,
  renderBackdrop,
  handleSheetChange,
  closeSelectionSheet,
  model,
  setModel,
  resolution,
  setResolution,
  sampler,
  setSampler,
  noiseSchedule,
  setNoiseSchedule,
}: {
  modelSheetRef: RefObject<BottomSheet | null>;
  resolutionSheetRef: RefObject<BottomSheet | null>;
  samplerSheetRef: RefObject<BottomSheet | null>;
  noiseScheduleSheetRef: RefObject<BottomSheet | null>;
  renderBackdrop: (props: BottomSheetBackdropProps) => ReactElement;
  handleSheetChange: (sheet: SelectionSheetName, index: number) => void;
  closeSelectionSheet: () => void;
  model: string;
  setModel: (v: string) => void;
  resolution: NaiResolution;
  setResolution: (v: NaiResolution) => void;
  sampler: string;
  setSampler: (v: string) => void;
  noiseSchedule: NoiseSchedule;
  setNoiseSchedule: (v: NoiseSchedule) => void;
}) {
  return (
    <>
      <BottomSheet
        ref={modelSheetRef}
        index={-1}
        snapPoints={[390]}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        detached
        bottomInset={14}
        style={styles.sheetContainer}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.sheetHandle}
        enableDynamicSizing={false}
        onChange={(index) => handleSheetChange("model", index)}
      >
        <BottomSheetScrollView
          contentContainerStyle={styles.sheetContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sheetTitle}>Select Model</Text>
          {MODELS.map((item) => (
            <SelectionSheetItem
              key={item.value}
              label={item.label}
              active={model === item.value}
              onPress={() => {
                setModel(item.value);
                closeSelectionSheet();
              }}
            />
          ))}
        </BottomSheetScrollView>
      </BottomSheet>

      <BottomSheet
        ref={resolutionSheetRef}
        index={-1}
        snapPoints={[560]}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        detached
        bottomInset={14}
        style={styles.sheetContainer}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.sheetHandle}
        enableDynamicSizing={false}
        onChange={(index) => handleSheetChange("resolution", index)}
      >
        <Text style={[styles.sheetTitle, styles.fixedSheetTitle]}>
          Select Resolution
        </Text>
        <BottomSheetScrollView
          contentContainerStyle={styles.sheetScrollableContent}
          showsVerticalScrollIndicator={false}
        >
          {NAI_RESOLUTIONS.map((group) => (
            <View key={group.group} style={styles.sheetGroup}>
              <Text style={styles.sheetGroupTitle}>{group.group}</Text>
              {group.options.map((item) => (
                <SelectionSheetItem
                  key={`${item.width}x${item.height}`}
                  label={item.label}
                  active={
                    resolution.width === item.width &&
                    resolution.height === item.height
                  }
                  onPress={() => {
                    setResolution(item);
                    closeSelectionSheet();
                  }}
                />
              ))}
            </View>
          ))}
          <View style={styles.sheetGroup}>
            <Text style={styles.sheetGroupTitle}>Custom</Text>
            <SelectionSheetItem
              label="Custom Resolution"
              active={!findResolutionPreset(resolution.width, resolution.height)}
              onPress={closeSelectionSheet}
            />
          </View>
        </BottomSheetScrollView>
      </BottomSheet>

      <BottomSheet
        ref={samplerSheetRef}
        index={-1}
        snapPoints={[500]}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        detached
        bottomInset={14}
        style={styles.sheetContainer}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.sheetHandle}
        enableDynamicSizing={false}
        onChange={(index) => handleSheetChange("sampler", index)}
      >
        <BottomSheetScrollView
          contentContainerStyle={styles.sheetContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sheetTitle}>Select Sampler</Text>
          {SAMPLERS.map((item) => (
            <SelectionSheetItem
              key={item.value}
              label={item.label}
              active={sampler === item.value}
              onPress={() => {
                setSampler(item.value);
                closeSelectionSheet();
              }}
            />
          ))}
        </BottomSheetScrollView>
      </BottomSheet>

      <BottomSheet
        ref={noiseScheduleSheetRef}
        index={-1}
        snapPoints={[300]}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        detached
        bottomInset={14}
        style={styles.sheetContainer}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.sheetHandle}
        enableDynamicSizing={false}
        onChange={(index) => handleSheetChange("noiseSchedule", index)}
      >
        <View style={styles.sheetContent}>
          <Text style={styles.sheetTitle}>Select Noise Schedule</Text>
          {NOISE_SCHEDULES.map((item) => (
            <SelectionSheetItem
              key={item.value}
              label={item.label}
              active={noiseSchedule === item.value}
              onPress={() => {
                setNoiseSchedule(item.value);
                closeSelectionSheet();
              }}
            />
          ))}
        </View>
      </BottomSheet>
    </>
  );
}
