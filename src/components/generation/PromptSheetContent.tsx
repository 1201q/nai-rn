import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type NativeSyntheticEvent,
  type TextLayoutEventData,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";

import { usePromptAutocomplete } from "../../hooks/usePromptAutocomplete";
import {
  getUcPresetLabel,
  UC_PRESET_OPTIONS,
  type SelectableUcPresetIndex,
} from "../../lib/naiPresets";
import { useGenerationStore } from "../../store/generationStore";
import { tokens } from "../../styles/tokens";
import { SheetSelect } from "../forms/SheetSelect";
import {
  PromptHighlightTextInput,
  type PromptHighlightTextInputHandle,
} from "../forms/PromptHighlightTextInput";
import { PromptTokenCounter } from "../forms/PromptTokenCounter";
import { CharacterPromptSection } from "./CharacterPromptSection";

type PromptChannel = "base" | "negative";
type OpenSelect = "quality" | "uc" | null;

const MERGED_MIN_HEIGHT = 96;
const BASE_SPLIT_MIN_HEIGHT = 76;
const NEGATIVE_SPLIT_MIN_HEIGHT = 60;
const PROMPT_LINE_HEIGHT = 23;
const QUALITY_OPTIONS = ["Quality Tags: Standard", "Quality Tags: None"];
const UC_OPTIONS = UC_PRESET_OPTIONS.map(
  (option) => `UC Preset: ${option.label}`,
);
const DIVIDER_DASHES = Array.from({ length: 64 }, (_, index) => index);

function PromptDraftInput({
  channel,
  value,
  height,
  onFocus,
  onChange,
  onCommit,
}: {
  channel: PromptChannel;
  value: string;
  height: number;
  onFocus?: () => void;
  onChange: (value: string) => void;
  onCommit: () => void;
}) {
  const inputRef = useRef<PromptHighlightTextInputHandle>(null);
  const autocomplete = usePromptAutocomplete({
    value,
    onChangeText: onChange,
    inputRef,
  });

  useEffect(
    () => () => {
      autocomplete.deactivateSuggestions();
    },
    [autocomplete.deactivateSuggestions],
  );

  return (
    <PromptHighlightTextInput
      ref={inputRef}
      accessibilityLabel={
        channel === "base" ? "Base prompt" : "Negative prompt"
      }
      multiline
      scrollEnabled={false}
      textAlignVertical="top"
      autoCapitalize="none"
      autoCorrect={false}
      placeholder={channel === "base" ? "1girl, ..." : "lowres, ..."}
      placeholderTextColor={tokens.color.textMuted}
      onFocus={() => {
        onFocus?.();
        autocomplete.activateSuggestions();
      }}
      onBlur={() => {
        onCommit();
        autocomplete.deactivateSuggestions();
      }}
      onChangeText={autocomplete.handleChangeText}
      onSelectionChange={autocomplete.handleSelectionChange}
      value={value}
      style={[
        styles.promptInput,
        channel === "negative" && styles.negativePromptInput,
        { height },
      ]}
    />
  );
}

