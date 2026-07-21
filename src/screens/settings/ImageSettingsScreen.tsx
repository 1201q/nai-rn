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
  type LayoutChangeEvent,
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
import { IconButton } from "../../components/common/Buttons";
import { CharacterCard } from "../../components/generation/CharacterCard";
import { ReferenceRow } from "../../components/generation/ReferenceRow";
import { SuggestionBar } from "../../components/generation/SuggestionBar";
import { ScreenEdgeFade } from "../../components/common/ScreenEdgeFade";
import {
  ParameterSlider,
  PromptField,
  Toggle,
} from "../../components/forms/FormControls";
import {
  OptionCard,
  SettingsRow,
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

type SettingsTabKey = "settings" | "prompt" | "character" | "imageRef";
type TabTransitionDirection = -1 | 0 | 1;

const STEPS_CONFIG = { min: 1, max: 50, step: 1, precision: 0 } as const;
const CFG_CONFIG = { min: 0, max: 10, step: 0.1, precision: 1 } as const;
const CFG_RESCALE_CONFIG = {
  min: 0,
  max: 1,
  step: 0.02,
  precision: 2,
} as const;

const TABS: readonly SettingsTab[] = [
  { key: "settings", label: "설정", icon: "settings-outline" },
  { key: "prompt", label: "프롬프트", icon: "document-text-outline" },
  { key: "character", label: "캐릭터", icon: "person-outline" },
  { key: "imageRef", label: "이미지 참조", icon: "image-outline" },
];

const TITLES: Record<SettingsTabKey, string> = {
  settings: "설정",
  prompt: "프롬프트",
  character: "캐릭터",
  imageRef: "이미지 참조",
};

function SettingsTabPane({
  tabKey,
  activeTab,
  transitionDirection,
  onLayout,
  children,
}: {
  tabKey: SettingsTabKey;
  activeTab: SettingsTabKey;
  transitionDirection: TabTransitionDirection;
  onLayout: (key: SettingsTabKey, event: LayoutChangeEvent) => void;
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
      onLayout={(event) => onLayout(tabKey, event)}
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
  const batchCount = useGenerationStore((state) => state.batchCount);

  const modelText = MODELS.find((item) => item.value === model)?.label ?? model;
  const samplerText =
    SAMPLERS.find((item) => item.value === sampler)?.label ?? sampler;
  const scheduleText =
    NOISE_SCHEDULES.find((item) => item.value === noiseSchedule)?.label ??
    noiseSchedule;
  const seedText = seedLocked ? String(seed) : "Random";

  return (
    <>
      <View style={styles.optionCards}>
        <OptionCard
          icon="cube-outline"
          label="Model"
          value={modelText}
          onPress={() => open("model")}
        />
        <OptionCard
          icon="scan-outline"
          label="Resolution"
          value={`${resolution.width}x${resolution.height}`}
          onPress={() => open("resolution")}
        />
      </View>

      <SettingsRow
        icon="dice-outline"
        label="Seed"
        value={seedText}
        onPress={() => open("seed")}
      />

      <View style={styles.divider} />
      <Text style={styles.sectionLabel}>PARAMETERS</Text>
      <View style={styles.parameters}>
        <ParameterSlider
          label="Steps"
          value={steps}
          min={STEPS_CONFIG.min}
          max={STEPS_CONFIG.max}
          step={STEPS_CONFIG.step}
          precision={STEPS_CONFIG.precision}
          onChange={setSteps}
        />
        <ParameterSlider
          label="CFG Scale"
          value={promptGuidance}
          min={CFG_CONFIG.min}
          max={CFG_CONFIG.max}
          step={CFG_CONFIG.step}
          precision={CFG_CONFIG.precision}
          onChange={setPromptGuidance}
        />
        <ParameterSlider
          label="CFG Rescale"
          value={promptGuidanceRescale}
          min={CFG_RESCALE_CONFIG.min}
          max={CFG_RESCALE_CONFIG.max}
          step={CFG_RESCALE_CONFIG.step}
          precision={CFG_RESCALE_CONFIG.precision}
          onChange={setPromptGuidanceRescale}
        />
      </View>

      <View style={styles.selectionRows}>
        <SettingsRow
          icon="shuffle-outline"
          label="Sampler"
          value={samplerText}
          onPress={() => open("sampler")}
        />
        <SettingsRow
          icon="pulse-outline"
          label="Schedule"
          value={scheduleText}
          onPress={() => open("schedule")}
        />
        <SettingsRow
          icon="sparkles-outline"
          label="Variety+"
          trailing={
            <Toggle
              value={varietyPlus}
              label="Variety+"
              onChange={setVarietyPlus}
            />
          }
        />
        <SettingsRow
          icon="images-outline"
          label="Batch Count"
          value={String(batchCount)}
          onPress={() => open("batchCount")}
        />
      </View>
    </>
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
    <>
      <View style={styles.promptFields}>
        <PromptField
          label="Prompt"
          value={prompt}
          placeholder="1girl, ..."
          minHeight={250}
          onCommit={setPrompt}
        />
        <PromptField
          label="Negative Prompt"
          value={negativePrompt}
          placeholder="lowres, bad anatomy, ..."
          minHeight={168}
          negative
          onCommit={setNegativePrompt}
        />
      </View>

      <View style={styles.promptRows}>
        <SettingsRow
          icon="pricetag-outline"
          label="Quality Tags"
          trailing={
            <Toggle
              value={qualityToggle}
              label="Quality Tags"
              onChange={setQualityToggle}
            />
          }
        />
        <SettingsRow
          icon="shield-outline"
          label="UC Preset"
          value={getUcPresetLabel(ucPreset)}
          onPress={() => open("ucPreset")}
        />
      </View>
    </>
  );
});

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

  function addCharacter() {
    const current = useGenerationStore.getState().characterPrompts;
    if (current.length >= MAX_CHARACTER_PROMPTS) return;
    const id = `character-${Date.now()}-${current.length}`;
    const next: CharacterPrompt = {
      id,
      prompt: "",
      negativePrompt: "",
      enabled: true,
      position: { x: 0.5, y: 0.5 },
    };
    setCharacterPrompts([...current, next]);
    setExpandedIds([
      ...useGenerationStore.getState().characterPromptExpandedIds,
      id,
    ]);
  }

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
      <Text style={styles.characterSectionLabel}>
        캐릭터 ({characterPrompts.length})
      </Text>
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

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`캐릭터 추가, ${characterPrompts.length}/${MAX_CHARACTER_PROMPTS}`}
        accessibilityState={{ disabled: !canAdd }}
        disabled={!canAdd}
        onPress={addCharacter}
        style={({ pressed }) => [
          styles.addCharacterButton,
          characterPrompts.length === 0 &&
            styles.addCharacterButtonWithoutCards,
          !canAdd && styles.addCharacterButtonDisabled,
          pressed && styles.controlPressed,
        ]}
      >
        <Ionicons name="add" size={18} color={tokens.color.textPrimary} />
        <Text style={styles.addCharacterText}>
          Add Character ({characterPrompts.length}/{MAX_CHARACTER_PROMPTS})
        </Text>
      </Pressable>

      <View style={styles.characterPositionRow}>
        <Ionicons
          name="location-outline"
          size={19}
          color={tokens.color.textTertiary}
        />
        <Text style={styles.characterPositionLabel}>Character Positions</Text>
        <Toggle
          value={positionEnabled}
          label="Character Positions"
          onChange={setPositionEnabled}
        />
      </View>
    </>
  );
});

