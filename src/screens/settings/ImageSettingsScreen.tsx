import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Animated,
  Keyboard,
  LayoutAnimation,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { toast } from "sonner-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import PagerView from "react-native-pager-view";
import Reanimated, {
  Easing,
  FadeInDown,
  FadeOut,
} from "react-native-reanimated";
import {
  KeyboardAwareScrollView,
  KeyboardStickyView,
} from "react-native-keyboard-controller";

import { useAppSheet, useAppSheetOpen } from "../../context/AppSheetContext";
import { SuggestionBarProvider } from "../../context/SuggestionBarContext";
import { CharacterCard } from "../../components/generation/CharacterCard";
import { ReferenceRow } from "../../components/generation/ReferenceRow";
import { SuggestionBar } from "../../components/generation/SuggestionBar";
import { ScreenEdgeFade } from "../../components/common/ScreenEdgeFade";
import { TapFeedbackPressable } from "../../components/common/TapFeedbackPressable";
import {
  DETAIL_HEADER_TOP_OFFSET,
  DetailHeaderOverlay,
  DetailScrollTitle,
} from "../../components/common/DetailScrollHeader";
import {
  ParameterSlider,
  PromptEditor,
  Toggle,
} from "../../components/forms/FormControls";
import {
  SettingsTabBar,
  type SettingsTab,
} from "../../components/generation/SettingsNavigation";
import {
  MAX_CHARACTER_PROMPTS,
  MODELS,
  NOISE_SCHEDULES,
  SAMPLERS,
} from "../../constants/generation";
import {
  type CharacterPrompt,
  useGenerationStore,
} from "../../store/generationStore";
import { tokens } from "../../styles/tokens";
import { getUcPresetLabel } from "../../lib/naiPresets";
import { warmPromptTokenizerForModel } from "../../lib/promptTokens/loader";

type SettingsTabKey = "settings" | "prompt";

let lastViewedTab: SettingsTabKey = "settings";

const CHARACTER_PROMPT_ENTERING = FadeInDown.duration(180).easing(
  Easing.out(Easing.cubic),
);
const CHARACTER_PROMPT_EXITING = FadeOut.duration(120).easing(
  Easing.out(Easing.cubic),
);
const CHARACTER_PROMPT_LAYOUT = {
  duration: 200,
  create: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
  update: {
    type: LayoutAnimation.Types.easeInEaseOut,
  },
  delete: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
} as const;

function animateCharacterPromptLayout() {
  LayoutAnimation.configureNext(CHARACTER_PROMPT_LAYOUT);
}

const STEPS_CONFIG = { min: 1, max: 50, step: 1, precision: 0 } as const;
const CFG_CONFIG = { min: 0, max: 10, step: 0.1, precision: 1 } as const;
const CFG_RESCALE_CONFIG = {
  min: 0,
  max: 1,
  step: 0.02,
  precision: 2,
} as const;
const OPTION_DESCRIPTIONS = {
  steps:
    "이미지를 정제하는 반복 횟수입니다. 낮으면 빠르게 구도를 시험할 수 있고, 높으면 시간과 비용이 늘지만 항상 더 좋아지지는 않습니다. Opus 티어의 무료 일반 생성 상한은 28입니다.",
  cfgScale:
    "프롬프트를 따르는 강도입니다. 낮으면 더 자유롭고 부드러우며, 높으면 지시와 세부 표현이 강해집니다. 너무 높으면 색과 형태가 과해질 수 있습니다.",
  cfgRescale:
    "높은 CFG에서 색이 지나치게 진하거나 경계가 거칠어질 때 완화합니다. 평소에는 0으로 두고 문제가 보일 때 조금씩 올려보세요.",
  varietyPlus:
    "초기 구도 단계의 프롬프트 제약을 줄여 포즈와 배경의 다양성을 높입니다. 세부 단계에서는 다시 프롬프트를 따르지만, UC도 늦게 적용된다는 점에 유의하세요.",
  qualityTags:
    "품질·미학 태그를 프롬프트에 자동으로 추가합니다. 기본 품질을 높이기 쉽지만 애니 캐릭터 쪽으로 편향되거나 원하는 텍스트가 약해질 수 있습니다.",
  characterPositions:
    "캐릭터가 나타날 대략적인 위치를 지정합니다. 위치는 강제 배치가 아니라 힌트이므로 위치가 보장되지는 않습니다.",
} as const;