export const PromptComposerCard = memo(function PromptComposerCard({
  active,
  onEditorFocus,
}: {
  active: boolean;
  onEditorFocus?: () => void;
}) {
  const prompt = useGenerationStore((state) => state.prompt);
  const setPrompt = useGenerationStore((state) => state.setPrompt);
  const negativePrompt = useGenerationStore((state) => state.negativePrompt);
  const setNegativePrompt = useGenerationStore(
    (state) => state.setNegativePrompt,
  );
  const qualityToggle = useGenerationStore((state) => state.qualityToggle);
  const setQualityToggle = useGenerationStore(
    (state) => state.setQualityToggle,
  );
  const ucPreset = useGenerationStore((state) => state.ucPreset);
  const setUcPreset = useGenerationStore((state) => state.setUcPreset);
  const [mode, setMode] = useState<PromptChannel>("base");
  const [split, setSplit] = useState(false);
  const [promptText, setPromptText] = useState(prompt);
  const [negativeText, setNegativeText] = useState(negativePrompt);
  const [promptHeight, setPromptHeight] = useState(MERGED_MIN_HEIGHT);
  const [negativeHeight, setNegativeHeight] = useState(MERGED_MIN_HEIGHT);
  const [openSelect, setOpenSelect] = useState<OpenSelect>(null);
  const promptRef = useRef(prompt);
  const negativeRef = useRef(negativePrompt);
  const committedPromptRef = useRef(prompt);
  const committedNegativeRef = useRef(negativePrompt);
  const setPromptRef = useRef(setPrompt);
  const setNegativePromptRef = useRef(setNegativePrompt);

  committedPromptRef.current = prompt;
  committedNegativeRef.current = negativePrompt;
  setPromptRef.current = setPrompt;
  setNegativePromptRef.current = setNegativePrompt;

  useEffect(() => {
    promptRef.current = prompt;
    setPromptText(prompt);
  }, [prompt]);
  useEffect(() => {
    negativeRef.current = negativePrompt;
    setNegativeText(negativePrompt);
  }, [negativePrompt]);
  useEffect(() => {
    if (!active) setOpenSelect(null);
  }, [active]);
  useEffect(
    () => () => {
      if (promptRef.current !== committedPromptRef.current) {
        setPromptRef.current(promptRef.current);
      }
      if (negativeRef.current !== committedNegativeRef.current) {
        setNegativePromptRef.current(negativeRef.current);
      }
    },
    [],
  );

  const updatePrompt = useCallback((value: string) => {
    promptRef.current = value;
    setPromptText(value);
  }, []);
  const updateNegative = useCallback((value: string) => {
    negativeRef.current = value;
    setNegativeText(value);
  }, []);
  const commitPrompt = useCallback(() => {
    if (promptRef.current !== committedPromptRef.current) {
      setPromptRef.current(promptRef.current);
    }
  }, []);
  const commitNegative = useCallback(() => {
    if (negativeRef.current !== committedNegativeRef.current) {
      setNegativePromptRef.current(negativeRef.current);
    }
  }, []);
  const selectMode = useCallback(
    (nextMode: PromptChannel) => {
      if (nextMode === mode) return;
      if (mode === "base") commitPrompt();
      else commitNegative();
      setOpenSelect(null);
      setMode(nextMode);
    },
    [commitNegative, commitPrompt, mode],
  );

  const measureText = useCallback(
    (
      channel: PromptChannel,
      event: NativeSyntheticEvent<TextLayoutEventData>,
    ) => {
      const measured = Math.max(
        MERGED_MIN_HEIGHT,
        event.nativeEvent.lines.length * PROMPT_LINE_HEIGHT + 12,
      );
      if (channel === "base") setPromptHeight(measured);
      else setNegativeHeight(measured);
    },
    [],
  );
  const mergedHeight = Math.max(
    MERGED_MIN_HEIGHT,
    promptHeight,
    negativeHeight,
  );
  const qualityValue = qualityToggle ? QUALITY_OPTIONS[0] : QUALITY_OPTIONS[1];
  const ucValue = `UC Preset: ${getUcPresetLabel(ucPreset)}`;

  const renderQualitySelect = () => (
    <SheetSelect
      accessibilityLabel="Quality Tags"
      value={qualityValue}
      options={QUALITY_OPTIONS}
      variant="compact"
      open={openSelect === "quality"}
      onOpenChange={(open) => setOpenSelect(open ? "quality" : null)}
      onChange={(value) => setQualityToggle(value === QUALITY_OPTIONS[0])}
    />
  );
  const renderUcSelect = () => (
    <SheetSelect
      accessibilityLabel="UC Preset"
      value={ucValue}
      options={UC_OPTIONS}
      variant="compact"
      open={openSelect === "uc"}
      onOpenChange={(open) => setOpenSelect(open ? "uc" : null)}
      onChange={(value) => {
        const label = value.replace("UC Preset: ", "");
        const option = UC_PRESET_OPTIONS.find((item) => item.label === label);
        if (option) setUcPreset(option.value as SelectableUcPresetIndex);
      }}
    />
  );

  return (
    <View style={styles.promptCard}>
      <View pointerEvents="none" style={styles.measureLayer}>
        <Text
          testID="prompt-base-measure"
          onTextLayout={(event) => measureText("base", event)}
          style={styles.measureText}
        >
          {promptText || " "}
        </Text>
        <Text
          testID="prompt-negative-measure"
          onTextLayout={(event) => measureText("negative", event)}
          style={styles.measureText}
        >
          {negativeText || " "}
        </Text>
      </View>

      {split ? (
        <>
          <View style={styles.splitPanel}>
            <View style={styles.promptHeader}>
              <Text style={styles.panelTitle}>Base Prompt</Text>
            </View>
            <PromptDraftInput
              channel="base"
              value={promptText}
              height={Math.max(BASE_SPLIT_MIN_HEIGHT, promptHeight)}
              onFocus={onEditorFocus}
              onChange={updatePrompt}
              onCommit={commitPrompt}
            />
            <View style={styles.promptFooter}>{renderQualitySelect()}</View>
            <PromptTokenCounter
              target={{ scope: "base", channel: "positive" }}
              draftText={promptText}
              variant="bar"
              style={styles.promptTokenCounter}
            />
          </View>
          <View pointerEvents="none" style={styles.splitDivider}>
            {DIVIDER_DASHES.map((dash) => (
              <View key={dash} style={styles.splitDividerDash} />
            ))}
          </View>
          <View style={styles.splitPanel}>
            <View style={[styles.promptHeader, styles.splitHeader]}>
              <Text style={[styles.panelTitle, styles.negativePanelTitle]}>
                Undesired Content
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Merged prompt로 전환"
                onPress={() => {
                  setOpenSelect(null);
                  setSplit(false);
                  setMode("negative");
                }}
                style={({ pressed }) => [
                  styles.splitCompareButton,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name="git-compare-outline"
                  size={16}
                  color={tokens.color.textTertiary}
                />
              </Pressable>
            </View>
            <PromptDraftInput
              channel="negative"
              value={negativeText}
              height={Math.max(NEGATIVE_SPLIT_MIN_HEIGHT, negativeHeight)}
              onFocus={onEditorFocus}
              onChange={updateNegative}
              onCommit={commitNegative}
            />
            <View style={styles.promptFooter}>{renderUcSelect()}</View>
            <PromptTokenCounter
              target={{ scope: "base", channel: "negative" }}
              draftText={negativeText}
              variant="bar"
              style={styles.promptTokenCounter}
            />
          </View>
        </>
      ) : (
        <View style={styles.mergedPanel}>
          <View style={styles.modeChips}>
            <Pressable
              accessibilityRole="radio"
              accessibilityLabel="Base Prompt"
              accessibilityState={{ selected: mode === "base" }}
              onPress={() => selectMode("base")}
              style={({ pressed }) => [
                styles.modeChip,
                mode === "base" && styles.modeChipActive,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.modeLabel,
                  mode === "base" && styles.baseModeLabelActive,
                ]}
              >
                Base Prompt
              </Text>
            </Pressable>

            <View
              style={[
                styles.modeChip,
                mode === "negative" && styles.modeChipActive,
              ]}
            >
              <Pressable
                accessibilityRole="radio"
                accessibilityLabel="Undesired Content"
                accessibilityState={{ selected: mode === "negative" }}
                onPress={() => selectMode("negative")}
                style={({ pressed }) => [
                  styles.modeChipLabelButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.modeLabel,
                    mode === "negative" && styles.negativeModeLabel,
                  ]}
                >
                  Undesired Content
                </Text>
              </Pressable>
              {mode === "negative" ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Split prompt로 전환"
                  onPress={() => {
                    setOpenSelect(null);
                    setSplit(true);
                  }}
                  style={({ pressed }) => [
                    styles.compareButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons
                    name="git-compare-outline"
                    size={16}
                    color={tokens.color.negative}
                  />
                </Pressable>
              ) : null}
            </View>
          </View>

          {mode === "base" ? (
            <PromptDraftInput
              channel="base"
              value={promptText}
              height={mergedHeight}
              onFocus={onEditorFocus}
              onChange={updatePrompt}
              onCommit={commitPrompt}
            />
          ) : (
            <PromptDraftInput
              channel="negative"
              value={negativeText}
              height={mergedHeight}
              onFocus={onEditorFocus}
              onChange={updateNegative}
              onCommit={commitNegative}
            />
          )}

          <View style={styles.promptFooter}>
            {mode === "base" ? renderQualitySelect() : renderUcSelect()}
          </View>
          <PromptTokenCounter
            target={{
              scope: "base",
              channel: mode === "base" ? "positive" : "negative",
            }}
            draftText={mode === "base" ? promptText : negativeText}
            variant="bar"
            style={styles.promptTokenCounter}
          />
        </View>
      )}
    </View>
  );
});

export const PromptSheetContent = memo(function PromptSheetContent({
  active,
}: {
  active: boolean;
}) {
  const [editingCharacterId, setEditingCharacterId] = useState<string | null>(
    null,
  );
  const clearEditingCharacter = useCallback(
    () => setEditingCharacterId(null),
    [],
  );

  useEffect(() => {
    if (!active) setEditingCharacterId(null);
  }, [active]);

  return (
    <BottomSheetScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <PromptComposerCard
        active={active}
        onEditorFocus={clearEditingCharacter}
      />
      <CharacterPromptSection
        active={active}
        editingCharacterId={editingCharacterId}
        onEditingCharacterChange={setEditingCharacterId}
      />
    </BottomSheetScrollView>
  );
});

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 14,
    paddingHorizontal: 14,
    paddingBottom: 200,
    gap: 14,
  },
  promptCard: {
    position: "relative",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    borderRadius: 20,
    backgroundColor: "#100F13",
  },
  mergedPanel: {
    padding: 15,
  },
  splitPanel: {
    paddingHorizontal: 15,
    paddingTop: 15,
    paddingBottom: 14,
  },
  splitDivider: {
    height: 1,
    overflow: "hidden",
    flexDirection: "row",
    gap: 3,
  },
  splitDividerDash: {
    width: 5,
    height: 1,
    flexShrink: 0,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  panelTitle: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: 13,
    letterSpacing: -0.2,
  },
  promptHeader: {
    height: 30,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  modeChips: {
    height: 30,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  splitHeader: {
    justifyContent: "space-between",
  },
  negativePanelTitle: {
    color: tokens.color.textSecondary,
  },
  modeChip: {
    minHeight: 30,
    overflow: "hidden",
    paddingHorizontal: 8,
    borderRadius: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  modeChipActive: {
    backgroundColor: tokens.color.card,
  },
  modeChipLabelButton: {
    minHeight: 30,
    justifyContent: "center",
  },
  modeLabel: {
    color: tokens.color.textMuted,
    fontFamily: tokens.font.semibold,
    fontSize: 13,
  },
  baseModeLabelActive: {
    color: tokens.color.textPrimary,
  },
  negativeModeLabel: {
    color: tokens.color.negative,
    fontFamily: tokens.font.semibold,
    fontSize: 13,
  },
  compareButton: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  splitCompareButton: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  promptInput: {
    minHeight: MERGED_MIN_HEIGHT,
    padding: 0,
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.regular,
    fontSize: 15,
    lineHeight: PROMPT_LINE_HEIGHT,
  },
  negativePromptInput: {
    color: tokens.color.textSecondary,
  },
  promptFooter: {
    minHeight: 22,
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  promptTokenCounter: {
    flex: 0,
    height: 4,
    marginTop: 10,
  },
  measureLayer: {
    position: "absolute",
    top: 0,
    right: 15,
    left: 15,
    opacity: 0,
  },
  measureText: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.regular,
    fontSize: 15,
    lineHeight: PROMPT_LINE_HEIGHT,
  },
  pressed: {
    opacity: 0.65,
  },
});