function ImageReferenceTabContent() {
  const router = useRouter();
  const sourceImage = useGenerationStore((state) => state.i2iSourceImage);
  const i2iEnabled = useGenerationStore((state) => state.i2iEnabled);
  const i2iStrength = useGenerationStore((state) => state.i2iStrength);
  const i2iNoise = useGenerationStore((state) => state.i2iNoise);
  const setI2IEnabled = useGenerationStore((state) => state.setI2IEnabled);
  const vibeReferences = useGenerationStore((state) => state.vibeReferences);
  const setVibeEnabled = useGenerationStore(
    (state) => state.setVibeReferenceEnabled,
  );
  const preciseReferences = useGenerationStore(
    (state) => state.preciseReferences,
  );
  const setPreciseEnabled = useGenerationStore(
    (state) => state.setPreciseReferenceEnabled,
  );

  const vibeEnabled = vibeReferences.some((item) => item.enabled);
  const preciseEnabled = preciseReferences.some((item) => item.enabled);

  function toggleVibe(value: boolean) {
    if (value && vibeReferences.length === 0) {
      router.push("/vibe-transfer");
      return;
    }
    vibeReferences.forEach((item) => {
      if (item.enabled !== value) setVibeEnabled(item.id, value);
    });
  }

  function togglePrecise(value: boolean) {
    if (value && preciseReferences.length === 0) {
      router.push("/precise-reference");
      return;
    }
    preciseReferences.forEach((item) => {
      if (item.enabled !== value) setPreciseEnabled(item.id, value);
    });
  }

  return (
    <View style={styles.referenceRows}>
      <ReferenceRow
        icon="image-outline"
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
      <ReferenceRow
        icon="color-palette-outline"
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
      <ReferenceRow
        icon="person-outline"
        label="Precise Reference"
        enabled={preciseEnabled}
        stateLabel={
          vibeEnabled ? "Vibe Transfer와 동시에 켤 수 없습니다." : undefined
        }
        toggleDisabled={vibeEnabled}
        onPress={() => router.push("/precise-reference")}
        onToggle={togglePrecise}
      />
      <ReferenceRow
        icon="scan-outline"
        label="Metadata Extract"
        onPress={() => router.push("/metadata-extract")}
      />
    </View>
  );
}

