import { memo, useCallback, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  NAI_RESOLUTIONS,
  type NaiResolution,
} from "../../constants/generation";
import { useGenerationStore } from "../../store/generationStore";
import { tokens } from "../../styles/tokens";
import {
  RendraSelectionSheet,
  type RendraSelectionOption,
} from "./RendraSelectionSheet";

const NORMAL_RESOLUTIONS =
  NAI_RESOLUTIONS.find((group) => group.group === "Normal")?.options ?? [];

function resolutionKey(width: number, height: number) {
  return `${width}x${height}`;
}

type ResolutionChoice = {
  value: string;
  resolution: NaiResolution;
};

export const RendraResolutionSheet = memo(function RendraResolutionSheet({
  onSelect,
  onOpenCustom,
}: {
  onSelect: () => void;
  onOpenCustom: () => void;
}) {
  const resolution = useGenerationStore((state) => state.resolution);
  const setResolution = useGenerationStore((state) => state.setResolution);
  const customResolutions = useGenerationStore(
    (state) => state.customResolutions,
  );

  const defaultChoices = useMemo<ResolutionChoice[]>(
    () =>
      NORMAL_RESOLUTIONS.map((item) => ({
        value: resolutionKey(item.width, item.height),
        resolution: item,
      })),
    [],
  );
  const customChoices = useMemo<ResolutionChoice[]>(
    () =>
      customResolutions.map((item) => ({
        value: resolutionKey(item.width, item.height),
        resolution: {
          label: "Custom Resolution",
          width: item.width,
          height: item.height,
        },
      })),
    [customResolutions],
  );
  const defaultOptions = useMemo<RendraSelectionOption<string>[]>(
    () =>
      defaultChoices.map((item) => ({
        value: item.value,
        label: `${item.resolution.width} x ${item.resolution.height}`,
      })),
    [defaultChoices],
  );
  const customOptions = useMemo<RendraSelectionOption<string>[]>(
    () =>
      customChoices.map((item) => ({
        value: item.value,
        label: `${item.resolution.width} x ${item.resolution.height}`,
      })),
    [customChoices],
  );

  const handleSelect = useCallback(
    (value: string) => {
      const choice = [...defaultChoices, ...customChoices].find(
        (item) => item.value === value,
      );
      if (!choice) return;
      setResolution(choice.resolution);
      onSelect();
    },
    [customChoices, defaultChoices, onSelect, setResolution],
  );

  const selectedValue = resolutionKey(resolution.width, resolution.height);

  return (
    <View style={styles.content}>
      <View style={styles.usageNotice}>
        <Ionicons
          name="information-circle-outline"
          size={19}
          color={tokens.color.accent}
        />
        <Text style={styles.usageNoticeText}>
          해상도가 높을수록 디테일이 좋아지지만 Anlas 소모와 생성 시간이
          늘어납니다.
        </Text>
      </View>

      <Text style={styles.sectionLabel}>DEFAULT</Text>
      <RendraSelectionSheet
        options={defaultOptions}
        selectedValue={selectedValue}
        onSelect={handleSelect}
      />

      {customOptions.length > 0 ? (
        <>
          <Text style={styles.sectionLabel}>CUSTOM</Text>
          <RendraSelectionSheet
            options={customOptions}
            selectedValue={selectedValue}
            onSelect={handleSelect}
          />
        </>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="커스텀 해상도 추가 및 관리"
        onPress={onOpenCustom}
        style={({ pressed }) => [
          styles.customButton,
          pressed && styles.customButtonPressed,
        ]}
      >
        <Ionicons name="add" size={20} color={tokens.color.textSecondary} />
        <Text style={styles.customButtonLabel}>커스텀 해상도 추가</Text>
        <Ionicons
          name="chevron-forward"
          size={18}
          color={tokens.color.textTertiary}
        />
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  content: {
    width: "100%",
    paddingTop: tokens.space[2],
  },
  usageNotice: {
    minHeight: 58,
    marginHorizontal: tokens.space[2],
    paddingHorizontal: tokens.space[6],
    paddingVertical: tokens.space[5],
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space[5],
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.sunken,
  },
  usageNoticeText: {
    flex: 1,
    color: tokens.color.textMuted,
    fontFamily: tokens.font.regular,
    fontSize: tokens.type["2xs"],
    lineHeight: 17,
  },
  sectionLabel: {
    paddingHorizontal: tokens.space[6],
    paddingTop: tokens.space[6],
    paddingBottom: tokens.space[2],
    color: tokens.color.textMuted,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type["3xs"],
    letterSpacing: tokens.tracking.wide,
  },
  customButton: {
    minHeight: 56,
    marginTop: tokens.space[4],
    paddingHorizontal: tokens.space[6],
    borderRadius: tokens.radius.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space[5],
    backgroundColor: tokens.color.sunken,
  },
  customButtonPressed: {
    opacity: 0.7,
  },
  customButtonLabel: {
    flex: 1,
    color: tokens.color.textSecondary,
    fontFamily: tokens.font.medium,
    fontSize: 17,
    lineHeight: 22,
  },
});
