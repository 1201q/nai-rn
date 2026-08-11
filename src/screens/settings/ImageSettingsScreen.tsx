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
  Easing,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  KeyboardAwareScrollView,
  KeyboardStickyView,
  type KeyboardAwareScrollViewRef,
} from "react-native-keyboard-controller";

import { useAppSheet } from "../../context/AppSheetContext";
import { SuggestionBarProvider } from "../../context/SuggestionBarContext";
import { CharacterCard } from "../../components/generation/CharacterCard";
import { ReferenceRow } from "../../components/generation/ReferenceRow";
import { SuggestionBar } from "../../components/generation/SuggestionBar";
import { ScreenEdgeFade } from "../../components/common/ScreenEdgeFade";
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

type SettingsTabKey = "settings" | "prompt" | "character";
type TabTransitionDirection = -1 | 0 | 1;

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

const TABS: readonly SettingsTab[] = [
  { key: "settings", label: "설정", icon: "settings-outline" },
  { key: "prompt", label: "프롬프트", icon: "document-text-outline" },
  { key: "character", label: "캐릭터", icon: "person-outline" },
];

const TITLES: Record<SettingsTabKey, string> = {
  settings: "설정",
  prompt: "프롬프트",
  character: "캐릭터",
};

function SettingsTabPane({
  tabKey,
  activeTab,
  transitionDirection,
  children,
}: {
  tabKey: SettingsTabKey;
  activeTab: SettingsTabKey;
  transitionDirection: TabTransitionDirection;
  children: ReactNode;
}) {
  const active = tabKey === activeTab;
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (active) {
      translateX.setValue(transitionDirection * 12);
    }

    const animation = active
      ? Animated.parallel([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 160,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(translateX, {
            toValue: 0,
            duration: 180,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ])
      : Animated.timing(opacity, {
          toValue: 0,
          duration: 0,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        });

    animation.start();
    return () => animation.stop();
  }, [active, opacity, transitionDirection, translateX]);

  return (
    <Animated.View
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? "auto" : "no-hide-descendants"}
      pointerEvents={active ? "auto" : "none"}
      style={[
        styles.tabPane,
        active ? styles.activeTabPane : styles.inactiveTabPane,
        { opacity, transform: [{ translateX }] },
      ]}
    >
      {children}
    </Animated.View>
  );
}

function SettingsOptionRow({
  icon,
  label,
  value,
  onPress,
  trailing,
  accentIcon = false,
}: {
  icon?: IconName;
  label: string;
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
      <Text style={styles.settingsRowLabel}>{label}</Text>
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
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}${value ? `, ${value}` : ""}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.settingsRow,
        pressed && styles.settingsRowPressed,
      ]}
    >
      {content}
    </Pressable>
  );
}

function SettingsTabContent() {
  const { open } = useAppSheet();
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
          onPress={() => open("model")}
          accentIcon
        />
        <View style={styles.settingsGroupDivider} />
        <SettingsOptionRow
          label="Resolution"
          value={`${resolution.width}x${resolution.height}`}
          onPress={() => open("resolution")}
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

      <Text style={styles.sectionLabel}>PARAMETERS</Text>

      <View style={styles.parameterItem}>
        <View style={styles.parameterCard}>
          <ParameterSlider
            label="Steps"
            value={steps}
            min={STEPS_CONFIG.min}
            max={STEPS_CONFIG.max}
            step={STEPS_CONFIG.step}
            precision={STEPS_CONFIG.precision}
            onChange={setSteps}
            settingsCard
          />
        </View>
        <Text style={styles.optionDescription}>
          {OPTION_DESCRIPTIONS.steps}
        </Text>
      </View>

      <View style={styles.parameterItem}>
        <View style={styles.parameterCard}>
          <ParameterSlider
            label="CFG Scale"
            value={promptGuidance}
            min={CFG_CONFIG.min}
            max={CFG_CONFIG.max}
            step={CFG_CONFIG.step}
            precision={CFG_CONFIG.precision}
            onChange={setPromptGuidance}
            settingsCard
          />
        </View>
        <Text style={styles.optionDescription}>
          {OPTION_DESCRIPTIONS.cfgScale}
        </Text>
      </View>

      <View style={styles.parameterItem}>
        <View style={styles.parameterCard}>
          <ParameterSlider
            label="CFG Rescale"
            value={promptGuidanceRescale}
            min={CFG_RESCALE_CONFIG.min}
            max={CFG_RESCALE_CONFIG.max}
            step={CFG_RESCALE_CONFIG.step}
            precision={CFG_RESCALE_CONFIG.precision}
            onChange={setPromptGuidanceRescale}
            settingsCard
          />
        </View>
        <Text style={styles.optionDescription}>
          {OPTION_DESCRIPTIONS.cfgRescale}
        </Text>
      </View>

      <Text style={styles.sectionLabel}>ADVANCED SETTINGS</Text>

      <View style={styles.settingsGroup}>
        <SettingsOptionRow
          label="Sampler"
          value={samplerText}
          onPress={() => open("sampler")}
        />
        <View style={styles.settingsGroupDivider} />
        <SettingsOptionRow
          label="Schedule"
          value={scheduleText}
          onPress={() => open("schedule")}
        />
      </View>

      <View style={styles.parameterItem}>
        <View style={styles.settingsCard}>
          <SettingsOptionRow
            label="Variety+"
            trailing={
              <Toggle
                value={varietyPlus}
                label="Variety+"
                onChange={setVarietyPlus}
              />
            }
          />
        </View>
        <Text style={styles.optionDescription}>
          {OPTION_DESCRIPTIONS.varietyPlus}
        </Text>
      </View>

      <Text style={styles.sectionLabel}>ADVANCED FEATURES</Text>

      <AdvancedFeaturesContent />
    </View>
  );
}