export function ImageSettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<SettingsTabKey>("settings");
  const [transitionDirection, setTransitionDirection] =
    useState<TabTransitionDirection>(0);
  const [mountedTabs, setMountedTabs] = useState<
    Record<SettingsTabKey, boolean>
  >({
    settings: true,
    prompt: false,
    character: false,
    imageRef: false,
  });
  const [tabHeights, setTabHeights] = useState<
    Partial<Record<SettingsTabKey, number>>
  >({});
  const scrollRef = useRef<KeyboardAwareScrollViewRef>(null);
  const pendingMountFrameRef = useRef<number | null>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const titleOpacity = scrollY.interpolate({
    inputRange: [0, 56],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });
  const topFadeOpacity = scrollY.interpolate({
    inputRange: [0, 24],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

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

      if (pendingMountFrameRef.current !== null) {
        cancelAnimationFrame(pendingMountFrameRef.current);
        pendingMountFrameRef.current = null;
      }

      setActiveTab(nextTab);

      if (!mountedTabs[nextTab]) {
        pendingMountFrameRef.current = requestAnimationFrame(() => {
          pendingMountFrameRef.current = null;
          setMountedTabs((current) =>
            current[nextTab] ? current : { ...current, [nextTab]: true },
          );
        });
      }
    },
    [activeTab, mountedTabs, scrollY],
  );

  useEffect(
    () => () => {
      if (pendingMountFrameRef.current !== null) {
        cancelAnimationFrame(pendingMountFrameRef.current);
      }
    },
    [],
  );

  const handleTabLayout = useCallback(
    (key: SettingsTabKey, event: LayoutChangeEvent) => {
      const height = event.nativeEvent.layout.height;
      setTabHeights((current) =>
        current[key] === height ? current : { ...current, [key]: height },
      );
    },
    [],
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
              paddingTop: insets.top + 18,
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
          <Animated.View style={[styles.header, { opacity: titleOpacity }]}>
            <Text style={styles.title}>{TITLES[activeTab]}</Text>
          </Animated.View>
          <View
            style={[
              styles.tabHost,
              {
                height: tabHeights[activeTab] ?? tabHeights.settings ?? 1,
              },
            ]}
          >
            {mountedTabs.settings ? (
              <SettingsTabPane
                tabKey="settings"
                activeTab={activeTab}
                transitionDirection={transitionDirection}
                onLayout={handleTabLayout}
              >
                <SettingsTabContent />
              </SettingsTabPane>
            ) : null}
            {mountedTabs.prompt ? (
              <SettingsTabPane
                tabKey="prompt"
                activeTab={activeTab}
                transitionDirection={transitionDirection}
                onLayout={handleTabLayout}
              >
                <PromptTabContent />
              </SettingsTabPane>
            ) : null}
            {mountedTabs.character ? (
              <SettingsTabPane
                tabKey="character"
                activeTab={activeTab}
                transitionDirection={transitionDirection}
                onLayout={handleTabLayout}
              >
                <CharacterTabContent />
              </SettingsTabPane>
            ) : null}
            {mountedTabs.imageRef ? (
              <SettingsTabPane
                tabKey="imageRef"
                activeTab={activeTab}
                transitionDirection={transitionDirection}
                onLayout={handleTabLayout}
              >
                <ImageReferenceTabContent />
              </SettingsTabPane>
            ) : null}
          </View>
        </KeyboardAwareScrollView>

        <Animated.View
          pointerEvents="none"
          style={[styles.edgeFade, { opacity: topFadeOpacity }]}
        >
          <ScreenEdgeFade
            topHeight={insets.top + 56}
            color={tokens.color.app}
            transparentColor="rgba(10,10,11,0)"
          />
        </Animated.View>

        <View pointerEvents="none" style={styles.edgeFade}>
          <ScreenEdgeFade
            bottomHeight={insets.bottom + 96}
            color={tokens.color.app}
            transparentColor="rgba(10,10,11,0)"
          />
        </View>

        <View
          pointerEvents="box-none"
          style={[
            styles.bottomBar,
            { bottom: insets.bottom + tokens.space[6] },
          ]}
        >
          <IconButton
            icon="chevron-back"
            label="뒤로"
            size={52}
            style={styles.bottomBackButton}
            onPress={() => router.back()}
          />
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
  tabHost: {
    position: "relative",
  },
  tabPane: {
    position: "absolute",
    top: 0,
    right: 0,
    left: 0,
  },
  activeTabPane: {
    zIndex: 1,
  },
  inactiveTabPane: {
    zIndex: 0,
  },
  header: {
    height: 58,
    marginBottom: tokens.space[8],
    justifyContent: "center",
  },
  title: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.bold,
    fontSize: tokens.type["2xl"],
    letterSpacing: tokens.tracking.tight,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: tokens.space[8],
  },
  optionCards: {
    flexDirection: "row",
    gap: tokens.space[6],
    marginBottom: 14,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 4,
    marginTop: 8,
    marginBottom: 24,
    backgroundColor: tokens.color.borderSubtle,
  },
  sectionLabel: {
    marginBottom: 16,
    color: tokens.color.textMuted,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type["3xs"],
    letterSpacing: tokens.tracking.wide,
  },
  parameters: {
    gap: 24,
  },
  selectionRows: {
    marginTop: 18,
  },
  promptFields: {
    gap: 28,
  },
  promptRows: {
    marginTop: 20,
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
  addCharacterButton: {
    height: 54,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    backgroundColor: tokens.color.card,
  },
  addCharacterButtonWithoutCards: {
    marginTop: 0,
  },
  addCharacterButtonDisabled: {
    opacity: 0.4,
  },
  addCharacterText: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.medium,
    fontSize: tokens.type.sm,
  },
  characterPositionRow: {
    minHeight: 64,
    marginTop: 10,
    paddingHorizontal: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  characterPositionLabel: {
    flex: 1,
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.medium,
    fontSize: tokens.type.md,
  },
  referenceRows: {
    gap: 12,
  },
  controlPressed: {
    opacity: 0.65,
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
    left: tokens.space[6],
    right: tokens.space[6],
    zIndex: 4,
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space[5],
  },
  bottomBackButton: {
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    backgroundColor: tokens.color.card,
  },
});
