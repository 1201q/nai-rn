import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import { toast } from "sonner-native";

import { NAI_RESOLUTIONS } from "../../constants/generation";
import { useGenerationStore } from "../../store/generationStore";
import { tokens } from "../../styles/tokens";
import {
  type RegisterSheetDraft,
  type SheetDraftController,
} from "./SheetDraft";

const RESOLUTION_STEP = 64;
const INITIAL_WIDTH = 1152;
const INITIAL_HEIGHT = 896;

function isDefaultResolution(width: number, height: number) {
  return (
    NAI_RESOLUTIONS.find((group) => group.group === "Normal")?.options.some(
      (item) => item.width === width && item.height === height,
    ) ?? false
  );
}

function snapDimension(value: string) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return RESOLUTION_STEP;
  return Math.max(
    RESOLUTION_STEP,
    Math.round(parsed / RESOLUTION_STEP) * RESOLUTION_STEP,
  );
}

function createCustomResolutionId() {
  return `custom-resolution-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function DimensionRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const dimension = snapDimension(value);

  return (
    <View style={styles.dimensionRow}>
      <Text style={styles.dimensionLabel}>{label}</Text>
      <BottomSheetTextInput
        accessibilityLabel={`${label} 값`}
        value={value}
        keyboardType="number-pad"
        returnKeyType="done"
        selectTextOnFocus
        onChangeText={(next) => onChange(next.replace(/\D/g, ""))}
        onEndEditing={() => onChange(String(dimension))}
        style={styles.dimensionInput}
      />
      <View style={styles.stepButtons}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label} 64 감소`}
          disabled={dimension <= RESOLUTION_STEP}
          onPress={() =>
            onChange(
              String(Math.max(RESOLUTION_STEP, dimension - RESOLUTION_STEP)),
            )
          }
          style={({ pressed }) => [
            styles.stepButton,
            dimension <= RESOLUTION_STEP && styles.stepButtonDisabled,
            pressed && styles.controlPressed,
          ]}
        >
          <Ionicons name="remove" size={20} color={tokens.color.textSecondary} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label} 64 증가`}
          onPress={() => onChange(String(dimension + RESOLUTION_STEP))}
          style={({ pressed }) => [
            styles.stepButton,
            pressed && styles.controlPressed,
          ]}
        >
          <Ionicons name="add" size={20} color={tokens.color.textSecondary} />
        </Pressable>
      </View>
    </View>
  );
}

export const CustomResolutionSheet = memo(
  function CustomResolutionSheet({
    registerDraft,
  }: {
    registerDraft: RegisterSheetDraft;
  }) {
    const customResolutions = useGenerationStore(
      (state) => state.customResolutions,
    );
    const setCustomResolutions = useGenerationStore(
      (state) => state.setCustomResolutions,
    );
    const [widthText, setWidthText] = useState(String(INITIAL_WIDTH));
    const [heightText, setHeightText] = useState(String(INITIAL_HEIGHT));
    const addingRef = useRef(false);
    const width = Number.parseInt(widthText, 10);
    const height = Number.parseInt(heightText, 10);
    const inputValid =
      Number.isSafeInteger(width) &&
      Number.isSafeInteger(height) &&
      width >= RESOLUTION_STEP &&
      height >= RESOLUTION_STEP &&
      width % RESOLUTION_STEP === 0 &&
      height % RESOLUTION_STEP === 0;
    const dirty =
      widthText !== String(INITIAL_WIDTH) ||
      heightText !== String(INITIAL_HEIGHT);
    const duplicate =
      inputValid &&
      (isDefaultResolution(width, height) ||
        customResolutions.some(
          (item) => item.width === width && item.height === height,
        ));

    const addResolution = useCallback(() => {
      if (addingRef.current || !inputValid || duplicate) return false;
      addingRef.current = true;
      setCustomResolutions([
        ...customResolutions,
        {
          id: createCustomResolutionId(),
          width,
          height,
        },
      ]);
      toast.success("해상도를 추가했습니다.");
      return true;
    }, [
      customResolutions,
      duplicate,
      height,
      inputValid,
      setCustomResolutions,
      width,
    ]);

    const addResolutionRef = useRef(addResolution);
    useEffect(() => {
      addResolutionRef.current = addResolution;
    }, [addResolution]);

    const draftController = useMemo<SheetDraftController>(
      () => ({
        id: "resolutionCustom",
        dirty,
        canSave: inputValid && !duplicate,
        promptTitle: "해상도 추가 취소",
        promptMessage: "입력한 커스텀 해상도를 추가하지 않고 닫을까요?",
        save: () => addResolutionRef.current(),
      }),
      [dirty, duplicate, inputValid],
    );

    useEffect(() => {
      registerDraft(draftController);
      return () => registerDraft(null);
    }, [draftController, registerDraft]);

    function swapDimensions() {
      setWidthText(heightText);
      setHeightText(widthText);
    }

    return (
      <View style={styles.content}>
        <DimensionRow
          label="WIDTH"
          value={widthText}
          onChange={setWidthText}
        />
        <DimensionRow
          label="HEIGHT"
          value={heightText}
          onChange={setHeightText}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="가로와 세로 바꾸기"
          onPress={swapDimensions}
          style={({ pressed }) => [
            styles.swapButton,
            pressed && styles.controlPressed,
          ]}
        >
          <Ionicons
            name="swap-vertical-outline"
            size={19}
            color={tokens.color.textTertiary}
          />
          <Text style={styles.swapLabel}>가로·세로 바꾸기</Text>
        </Pressable>

        {!inputValid || duplicate ? (
          <Text style={styles.validationText}>
            {duplicate
              ? "이미 존재하는 해상도입니다."
              : "해상도는 64 단위로 입력해 주세요."}
          </Text>
        ) : null}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  content: {
    width: "100%",
    paddingTop: tokens.space[6],
    gap: tokens.space[5],
  },
  dimensionRow: {
    height: 58,
    marginHorizontal: tokens.space[4],
    paddingLeft: tokens.space[7],
    paddingRight: tokens.space[3],
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: tokens.color.borderSubtleStrong,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.sunken,
  },
  dimensionLabel: {
    width: 76,
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.bold,
    fontSize: tokens.type["2xs"],
    letterSpacing: tokens.tracking.wide,
  },
  dimensionInput: {
    flex: 1,
    height: 56,
    padding: 0,
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: 20,
  },
  stepButtons: {
    flexDirection: "row",
    gap: tokens.space[4],
  },
  stepButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.raised,
  },
  stepButtonDisabled: {
    opacity: 0.35,
  },
  swapButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.space[4],
  },
  swapLabel: {
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.medium,
    fontSize: tokens.type.sm,
  },
  validationText: {
    marginTop: -tokens.space[5],
    paddingHorizontal: tokens.space[4],
    color: tokens.color.negative,
    fontFamily: tokens.font.regular,
    fontSize: tokens.type["2xs"],
    textAlign: "center",
  },
  controlPressed: {
    opacity: 0.65,
  },
});
