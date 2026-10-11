import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type NativeSyntheticEvent,
  type TextLayoutEventData,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { getModelCapabilities } from "../../constants/models";
import { useGenerationInputCommitRegistration } from "../../context/GenerationInputCommitContext";
import { usePromptAutocomplete } from "../../hooks/usePromptAutocomplete";
import { useGenerationChromeMetrics } from "../../hooks/useGenerationChromeMetrics";
import {
  getQualityPresetLabel,
  getQualityPresetOptions,
  getUcPresetLabel,
  getUcPresetOptions,
  resolveQualityPresetForModel,
  resolveUcPresetForModel,
} from "../../lib/naiPresets";
import { useGenerationStore } from "../../store/generationStore";
import { tokens } from "../../styles/tokens";
import { SheetSelect } from "../forms/SheetSelect";
import {
  PromptHighlightTextInput,
  type PromptHighlightTextInputHandle,
} from "../forms/PromptHighlightTextInput";
import { PromptTokenCounter } from "../forms/PromptTokenCounter";
import { BottomSheetKeyboardAwareScrollView } from "./BottomSheetKeyboardAwareScrollView";
import { CharacterPromptSection } from "./CharacterPromptSection";
import { SUGGESTION_BAR_HEIGHT } from "./SuggestionBar";

type PromptChannel = "base" | "negative";
type OpenSelect = "quality" | "uc" | null;

const MERGED_MIN_HEIGHT = 96;
const BASE_SPLIT_MIN_HEIGHT = 76;
const NEGATIVE_SPLIT_MIN_HEIGHT = 60;
const PROMPT_LINE_HEIGHT = 23;
const PROMPT_KEYBOARD_GAP = 12;
const PROMPT_KEYBOARD_SCROLL_MODE =
  Platform.OS === "android" ? "layout" : "insets";
