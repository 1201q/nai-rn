import type { ReactElement, RefObject } from "react";
import { Text, View } from "react-native";
import BottomSheet, {
  BottomSheetScrollView,
  BottomSheetTextInput,
  TouchableOpacity as BottomSheetTouchableOpacity,
} from "@gorhom/bottom-sheet";
import type { BottomSheetBackdropProps } from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";

import {
  MODELS,
  NAI_RESOLUTIONS,
  NOISE_SCHEDULES,
  SAMPLERS,
  type NaiResolution,
  type NoiseSchedule,
} from "../../constants/generation";
import { findResolutionPreset } from "../option/helpers";
import { colors } from "../../styles/colors";
import { styles } from "./styles";

type SelectionSheetName = "model" | "resolution" | "sampler" | "noiseSchedule";

export function SettingSheets({
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
  resolutionWidthText,
  setResolutionWidthText,
  resolutionHeightText,
  setResolutionHeightText,
  commitResolutionInput,
  swapResolutionInput,
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
  resolutionWidthText: string;
  setResolutionWidthText: (v: string) => void;
  resolutionHeightText: string;
  setResolutionHeightText: (v: string) => void;
  commitResolutionInput: (widthText?: string, heightText?: string) => void;
  swapResolutionInput: () => void;
}) {
  const isCustomResolution =
    findResolutionPreset(resolution.width, resolution.height) === null;

  return (
    <>
      <BottomSheet
        ref={modelSheetRef}
        index={-1}
        snapPoints={[430]}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        style={styles.sheetContainer}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.sheetHandle}
        enableDynamicSizing={false}
        onChange={(index) => handleSheetChange("model", index)}
      >
        <BottomSheetScrollView
          contentContainerStyle={styles.sheetScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sheetTitle}>Model</Text>
          {MODELS.flatMap((item, index) => {
            const isActive = model === item.value;
            const el = (
              <BottomSheetTouchableOpacity
                key={item.value}
                style={styles.sheetModelItem}
                activeOpacity={0.78}
                onPress={() => {
                  setModel(item.value);
                  closeSelectionSheet();
                }}
              >
                <View style={styles.sheetModelItemLabelRow}>
                  <Text
                    style={[
                      styles.sheetModelItemLabel,
                      isActive && styles.sheetModelItemLabelActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                  {item.value === "nai-diffusion-4-5-full" && (
                    <View style={styles.sheetModelItemBadge}>
                      <Text style={styles.sheetModelItemBadgeText}>권장</Text>
                    </View>
                  )}
                </View>
                {isActive && (
                  <Ionicons
                    name="checkmark"
                    size={20}
                    color={colors.colorTextInfo}
                  />
                )}
              </BottomSheetTouchableOpacity>
            );
            return index === 1
              ? [el, <View key="model-divider" style={styles.sheetDivider} />]
              : [el];
          })}
        </BottomSheetScrollView>
      </BottomSheet>

      <BottomSheet
        ref={resolutionSheetRef}
        index={-1}
        snapPoints={["85%"]}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        style={styles.sheetContainer}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.sheetHandle}
        enableDynamicSizing={false}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        onChange={(index) => handleSheetChange("resolution", index)}
      >
        <BottomSheetScrollView
          contentContainerStyle={styles.sheetScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sheetTitle}>Resolution</Text>

          <View style={styles.sheetResolutionInputRow}>
            <View style={styles.sheetResolutionInputBox}>
              <Text style={styles.sheetResolutionInputLabel}>W</Text>
              <View style={styles.sheetResolutionInputDivider} />
              <BottomSheetTextInput
                value={resolutionWidthText}
                onChangeText={(text) =>
                  setResolutionWidthText(text.replace(/\D/g, ""))
                }
                onBlur={() => commitResolutionInput()}
                onSubmitEditing={() => commitResolutionInput()}
                keyboardType="number-pad"
                placeholder="832"
                placeholderTextColor={colors.colorTextTertiary}
                style={styles.sheetResolutionInput}
              />
            </View>
            <BottomSheetTouchableOpacity
              style={styles.sheetResolutionSwapButton}
              activeOpacity={0.78}
              onPress={swapResolutionInput}
            >
              <Ionicons
                name="swap-horizontal-outline"
                size={18}
                color={colors.colorTextPrimary}
              />
            </BottomSheetTouchableOpacity>
            <View style={styles.sheetResolutionInputBox}>
              <Text style={styles.sheetResolutionInputLabel}>H</Text>
              <View style={styles.sheetResolutionInputDivider} />
              <BottomSheetTextInput
                value={resolutionHeightText}
                onChangeText={(text) =>
                  setResolutionHeightText(text.replace(/\D/g, ""))
                }
                onBlur={() => commitResolutionInput()}
                onSubmitEditing={() => commitResolutionInput()}
                keyboardType="number-pad"
                placeholder="1216"
                placeholderTextColor={colors.colorTextTertiary}
                style={styles.sheetResolutionInput}
              />
            </View>
          </View>

          <View style={styles.sheetDivider} />

          {[
            NAI_RESOLUTIONS[1],
            NAI_RESOLUTIONS[0],
            NAI_RESOLUTIONS[2],
            NAI_RESOLUTIONS[3],
          ].map((group, groupIndex) => (
            <View
              key={group.group}
              style={groupIndex > 0 ? { marginTop: 20 } : undefined}
            >
              <Text style={styles.sheetResolutionGroupTitle}>
                {group.group}
              </Text>
              {group.options.map((item) => {
                const isActive =
                  resolution.width === item.width &&
                  resolution.height === item.height;
                return (
                  <BottomSheetTouchableOpacity
                    key={`${item.width}x${item.height}`}
                    style={styles.sheetResolutionItem}
                    activeOpacity={0.78}
                    onPress={() => setResolution(item as NaiResolution)}
                  >
                    <View style={styles.sheetResolutionItemTextGroup}>
                      <Text
                        style={[
                          styles.sheetResolutionItemTitle,
                          isActive && styles.sheetResolutionItemTitleActive,
                        ]}
                      >
                        {group.group} {item.label.split(" ")[0]}
                      </Text>
                      <Text
                        style={[
                          styles.sheetResolutionItemSubtitle,
                          isActive && styles.sheetResolutionItemSubtitleActive,
                        ]}
                      >
                        {item.width}×{item.height}
                      </Text>
                    </View>
                    {isActive && (
                      <Ionicons
                        name="checkmark"
                        size={20}
                        color={colors.colorTextInfo}
                      />
                    )}
                  </BottomSheetTouchableOpacity>
                );
              })}
            </View>
          ))}

          <View style={styles.sheetDivider} />
          <Text style={styles.sheetResolutionGroupTitle}>Custom</Text>
          <BottomSheetTouchableOpacity
            style={styles.sheetResolutionItem}
            activeOpacity={0.78}
          >
            <View style={styles.sheetResolutionItemTextGroup}>
              <Text
                style={[
                  styles.sheetResolutionItemTitle,
                  isCustomResolution && styles.sheetResolutionItemTitleActive,
                ]}
              >
                Custom Resolution
              </Text>
              <Text
                style={[
                  styles.sheetResolutionItemSubtitle,
                  isCustomResolution && styles.sheetResolutionItemSubtitleActive,
                ]}
              >
                {resolution.width}×{resolution.height}
              </Text>
            </View>
            {isCustomResolution && (
              <Ionicons
                name="checkmark"
                size={20}
                color={colors.colorTextInfo}
              />
            )}
          </BottomSheetTouchableOpacity>
        </BottomSheetScrollView>
      </BottomSheet>

      <BottomSheet
        ref={samplerSheetRef}
        index={-1}
        snapPoints={[540]}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        style={styles.sheetContainer}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.sheetHandle}
        enableDynamicSizing={false}
        onChange={(index) => handleSheetChange("sampler", index)}
      >
        <BottomSheetScrollView
          contentContainerStyle={styles.sheetScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sheetTitle}>Sampler</Text>
          {SAMPLERS.flatMap((item, index) => {
            const isActive = sampler === item.value;
            const el = (
              <BottomSheetTouchableOpacity
                key={item.value}
                style={styles.sheetModelItem}
                activeOpacity={0.78}
                onPress={() => {
                  setSampler(item.value);
                  closeSelectionSheet();
                }}
              >
                <View style={styles.sheetModelItemLabelRow}>
                  <Text
                    style={[
                      styles.sheetModelItemLabel,
                      isActive && styles.sheetModelItemLabelActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                  {item.value === "k_euler_ancestral" && (
                    <View style={styles.sheetModelItemBadge}>
                      <Text style={styles.sheetModelItemBadgeText}>권장</Text>
                    </View>
                  )}
                </View>
                {isActive && (
                  <Ionicons
                    name="checkmark"
                    size={20}
                    color={colors.colorTextInfo}
                  />
                )}
              </BottomSheetTouchableOpacity>
            );
            return index === 5
              ? [el, <View key="sampler-divider" style={styles.sheetDivider} />]
              : [el];
          })}
        </BottomSheetScrollView>
      </BottomSheet>

      <BottomSheet
        ref={noiseScheduleSheetRef}
        index={-1}
        snapPoints={[330]}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        style={styles.sheetContainer}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.sheetHandle}
        enableDynamicSizing={false}
        onChange={(index) => handleSheetChange("noiseSchedule", index)}
      >
        <BottomSheetScrollView
          contentContainerStyle={styles.sheetScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sheetTitle}>Noise Schedule</Text>
          {NOISE_SCHEDULES.flatMap((item, index) => {
            const isActive = noiseSchedule === item.value;
            const el = (
              <BottomSheetTouchableOpacity
                key={item.value}
                style={styles.sheetModelItem}
                activeOpacity={0.78}
                onPress={() => {
                  setNoiseSchedule(item.value as NoiseSchedule);
                  closeSelectionSheet();
                }}
              >
                <View style={styles.sheetModelItemLabelRow}>
                  <Text
                    style={[
                      styles.sheetModelItemLabel,
                      isActive && styles.sheetModelItemLabelActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                  {item.value === "karras" && (
                    <View style={styles.sheetModelItemBadge}>
                      <Text style={styles.sheetModelItemBadgeText}>권장</Text>
                    </View>
                  )}
                </View>
                {isActive && (
                  <Ionicons
                    name="checkmark"
                    size={20}
                    color={colors.colorTextInfo}
                  />
                )}
              </BottomSheetTouchableOpacity>
            );
            return index === 2
              ? [el, <View key="noise-divider" style={styles.sheetDivider} />]
              : [el];
          })}
        </BottomSheetScrollView>
      </BottomSheet>
    </>
  );
}