const PromptTabContent = memo(function PromptTabContent() {
  const { open } = useAppSheet();
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

      <Text style={styles.sectionLabel}>PROMPT SETTINGS</Text>

      <View style={styles.parameterItem}>
        <View style={styles.settingsCard}>
          <SettingsOptionRow
            label="Quality Tags"
            trailing={
              <Toggle
                value={qualityToggle}
                label="Quality Tags"
                onChange={setQualityToggle}
              />
            }
          />
        </View>
        <Text style={styles.optionDescription}>
          {OPTION_DESCRIPTIONS.qualityTags}
        </Text>
      </View>

      <View style={styles.settingsCard}>
        <SettingsOptionRow
          label="UC Preset"
          value={getUcPresetLabel(ucPreset)}
          onPress={() => open("ucPreset")}
        />
      </View>
    </View>
  );
});

function addCharacterPrompt() {
  const state = useGenerationStore.getState();
  const current = state.characterPrompts;
  if (current.length >= MAX_CHARACTER_PROMPTS) return;

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
}

const CharacterTabContent = memo(function CharacterTabContent() {
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
  const setPositionEnabled = useGenerationStore(
    (state) => state.setCharacterPositionEnabled,
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
      setCharacterPrompts(next);
      setExpandedIds([
        ...useGenerationStore.getState().characterPromptExpandedIds,
        copiedId,
      ]);
    },
    [setCharacterPrompts, setExpandedIds],
  );

  const deleteCharacter = useCallback(
    (id: string) => {
      const current = useGenerationStore.getState().characterPrompts;
      setCharacterPrompts(current.filter((item) => item.id !== id));
      setExpandedIds(
        useGenerationStore
          .getState()
          .characterPromptExpandedIds.filter((value) => value !== id),
      );
    },
    [setCharacterPrompts, setExpandedIds],
  );

  const openCharacterOrder = useCallback(() => open("characterOrder"), [open]);

  const canAdd = characterPrompts.length < MAX_CHARACTER_PROMPTS;

  return (
    <>
      <View style={styles.characterCards}>
        {characterPrompts.map((item, index) => (
          <CharacterCard
            key={item.id}
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
        ))}
      </View>

      <View style={styles.characterPositionSection}>
        <Text style={styles.characterSectionLabel}>POSITION SETTING</Text>
        <View style={styles.parameterItem}>
          <View style={styles.settingsCard}>
            <SettingsOptionRow
              label="Character Positions"
              trailing={
                <Toggle
                  value={positionEnabled}
                  label="Character Positions"
                  onChange={setPositionEnabled}
                />
              }
            />
          </View>
          <Text style={styles.optionDescription}>
            {OPTION_DESCRIPTIONS.characterPositions}
          </Text>
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
      router.push("/vibe-transfer");
      return;
    }
    setVibeEnabled(value);
  }

  function togglePrecise(value: boolean) {
    if (value && preciseReferences.length === 0) {
      router.push("/precise-reference");
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
          thumbnailUri={sourceImage?.uri}
          onPress={() => router.push("/image-to-image")}
          onToggle={(value) => {
            if (value && !sourceImage) router.push("/image-to-image");
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
          onPress={() => router.push("/vibe-transfer")}
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
          onPress={() => router.push("/precise-reference")}
          onToggle={togglePrecise}
        />
      </View>
      <View style={styles.settingsGroup}>
        <SettingsOptionRow
          label="Metadata Extract"
          onPress={() => router.push("/metadata-extract")}
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
  const router = useRouter();
  const canAddCharacter = useGenerationStore(
    (state) => state.characterPrompts.length < MAX_CHARACTER_PROMPTS,
  );
  const model = useGenerationStore((state) => state.model);
  const [activeTab, setActiveTab] = useState<SettingsTabKey>("settings");
  const [transitionDirection, setTransitionDirection] =
    useState<TabTransitionDirection>(0);
  const [mountedTabs, setMountedTabs] = useState<
    Record<SettingsTabKey, boolean>
  >({
    settings: true,
    prompt: false,
    character: false,
  });
  const scrollRef = useRef<KeyboardAwareScrollViewRef>(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    warmPromptTokenizerForModel(model).catch(() => {});
  }, [model]);

  const handleTabChange = useCallback(
    (key: string) => {
      const nextTab = key as SettingsTabKey;
      if (nextTab === activeTab) return;

      const currentIndex = TABS.findIndex((tab) => tab.key === activeTab);
      const nextIndex = TABS.findIndex((tab) => tab.key === nextTab);
      setTransitionDirection(nextIndex > currentIndex ? 1 : -1);
      Keyboard.dismiss();
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      scrollY.setValue(0);

      setMountedTabs((current) =>
        current[nextTab] ? current : { ...current, [nextTab]: true },
      );
      setActiveTab(nextTab);
    },
    [activeTab, scrollY],
  );

  return (
    <SuggestionBarProvider>
      <View style={styles.screen}>
        <StatusBar style="light" />

        <KeyboardAwareScrollView
          ref={scrollRef}
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
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false },
          )}
          scrollEventThrottle={16}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerTitle}>
            <DetailScrollTitle
              title={TITLES[activeTab]}
              scrollY={scrollY}
              containerHeight={90}
              navigationSpacerHeight={28}
            />
          </View>
          <View style={styles.tabHost}>
            {mountedTabs.settings ? (
              <SettingsTabPane
                tabKey="settings"
                activeTab={activeTab}
                transitionDirection={transitionDirection}
              >
                <SettingsTabContent />
              </SettingsTabPane>
            ) : null}
            {mountedTabs.prompt ? (
              <SettingsTabPane
                tabKey="prompt"
                activeTab={activeTab}
                transitionDirection={transitionDirection}
              >
                <PromptTabContent />
              </SettingsTabPane>
            ) : null}
            {mountedTabs.character ? (
              <SettingsTabPane
                tabKey="character"
                activeTab={activeTab}
                transitionDirection={transitionDirection}
              >
                <CharacterTabContent />
              </SettingsTabPane>
            ) : null}
          </View>
        </KeyboardAwareScrollView>

        <View pointerEvents="none" style={styles.edgeFade}>
          <ScreenEdgeFade
            bottomHeight={insets.bottom + 96}
            color={tokens.color.app}
            transparentColor="rgba(10,10,11,0)"
          />
        </View>

        <DetailHeaderOverlay
          title={TITLES[activeTab]}
          scrollY={scrollY}
          topInset={insets.top}
          onAdd={activeTab === "character" ? addCharacterPrompt : undefined}
          addLabel="캐릭터 추가"
          addDisabled={!canAddCharacter}
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
            onBack={() => router.back()}
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
  tabHost: {
    position: "relative",
  },
  tabPane: {
    width: "100%",
  },
  activeTabPane: {
    position: "relative",
    zIndex: 1,
  },
  inactiveTabPane: {
    position: "absolute",
    top: 0,
    right: 0,
    left: 0,
    zIndex: 0,
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
  settingsRowLabel: {
    flex: 1,
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
  settingsRowPressed: {
    opacity: 0.65,
  },
  settingsGroupDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 18,
    backgroundColor: tokens.color.borderSubtle,
  },
  sectionLabel: {
    marginTop: 4,
    marginBottom: -8,
    paddingHorizontal: 4,
    color: tokens.color.textMuted,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type["3xs"],
    letterSpacing: tokens.tracking.wide,
  },
  parameterItem: {
    gap: 10,
  },
  parameterCard: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: tokens.radius.settings,
    backgroundColor: tokens.color.card,
  },
  optionDescription: {
    paddingHorizontal: 6,
    color: tokens.color.textMuted,
    fontFamily: tokens.font.regular,
    fontSize: tokens.type["2xs"],
    lineHeight: 18,
  },
  promptContent: {
    gap: 20,
  },
  characterSectionLabel: {
    marginBottom: 12,
    paddingHorizontal: 4,
    color: tokens.color.textMuted,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type["3xs"],
    letterSpacing: tokens.tracking.wide,
  },
  characterCards: {
    gap: 12,
  },
  characterPositionSection: {
    marginTop: 20,
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
  },
});