const DIVIDER_DASHES = Array.from({ length: 64 }, (_, index) => index);
const BASE_POSITIVE = { scope: "base", channel: "positive" } as const;
const BASE_NEGATIVE = { scope: "base", channel: "negative" } as const;

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
    channel,
    value,
    onChangeText: onChange,
    inputRef,
    insertTarget: channel === "base" ? BASE_POSITIVE : BASE_NEGATIVE,
  });
  const inputCommit = useGenerationInputCommitRegistration(onCommit);

  useEffect(
    () => () => {
      autocomplete.deactivateSuggestions();
    },
    [autocomplete.deactivateSuggestions],
  );

  return (
    // Keep the markdown decorator origin local when another input changes height.
    <View collapsable={false}>
      <PromptHighlightTextInput
        ref={inputRef}
        bottomSheetAware
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
          inputCommit.activate();
          onFocus?.();
          autocomplete.activateSuggestions();
        }}
        onBlur={() => {
          inputCommit.commitAndDeactivate();
          autocomplete.deactivateSuggestions();
        }}
        onChangeText={autocomplete.handleChangeText}
        onSelectionChange={autocomplete.handleSelectionChange}
        selection={autocomplete.selection}
        value={value}
        style={[
          styles.promptInput,
          channel === "negative" && styles.negativePromptInput,
          { height },
        ]}
      />
    </View>
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
  const qualityPreset = useGenerationStore((state) => state.qualityPreset);
  const setQualityPreset = useGenerationStore(
    (state) => state.setQualityPreset,
  );
  const ucPreset = useGenerationStore((state) => state.ucPreset);
  const setUcPreset = useGenerationStore((state) => state.setUcPreset);
  const transparentBackground = useGenerationStore(
    (state) => state.transparentBackground,
  );
  const setTransparentBackground = useGenerationStore(
    (state) => state.setTransparentBackground,
  );
  const model = useGenerationStore((state) => state.model);
  const supportsTransparentBackground = getModelCapabilities(model).v5Request;
  const ucPresetOptions = getUcPresetOptions(model);
  const qualityPresetOptions = getQualityPresetOptions(model);
  // 공식 웹과 동일: 고정 설정 모델(Effort Medium)은 UC를 쓸 수 없어 Base Prompt만 보여준다.
  // 선택 상태와 입력한 UC는 남겨 두어 High로 돌아가면 그대로 보인다.
  const ucLocked = getModelCapabilities(model).fixedSettings !== undefined;
  const [selectedMode, setMode] = useState<PromptChannel>("base");
  const [splitSelected, setSplit] = useState(false);
  const mode = ucLocked ? "base" : selectedMode;
  const split = splitSelected && !ucLocked;
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
  useEffect(() => {
    if (active) return;
    setOpenSelect(null);
    commitPrompt();
    commitNegative();
  }, [active, commitNegative, commitPrompt]);
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
  const qualityValue = getQualityPresetLabel(
    resolveQualityPresetForModel(qualityPreset, model),
  );
  const ucValue = getUcPresetLabel(resolveUcPresetForModel(ucPreset, model));

  const renderQualitySelect = () => (
    <SheetSelect
      accessibilityLabel="Quality Tags"
      value={qualityValue}
      displayValue={`Quality Tags: ${qualityValue}`}
      options={qualityPresetOptions.map((option) => option.label)}
      variant="compact"
      open={openSelect === "quality"}
      onOpenChange={(open) => setOpenSelect(open ? "quality" : null)}
      onChange={(label) => {
        const option = qualityPresetOptions.find(
          (item) => item.label === label,
        );
        if (option) setQualityPreset(option.value);
      }}
    />
  );
  // 공식 웹과 같이 Base Prompt 왼쪽 아래에 둔다 (V5 전용).
  const renderBaseFooter = () => (
    <>
      {supportsTransparentBackground ? (
        <Pressable
          accessibilityRole="switch"
          accessibilityLabel="Transparent BG"
          accessibilityState={{ checked: transparentBackground }}
          onPress={() => setTransparentBackground(!transparentBackground)}
          style={({ pressed }) => [
            styles.transparentToggle,
            transparentBackground && styles.transparentToggleActive,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name={transparentBackground ? "checkmark" : "close"}
            size={10}
            color={
              transparentBackground
                ? tokens.color.accent
                : tokens.color.textTertiary
            }
          />
          <Text
            style={[
              styles.transparentToggleLabel,
              transparentBackground && styles.transparentToggleLabelActive,
            ]}
          >
            Transparent BG
          </Text>
        </Pressable>
      ) : null}
      <View style={styles.footerSpacer} />
      {renderQualitySelect()}
    </>
  );
  const renderUcSelect = () => (
    <SheetSelect
      accessibilityLabel="UC Preset"
      value={ucValue}
      displayValue={`UC Preset: ${ucValue}`}
      options={ucPresetOptions.map((option) => option.label)}
      variant="compact"
      open={openSelect === "uc"}
      onOpenChange={(open) => setOpenSelect(open ? "uc" : null)}
      onChange={(label) => {
        const option = ucPresetOptions.find((item) => item.label === label);
        if (option) setUcPreset(option.value);
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
            <View style={styles.promptFooter}>{renderBaseFooter()}</View>
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
                  commitPrompt();
                  commitNegative();
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
                ucLocked && styles.hidden,
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
                    commitNegative();
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
            {mode === "base" ? renderBaseFooter() : renderUcSelect()}
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
  sheetHiddenHeight = 0,
  onEditCharacterPositions,
}: {
  active: boolean;
  sheetHiddenHeight?: number;
  onEditCharacterPositions: (characterId: string | null) => void;
}) {
  const { sheetContentPaddingBottom } = useGenerationChromeMetrics();
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
    <BottomSheetKeyboardAwareScrollView
      active={active}
      style={styles.scrollView}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingBottom: sheetContentPaddingBottom + sheetHiddenHeight },
      ]}
      bottomOffset={
        SUGGESTION_BAR_HEIGHT + PROMPT_KEYBOARD_GAP - sheetHiddenHeight
      }
      extraKeyboardSpace={SUGGESTION_BAR_HEIGHT}
      mode={PROMPT_KEYBOARD_SCROLL_MODE}
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
        onEditPositions={onEditCharacterPositions}
      />
    </BottomSheetKeyboardAwareScrollView>
  );
});

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 14,
    paddingHorizontal: 14,
    gap: 14,
  },
  promptCard: {
    position: "relative",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: tokens.color.promptBorder,
    borderRadius: 20,
    backgroundColor: tokens.color.promptSurface,
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
    // 알약형 칩의 둥근 끝이 토큰 바보다 안쪽으로 보이지 않게 살짝 내민다.
    marginHorizontal: -1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  footerSpacer: {
    flex: 1,
  },
  // Quality Tags 선택(SheetSelect compact)과 같은 크기
  transparentToggle: {
    height: 22,
    paddingHorizontal: 6,
    borderRadius: tokens.radius.pill,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderWidth: 1,
    borderColor: "transparent",
    backgroundColor: tokens.color.cardAlt,
  },
  transparentToggleActive: {
    borderColor: tokens.color.accent,
  },
  transparentToggleLabel: {
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.regular,
    fontSize: 11,
  },
  transparentToggleLabelActive: {
    color: tokens.color.accent,
  },
  promptTokenCounter: {
    flex: 0,
    height: 6,
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
  hidden: {
    display: "none",
  },
  pressed: {
    opacity: tokens.opacity.pressed,
  },
});