type IconName = keyof typeof Ionicons.glyphMap;
type TooltipAnchor = { x: number; y: number; width: number; height: number };

function InfoTooltipButton({
  label,
  description,
}: {
  label: string;
  description: string;
}) {
  const anchorRef = useRef<View>(null);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [anchor, setAnchor] = useState<TooltipAnchor | null>(null);
  const [tooltipHeight, setTooltipHeight] = useState(72);
  const visible = anchor !== null;

  const tooltipWidth = Math.min(320, windowWidth - 32);
  const showBelow = anchor ? anchor.y - tooltipHeight - 10 < 16 : false;
  const tooltipLeft = anchor
    ? Math.max(
        16,
        Math.min(
          windowWidth - tooltipWidth - 16,
          anchor.x + anchor.width / 2 - tooltipWidth / 2,
        ),
      )
    : 16;
  const tooltipTop = anchor
    ? showBelow
      ? Math.min(
          windowHeight - tooltipHeight - 16,
          anchor.y + anchor.height + 10,
        )
      : Math.max(16, anchor.y - tooltipHeight - 10)
    : 16;
  const arrowLeft = anchor
    ? Math.max(
        14,
        Math.min(
          tooltipWidth - 22,
          anchor.x + anchor.width / 2 - tooltipLeft - 5,
        ),
      )
    : 14;

  function toggleTooltip() {
    if (visible) {
      setAnchor(null);
      return;
    }
    anchorRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
    });
  }

  function handleTooltipLayout(event: LayoutChangeEvent) {
    const nextHeight = event.nativeEvent.layout.height;
    if (nextHeight !== tooltipHeight) setTooltipHeight(nextHeight);
  }

  return (
    <>
      <Pressable
        ref={anchorRef}
        accessibilityRole="button"
        accessibilityLabel={`${label} 설명`}
        accessibilityHint="옵션 설명을 표시합니다"
        hitSlop={8}
        onPress={toggleTooltip}
        style={({ pressed }) => [
          styles.infoButton,
          pressed && styles.infoButtonPressed,
        ]}
      >
        <Ionicons
          name="information"
          size={10}
          color={tokens.color.textTertiary}
        />
      </Pressable>

      <Modal
        transparent
        visible={visible}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setAnchor(null)}
      >
        <View style={styles.tooltipModalRoot}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="옵션 설명 닫기"
            style={StyleSheet.absoluteFill}
            onPress={() => setAnchor(null)}
          />
          {anchor ? (
            <View
              accessibilityViewIsModal
              onLayout={handleTooltipLayout}
              style={[
                styles.infoTooltip,
                {
                  top: tooltipTop,
                  left: tooltipLeft,
                  width: tooltipWidth,
                },
              ]}
            >
              <View
                style={[
                  styles.infoTooltipArrow,
                  showBelow
                    ? styles.infoTooltipArrowTop
                    : styles.infoTooltipArrowBottom,
                  { left: arrowLeft },
                ]}
              />
              <Text style={styles.infoTooltipText}>{description}</Text>
            </View>
          ) : null}
        </View>
      </Modal>
    </>
  );
}

const TABS: readonly SettingsTab[] = [
  { key: "settings", label: "설정", icon: "settings-outline" },
  { key: "prompt", label: "프롬프트", icon: "document-text-outline" },
];

const TITLES: Record<SettingsTabKey, string> = {
  settings: "설정",
  prompt: "프롬프트",
};

