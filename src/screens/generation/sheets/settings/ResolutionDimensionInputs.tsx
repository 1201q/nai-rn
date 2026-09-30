import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";

import {
  type NaiResolution,
  resolutionFromDimensions,
} from "../../../../constants/generation";
import { useGenerationInputCommitRegistration } from "../../../../context/GenerationInputCommitContext";
import { tokens } from "../../../../styles/tokens";
import { snapResolutionDimension } from "./resolution";

export function ResolutionDimensionInputs({
  active,
  resolution,
  onChange,
}: {
  active: boolean;
  resolution: NaiResolution;
  onChange: (resolution: NaiResolution) => void;
}) {
  const focusedInputRef = useRef<"width" | "height" | null>(null);
  const [widthText, setWidthText] = useState(String(resolution.width));
  const [heightText, setHeightText] = useState(String(resolution.height));
  const widthTextRef = useRef(widthText);
  const heightTextRef = useRef(heightText);

  useEffect(() => {
    if (!active) focusedInputRef.current = null;
    if (focusedInputRef.current !== null) return;
    const nextWidth = String(resolution.width);
    const nextHeight = String(resolution.height);
    widthTextRef.current = nextWidth;
    heightTextRef.current = nextHeight;
    setWidthText(nextWidth);
    setHeightText(nextHeight);
  }, [active, resolution.height, resolution.width]);

  const commitDimensions = useCallback(() => {
    const width = snapResolutionDimension(widthTextRef.current);
    const height = snapResolutionDimension(heightTextRef.current);
    const nextWidth = String(width);
    const nextHeight = String(height);
    widthTextRef.current = nextWidth;
    heightTextRef.current = nextHeight;
    setWidthText(nextWidth);
    setHeightText(nextHeight);
    onChange(resolutionFromDimensions(width, height));
  }, [onChange]);
  const widthCommit = useGenerationInputCommitRegistration(
    commitDimensions,
    active,
  );
  const heightCommit = useGenerationInputCommitRegistration(
    commitDimensions,
    active,
  );

  function swapDimensions() {
    const width = snapResolutionDimension(heightTextRef.current);
    const height = snapResolutionDimension(widthTextRef.current);
    const nextWidth = String(width);
    const nextHeight = String(height);
    widthTextRef.current = nextWidth;
    heightTextRef.current = nextHeight;
    setWidthText(nextWidth);
    setHeightText(nextHeight);
    onChange(resolutionFromDimensions(width, height));
  }

  return (
    <View style={styles.resolutionValue}>
      <BottomSheetTextInput
        accessibilityLabel="Resolution width"
        value={widthText}
        onChangeText={(value) => {
          const next = value.replace(/\D/g, "");
          widthTextRef.current = next;
          setWidthText(next);
        }}
        onFocus={() => {
          focusedInputRef.current = "width";
          widthCommit.activate();
        }}
        onBlur={() => {
          focusedInputRef.current = null;
          widthCommit.commitAndDeactivate();
        }}
        onSubmitEditing={commitDimensions}
        keyboardType="number-pad"
        returnKeyType="done"
        submitBehavior="blurAndSubmit"
        selectTextOnFocus
        style={styles.resolutionDimensionInput}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Width와 Height 바꾸기"
        onPress={swapDimensions}
        style={({ pressed }) => [
          styles.resolutionSwapButton,
          pressed && styles.pressed,
        ]}
      >
        <Ionicons name="close" size={14} color={tokens.color.textMuted} />
      </Pressable>
      <BottomSheetTextInput
        accessibilityLabel="Resolution height"
        value={heightText}
        onChangeText={(value) => {
          const next = value.replace(/\D/g, "");
          heightTextRef.current = next;
          setHeightText(next);
        }}
        onFocus={() => {
          focusedInputRef.current = "height";
          heightCommit.activate();
        }}
        onBlur={() => {
          focusedInputRef.current = null;
          heightCommit.commitAndDeactivate();
        }}
        onSubmitEditing={commitDimensions}
        keyboardType="number-pad"
        returnKeyType="done"
        submitBehavior="blurAndSubmit"
        selectTextOnFocus
        style={styles.resolutionDimensionInput}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  resolutionValue: {
    height: 34,
    marginLeft: "auto",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 10,
    backgroundColor: tokens.color.raised,
  },
  resolutionDimensionInput: {
    width: 36,
    height: 34,
    padding: 0,
    textAlign: "center",
    textAlignVertical: "center",
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.medium,
    fontSize: 14,
    fontVariant: ["tabular-nums"],
  },
  resolutionSwapButton: {
    width: 20,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: tokens.opacity.pressed,
  },
});