function SettingsOptionRow({
  icon,
  label,
  labelAccessory,
  value,
  onPress,
  trailing,
  accentIcon = false,
}: {
  icon?: IconName;
  label: string;
  labelAccessory?: ReactNode;
  value?: string;
  onPress?: () => void;
  trailing?: ReactNode;
  accentIcon?: boolean;
}) {
  const content = (
    <>
      {icon ? (
        <Ionicons
          name={icon}
          size={20}
          color={accentIcon ? tokens.color.accent : tokens.color.textTertiary}
        />
      ) : null}
      <View style={styles.settingsRowLabelGroup}>
        <Text style={styles.settingsRowLabel}>{label}</Text>
        {labelAccessory}
      </View>
      {value ? (
        <Text style={styles.settingsRowValue} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {trailing ??
        (onPress ? (
          <Ionicons
            name="chevron-forward"
            size={17}
            color={tokens.color.textMuted}
          />
        ) : null)}
    </>
  );

  if (!onPress) {
    return <View style={styles.settingsRow}>{content}</View>;
  }

  return (
    <TapFeedbackPressable
      accessibilityRole="button"
      accessibilityLabel={`${label}${value ? `, ${value}` : ""}`}
      onPress={onPress}
      style={styles.settingsRow}
      contentStyle={styles.settingsRowTapContent}
    >
      {content}
    </TapFeedbackPressable>
  );
}

function SettingsTabContent() {
  const { open } = useAppSheet();
  const router = useRouter();
  const model = useGenerationStore((state) => state.model);
  const resolution = useGenerationStore((state) => state.resolution);
  const seed = useGenerationStore((state) => state.seed);
  const seedLocked = useGenerationStore((state) => state.seedLocked);
  const steps = useGenerationStore((state) => state.steps);
  const setSteps = useGenerationStore((state) => state.setSteps);
  const promptGuidance = useGenerationStore((state) => state.promptGuidance);
  const setPromptGuidance = useGenerationStore(
    (state) => state.setPromptGuidance,
  );
  const promptGuidanceRescale = useGenerationStore(
    (state) => state.promptGuidanceRescale,
  );
  const setPromptGuidanceRescale = useGenerationStore(
    (state) => state.setPromptGuidanceRescale,
  );
  const sampler = useGenerationStore((state) => state.sampler);
  const noiseSchedule = useGenerationStore((state) => state.noiseSchedule);
  const varietyPlus = useGenerationStore((state) => state.varietyPlus);
  const setVarietyPlus = useGenerationStore((state) => state.setVarietyPlus);

  const modelText = MODELS.find((item) => item.value === model)?.label ?? model;
  const samplerText =
    SAMPLERS.find((item) => item.value === sampler)?.label ?? sampler;
  const scheduleText =
    NOISE_SCHEDULES.find((item) => item.value === noiseSchedule)?.label ??
    noiseSchedule;
  const seedText = seedLocked ? String(seed) : "Random";

  return (
    <View style={styles.settingsContent}>
      <View style={styles.settingsGroup}>
        <SettingsOptionRow
          label="Model"
          value={modelText}
          onPress={() =>
            router.navigate({
              pathname: "/generation-option",
              params: { option: "model" },
            })
          }
          accentIcon
        />
        <View style={styles.settingsGroupDivider} />
        <SettingsOptionRow
          label="Resolution"
          value={`${resolution.width}x${resolution.height}`}
          onPress={() => router.navigate("/resolution")}
          accentIcon
        />
      </View>

      <View style={styles.settingsCard}>
        <SettingsOptionRow
          label="Seed"
          value={seedText}
          onPress={() => open("seed")}
        />
      </View>

      <View style={styles.settingsGroup}>
        <View style={styles.settingsParameterRow}>
          <ParameterSlider
            label="Steps"
            labelAccessory={
              <InfoTooltipButton
                label="Steps"
                description={OPTION_DESCRIPTIONS.steps}
              />
            }
            value={steps}
            min={STEPS_CONFIG.min}
            max={STEPS_CONFIG.max}
            step={STEPS_CONFIG.step}
            precision={STEPS_CONFIG.precision}
            onChange={setSteps}
            settingsCard
          />
        </View>
        <View style={styles.settingsGroupDivider} />
        <View style={styles.settingsParameterRow}>
          <ParameterSlider
            label="CFG Scale"
            labelAccessory={
              <InfoTooltipButton
                label="CFG Scale"
                description={OPTION_DESCRIPTIONS.cfgScale}
              />
            }
            value={promptGuidance}
            min={CFG_CONFIG.min}
            max={CFG_CONFIG.max}
            step={CFG_CONFIG.step}
            precision={CFG_CONFIG.precision}
            onChange={setPromptGuidance}
            settingsCard
          />
        </View>
        <View style={styles.settingsGroupDivider} />
        <View style={styles.settingsParameterRow}>
          <ParameterSlider
            label="CFG Rescale"
            labelAccessory={
              <InfoTooltipButton
                label="CFG Rescale"
                description={OPTION_DESCRIPTIONS.cfgRescale}
              />
            }
            value={promptGuidanceRescale}
            min={CFG_RESCALE_CONFIG.min}
            max={CFG_RESCALE_CONFIG.max}
            step={CFG_RESCALE_CONFIG.step}
            precision={CFG_RESCALE_CONFIG.precision}
            onChange={setPromptGuidanceRescale}
            settingsCard
          />
        </View>
      </View>

      <View style={styles.settingsGroup}>
        <SettingsOptionRow
          label="Sampler"
          value={samplerText}
          onPress={() =>
            router.navigate({
              pathname: "/generation-option",
              params: { option: "sampler" },
            })
          }
        />
        <View style={styles.settingsGroupDivider} />
        <SettingsOptionRow
          label="Schedule"
          value={scheduleText}
          onPress={() =>
            router.navigate({
              pathname: "/generation-option",
              params: { option: "schedule" },
            })
          }
        />
      </View>

      <View style={styles.parameterItem}>
        <View style={styles.settingsCard}>
          <SettingsOptionRow
            label="Variety+"
            labelAccessory={
              <InfoTooltipButton
                label="Variety+"
                description={OPTION_DESCRIPTIONS.varietyPlus}
              />
            }
            trailing={
              <Toggle
                value={varietyPlus}
                label="Variety+"
                onChange={setVarietyPlus}
              />
            }
          />
        </View>
      </View>

      <Text style={styles.sectionLabel}>고급 기능</Text>

      <AdvancedFeaturesContent />
    </View>
  );
}

const PromptTabContent = memo(function PromptTabContent() {
  const router = useRouter();
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

  return (
    <View style={styles.promptContent}>
      <PromptEditor
        prompt={prompt}
        negativePrompt={negativePrompt}
        onCommitPrompt={setPrompt}
        onCommitNegativePrompt={setNegativePrompt}
      />

      <Text style={styles.sectionLabel}>캐릭터 프롬프트</Text>

      <CharacterPromptCards />

      <View style={styles.promptSettingsContent}>
        <Text style={styles.sectionLabel}>프롬프트 설정</Text>

        <View style={styles.settingsGroup}>
          <SettingsOptionRow
            label="Quality Tags"
            labelAccessory={
              <InfoTooltipButton
                label="Quality Tags"
                description={OPTION_DESCRIPTIONS.qualityTags}
              />
            }
            trailing={
              <Toggle
                value={qualityToggle}
                label="Quality Tags"
                onChange={setQualityToggle}
              />
            }
          />
          <View style={styles.settingsGroupDivider} />
          <SettingsOptionRow
            label="UC Preset"
            value={getUcPresetLabel(ucPreset)}
            onPress={() =>
              router.navigate({
                pathname: "/generation-option",
                params: { option: "ucPreset" },
              })
            }
          />
        </View>

        <CharacterPromptSettings />
      </View>
    </View>
  );
});

function addCharacterPrompt() {
  const state = useGenerationStore.getState();
  const current = state.characterPrompts;
  if (current.length >= MAX_CHARACTER_PROMPTS) return;

  animateCharacterPromptLayout();
  const id = `character-${Date.now()}-${current.length}`;
  const next: CharacterPrompt = {
    id,
    prompt: "",
    negativePrompt: "",
    enabled: true,
    position: { x: 0.5, y: 0.5 },
  };
  state.setCharacterPrompts([...current, next]);
  state.setCharacterPromptExpandedIds([
    ...state.characterPromptExpandedIds,
    id,
  ]);
  toast.success("캐릭터 프롬프트를 추가했습니다.");
}

const CharacterPromptCards = memo(function CharacterPromptCards() {
  const { open, openCharacterPosition } = useAppSheet();
  const characterPrompts = useGenerationStore(
    (state) => state.characterPrompts,
  );
  const setCharacterPrompts = useGenerationStore(
    (state) => state.setCharacterPrompts,
  );
  const expandedIds = useGenerationStore(
    (state) => state.characterPromptExpandedIds,
  );
  const setExpandedIds = useGenerationStore(
    (state) => state.setCharacterPromptExpandedIds,
  );
  const positionEnabled = useGenerationStore(
    (state) => state.characterPositionEnabled,
  );
  useEffect(() => {
    const ids = new Set(characterPrompts.map((item) => item.id));
    const next = expandedIds.filter(
      (id, index) => ids.has(id) && expandedIds.indexOf(id) === index,
    );
    if (next.length !== expandedIds.length) setExpandedIds(next);
  }, [characterPrompts, expandedIds, setExpandedIds]);

  const updateCharacter = useCallback(
    (id: string, values: Partial<Omit<CharacterPrompt, "id">>) => {
      const current = useGenerationStore.getState().characterPrompts;
      setCharacterPrompts(
        current.map((item) => (item.id === id ? { ...item, ...values } : item)),
      );
      if ("name" in values) {
        toast.success("캐릭터 프롬프트 이름을 변경했습니다.");
      }
    },
    [setCharacterPrompts],
  );

  const toggleExpanded = useCallback(
    (id: string) => {
      const current = useGenerationStore.getState().characterPromptExpandedIds;
      setExpandedIds(
        current.includes(id)
          ? current.filter((value) => value !== id)
          : [...current, id],
      );
    },
    [setExpandedIds],
  );

  const copyCharacter = useCallback(
    (id: string) => {
      const current = useGenerationStore.getState().characterPrompts;
      if (current.length >= MAX_CHARACTER_PROMPTS) return;
      const sourceIndex = current.findIndex((item) => item.id === id);
      if (sourceIndex < 0) return;
      const source = current[sourceIndex];
      const copiedId = `character-copy-${Date.now()}-${current.length}`;
      const copied: CharacterPrompt = {
        ...source,
        id: copiedId,
        position: { ...source.position },
      };
      const next = [...current];
      next.splice(sourceIndex + 1, 0, copied);
      animateCharacterPromptLayout();
      setCharacterPrompts(next);
      setExpandedIds([
        ...useGenerationStore.getState().characterPromptExpandedIds,
        copiedId,
      ]);
      toast.success("캐릭터 프롬프트를 복사했습니다.");
    },
    [setCharacterPrompts, setExpandedIds],
  );

  const deleteCharacter = useCallback(
    (id: string) => {
      const current = useGenerationStore.getState().characterPrompts;
      animateCharacterPromptLayout();
      setCharacterPrompts(current.filter((item) => item.id !== id));
      setExpandedIds(
        useGenerationStore
          .getState()
          .characterPromptExpandedIds.filter((value) => value !== id),
      );
      toast.success("캐릭터 프롬프트를 삭제했습니다.");
    },
    [setCharacterPrompts, setExpandedIds],
  );

  const openCharacterOrder = useCallback(() => open("characterOrder"), [open]);

  const canAdd = characterPrompts.length < MAX_CHARACTER_PROMPTS;

  return (
    <View style={styles.characterCards}>
      {characterPrompts.length === 0 ? (
        <Reanimated.View
          key="empty"
          entering={CHARACTER_PROMPT_ENTERING}
          exiting={CHARACTER_PROMPT_EXITING}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="캐릭터 프롬프트 추가, 현재 0개"
            onPress={addCharacterPrompt}
            style={({ pressed }) => [
              styles.emptyCharacterPrompts,
              pressed && styles.emptyCharacterPromptsPressed,
            ]}
          >
            <Ionicons
              name="add-circle-outline"
              size={32}
              color={tokens.color.textMuted}
            />
            <Text style={styles.emptyCharacterPromptsLabel}>
              캐릭터 프롬프트 추가
            </Text>
            <Text style={styles.emptyCharacterPromptsCount}>현재 0개</Text>
          </Pressable>
        </Reanimated.View>
      ) : (
        <>
          {characterPrompts.map((item, index) => (
            <Reanimated.View
              key={item.id}
              entering={CHARACTER_PROMPT_ENTERING}
              exiting={CHARACTER_PROMPT_EXITING}
            >
              <CharacterCard
                item={item}
                index={index}
                expanded={expandedIds.includes(item.id)}
                positionEnabled={positionEnabled}
                canCopy={canAdd}
                canReorder={characterPrompts.length > 1}
                onToggleExpand={toggleExpanded}
                onUpdate={updateCharacter}
                onCopy={copyCharacter}
                onDelete={deleteCharacter}
                onOpenOrder={openCharacterOrder}
                onOpenPosition={openCharacterPosition}
              />
            </Reanimated.View>
          ))}
          {canAdd ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="캐릭터 프롬프트 추가"
              onPress={addCharacterPrompt}
              style={({ pressed }) => [
                styles.addCharacterPromptButton,
                pressed && styles.emptyCharacterPromptsPressed,
              ]}
            >
              <Ionicons name="add" size={20} color={tokens.color.accent} />
              <Text style={styles.addCharacterPromptButtonLabel}>
                캐릭터 프롬프트 추가
              </Text>
            </Pressable>
          ) : null}
        </>
      )}
    </View>
  );
});

const CharacterPromptSettings = memo(function CharacterPromptSettings() {
  const positionEnabled = useGenerationStore(
    (state) => state.characterPositionEnabled,
  );
  const setPositionEnabled = useGenerationStore(
    (state) => state.setCharacterPositionEnabled,
  );

  return (
    <>
      <Text style={styles.sectionLabel}>캐릭터 프롬프트 설정</Text>
      <View style={styles.parameterItem}>
        <View style={styles.settingsCard}>
          <SettingsOptionRow
            label="Character Positions"
            labelAccessory={
              <InfoTooltipButton
                label="Character Positions"
                description={OPTION_DESCRIPTIONS.characterPositions}
              />
            }
            trailing={
              <Toggle
                value={positionEnabled}
                label="Character Positions"
                onChange={setPositionEnabled}
              />
            }
          />
        </View>
      </View>
    </>
  );
});

function AdvancedFeaturesContent() {
  const router = useRouter();
  const { open } = useAppSheet();
  const sourceImage = useGenerationStore((state) => state.i2iSourceImage);
  const i2iEnabled = useGenerationStore((state) => state.i2iEnabled);
  const i2iStrength = useGenerationStore((state) => state.i2iStrength);
  const i2iNoise = useGenerationStore((state) => state.i2iNoise);
  const setI2IEnabled = useGenerationStore((state) => state.setI2IEnabled);
  const vibeReferences = useGenerationStore((state) => state.vibeReferences);
  const setVibeEnabled = useGenerationStore(
    (state) => state.setVibeReferencesEnabled,
  );
  const preciseReferences = useGenerationStore(
    (state) => state.preciseReferences,
  );
  const setPreciseEnabled = useGenerationStore(
    (state) => state.setPreciseReferencesEnabled,
  );
  const batchCount = useGenerationStore((state) => state.batchCount);

  const vibeEnabled = vibeReferences.some((item) => item.enabled);
  const preciseEnabled = preciseReferences.some((item) => item.enabled);

  function toggleVibe(value: boolean) {
    if (value && vibeReferences.length === 0) {
      router.navigate("/vibe-transfer");
      return;
    }
    setVibeEnabled(value);
  }

  function togglePrecise(value: boolean) {
    if (value && preciseReferences.length === 0) {
      router.navigate("/precise-reference");
      return;
    }
    setPreciseEnabled(value);
  }

  return (
    <View style={styles.referenceRows}>
      <View style={styles.settingsGroup}>
        <ReferenceRow
          variant="grouped"
          label="Image2Image"
          enabled={i2iEnabled}
          stateLabel={
            i2iEnabled
              ? `S ${Number(i2iStrength.toFixed(2))} · N ${Number(i2iNoise.toFixed(2))}`
              : undefined
          }
          onPress={() => router.navigate("/image-to-image")}
          onToggle={(value) => {
            if (value && !sourceImage) router.navigate("/image-to-image");
            else setI2IEnabled(value);
          }}
        />
        <View style={styles.settingsGroupDivider} />
        <ReferenceRow
          variant="grouped"
          label="Vibe Transfer"
          enabled={vibeEnabled}
          stateLabel={
            preciseEnabled
              ? "Precise Reference와 동시에 켤 수 없습니다."
              : undefined
          }
          toggleDisabled={preciseEnabled}
          onPress={() => router.navigate("/vibe-transfer")}
          onToggle={toggleVibe}
        />
        <View style={styles.settingsGroupDivider} />
        <ReferenceRow
          variant="grouped"
          label="Precise Reference"
          enabled={preciseEnabled}
          stateLabel={
            vibeEnabled ? "Vibe Transfer와 동시에 켤 수 없습니다." : undefined
          }
          toggleDisabled={vibeEnabled}
          onPress={() => router.navigate("/precise-reference")}
          onToggle={togglePrecise}
        />
      </View>
      <View style={styles.settingsGroup}>
        <SettingsOptionRow
          label="Metadata Extract"
          onPress={() => router.navigate("/metadata-extract")}
          accentIcon
        />
        <View style={styles.settingsGroupDivider} />
        <SettingsOptionRow
          label="Batch Count"
          value={String(batchCount)}
          onPress={() => open("batchCount")}
        />
      </View>
    </View>
  );
}

export function ImageSettingsScreen() {
  const insets = useSafeAreaInsets();
  const isSheetOpen = useAppSheetOpen();
  const model = useGenerationStore((state) => state.model);
  const initialTab = useRef(lastViewedTab).current;
  const initialPage = TABS.findIndex((tab) => tab.key === initialTab);
  const [activeTab, setActiveTab] = useState<SettingsTabKey>(initialTab);
  const pagerRef = useRef<PagerView>(null);
  const scrollValues = useRef<Record<SettingsTabKey, Animated.Value>>({
    settings: new Animated.Value(0),
    prompt: new Animated.Value(0),
  }).current;

  useEffect(() => {
    warmPromptTokenizerForModel(model).catch(() => {});
  }, [model]);

  const handleTabChange = useCallback(
    (key: string) => {
      const nextTab = key as SettingsTabKey;
      if (nextTab === activeTab) return;

      const nextIndex = TABS.findIndex((tab) => tab.key === nextTab);
      if (nextIndex < 0) return;

      Keyboard.dismiss();
      pagerRef.current?.setPage(nextIndex);
    },
    [activeTab],
  );

  const handlePageSelected = useCallback((position: number) => {
    const nextTab = TABS[position]?.key as SettingsTabKey | undefined;
    if (!nextTab) return;

    Keyboard.dismiss();
    lastViewedTab = nextTab;
    setActiveTab(nextTab);
  }, []);

  function renderPage(tabKey: SettingsTabKey, children: ReactNode) {
    const pageScrollY = scrollValues[tabKey];

    return (
      <View key={tabKey} collapsable={false} style={styles.pagerPage}>
        <KeyboardAwareScrollView
          bottomOffset={72}
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: insets.top + DETAIL_HEADER_TOP_OFFSET,
              paddingBottom: insets.bottom + 96,
            },
          ]}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: pageScrollY } } }],
            { useNativeDriver: false },
          )}
          scrollEventThrottle={16}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerTitle}>
            <DetailScrollTitle
              title={TITLES[tabKey]}
              scrollY={pageScrollY}
              containerHeight={90}
              navigationSpacerHeight={28}
            />
          </View>
          {children}
        </KeyboardAwareScrollView>
      </View>
    );
  }

  return (
    <SuggestionBarProvider>
      <View style={styles.screen}>
        <StatusBar style="light" />

        <PagerView
          ref={pagerRef}
          initialPage={initialPage}
          offscreenPageLimit={2}
          scrollEnabled={!isSheetOpen}
          onPageSelected={(event) =>
            handlePageSelected(event.nativeEvent.position)
          }
          style={styles.pager}
        >
          {renderPage("settings", <SettingsTabContent />)}
          {renderPage("prompt", <PromptTabContent />)}
        </PagerView>

        <View pointerEvents="none" style={styles.edgeFade}>
          <ScreenEdgeFade
            bottomHeight={insets.bottom + 96}
            color={tokens.color.app}
            transparentColor="rgba(10,10,11,0)"
          />
        </View>

        <DetailHeaderOverlay
          title={TITLES[activeTab]}
          scrollY={scrollValues[activeTab]}
          topInset={insets.top}
          showCompactTitle={false}
        />

        <View
          pointerEvents="box-none"
          style={[
            styles.bottomBar,
            { bottom: insets.bottom + tokens.space[6] },
          ]}
        >
          <SettingsTabBar
            tabs={TABS}
            activeKey={activeTab}
            onChange={handleTabChange}
          />
        </View>

        <KeyboardStickyView
          style={styles.suggestionSticky}
          offset={{ closed: 0, opened: 0 }}
        >
          <SuggestionBar />
        </KeyboardStickyView>
      </View>
    </SuggestionBarProvider>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: tokens.color.app,
  },
  pager: {
    flex: 1,
  },
  pagerPage: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: tokens.space[6],
  },
  headerTitle: {
    paddingHorizontal: tokens.space[2],
  },
  settingsContent: {
    gap: 20,
  },
  settingsGroup: {
    overflow: "hidden",
    borderRadius: tokens.radius.settings,
    backgroundColor: tokens.color.card,
  },
  settingsCard: {
    overflow: "hidden",
    borderRadius: tokens.radius["2xl"],
    backgroundColor: tokens.color.card,
  },
  settingsRow: {
    minHeight: 58,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  settingsRowTapContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  settingsRowLabelGroup: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space[2],
  },
  settingsRowLabel: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.regular,
    fontSize: 17,
    lineHeight: 22,
  },
  settingsRowValue: {
    maxWidth: "48%",
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.regular,
    fontSize: tokens.type.md,
  },
  settingsGroupDivider: {
    height: 1,
    marginHorizontal: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  sectionLabel: {
    marginTop: 4,
    marginBottom: -8,
    paddingHorizontal: 4,
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.bold,
    fontSize: tokens.type.xs,
    letterSpacing: tokens.tracking.wide,
  },
  parameterItem: {
    gap: 10,
  },
  settingsParameterRow: {
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  infoButton: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: tokens.radius.pill,
    borderWidth: 0,
    backgroundColor: tokens.color.raised,
    transform: [{ translateY: 1 }],
    marginLeft: 4,
  },
  infoButtonPressed: {
    opacity: 0.6,
  },
  tooltipModalRoot: {
    flex: 1,
  },
  infoTooltip: {
    position: "absolute",
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.color.borderSubtleStrong,
    backgroundColor: tokens.color.raised,
    ...tokens.shadow.floatSm,
  },
  infoTooltipText: {
    color: tokens.color.textSecondary,
    fontFamily: tokens.font.medium,
    fontSize: tokens.type.sm,
    lineHeight: 20,
    textAlign: "center",
  },
  infoTooltipArrow: {
    position: "absolute",
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
  infoTooltipArrowBottom: {
    bottom: -7,
    borderTopWidth: 7,
    borderTopColor: tokens.color.raised,
  },
  infoTooltipArrowTop: {
    top: -7,
    borderBottomWidth: 7,
    borderBottomColor: tokens.color.raised,
  },
  promptContent: {
    gap: 20,
  },
  promptSettingsContent: {
    gap: 20,
  },
  characterCards: {
    gap: 12,
  },
  emptyCharacterPrompts: {
    minHeight: 160,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: tokens.radius.settings,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: tokens.color.borderSubtleStrong,
    backgroundColor: tokens.color.card,
  },
  emptyCharacterPromptsLabel: {
    color: tokens.color.textMuted,
    fontFamily: tokens.font.medium,
    fontSize: tokens.type.xs,
  },
  emptyCharacterPromptsCount: {
    color: tokens.color.textMuted,
    fontFamily: tokens.font.regular,
    fontSize: tokens.type["2xs"],
  },
  emptyCharacterPromptsPressed: {
    opacity: 0.68,
  },
  addCharacterPromptButton: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.space[4],
    borderRadius: tokens.radius.settings,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: tokens.color.borderSubtleStrong,
    backgroundColor: tokens.color.card,
  },
  addCharacterPromptButtonLabel: {
    color: tokens.color.textSecondary,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type.sm,
  },
  referenceRows: {
    gap: 20,
  },
  edgeFade: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 3,
  },
  suggestionSticky: {
    zIndex: 6,
  },
  bottomBar: {
    position: "absolute",
    left: tokens.space[8],
    right: tokens.space[8],
    zIndex: 4,
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
});
