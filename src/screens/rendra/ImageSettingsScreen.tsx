import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
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
import { RendraIconButton } from "../../components/rendra/RendraButtons";
import { RendraCharacterCard } from "../../components/rendra/RendraCharacterCard";
import { RendraReferenceRow } from "../../components/rendra/RendraReferenceRow";
import { RendraSuggestionBar } from "../../components/rendra/RendraSuggestionBar";
import { ScreenEdgeFade } from "../../components/ScreenEdgeFade";
import {
  RendraParameterSlider,
  RendraPromptField,
  RendraToggle,
} from "../../components/rendra/RendraFormControls";
import {
  RendraOptionCard,
  RendraSettingsRow,
  RendraSettingsTabBar,
  type RendraSettingsTab,
} from "../../components/rendra/RendraSettingsNavigation";
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
import {
  CFG_CONFIG,
  CFG_RESCALE_CONFIG,
  STEPS_CONFIG,
} from "../home/constants";

type SettingsTabKey = "settings" | "prompt" | "character" | "imageRef";

const TABS: readonly RendraSettingsTab[] = [
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
        <RendraOptionCard
          icon="cube-outline"
          label="Model"
          value={modelText}
          onPress={() => open("model")}
        />
        <RendraOptionCard
          icon="scan-outline"
          label="Resolution"
          value={`${resolution.width}x${resolution.height}`}
          onPress={() => open("resolution")}
        />
      </View>

      <RendraSettingsRow
        icon="dice-outline"
        label="Seed"
        value={seedText}
        onPress={() => open("seed")}
      />

      <View style={styles.divider} />
      <Text style={styles.sectionLabel}>PARAMETERS</Text>
      <View style={styles.parameters}>
        <RendraParameterSlider
          label="Steps"
          value={steps}
          min={STEPS_CONFIG.min}
          max={STEPS_CONFIG.max}
          step={STEPS_CONFIG.step}
          precision={STEPS_CONFIG.precision}
          onChange={setSteps}
        />
        <RendraParameterSlider
          label="CFG Scale"
          value={promptGuidance}
          min={CFG_CONFIG.min}
          max={CFG_CONFIG.max}
          step={CFG_CONFIG.step}
          precision={CFG_CONFIG.precision}
          onChange={setPromptGuidance}
        />
        <RendraParameterSlider
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
        <RendraSettingsRow
          icon="shuffle-outline"
          label="Sampler"
          value={samplerText}
          onPress={() => open("sampler")}
        />
        <RendraSettingsRow
          icon="pulse-outline"
          label="Schedule"
          value={scheduleText}
          onPress={() => open("schedule")}
        />
        <RendraSettingsRow
          icon="sparkles-outline"
          label="Variety+"
          trailing={
            <RendraToggle
              value={varietyPlus}
              label="Variety+"
              onChange={setVarietyPlus}
            />
          }
        />
        <RendraSettingsRow
          icon="images-outline"
          label="Batch Count"
          value={String(batchCount)}
          onPress={() => open("rendraBatchCount")}
        />
      </View>
    </>
  );
}

function PromptTabContent() {
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
        <RendraPromptField
          label="Prompt"
          value={prompt}
          placeholder="1girl, ..."
          minHeight={250}
          onCommit={setPrompt}
        />
        <RendraPromptField
          label="Negative Prompt"
          value={negativePrompt}
          placeholder="lowres, bad anatomy, ..."
          minHeight={168}
          negative
          onCommit={setNegativePrompt}
        />
      </View>

      <View style={styles.promptRows}>
        <RendraSettingsRow
          icon="pricetag-outline"
          label="Quality Tags"
          trailing={
            <RendraToggle
              value={qualityToggle}
              label="Quality Tags"
              onChange={setQualityToggle}
            />
          }
        />
        <RendraSettingsRow
          icon="shield-outline"
          label="UC Preset"
          value={getUcPresetLabel(ucPreset)}
          onPress={() => open("ucPreset")}
        />
      </View>
    </>
  );
}

function CharacterTabContent() {
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

  function updateCharacter(
    id: string,
    values: Partial<Omit<CharacterPrompt, "id">>,
  ) {
    const current = useGenerationStore.getState().characterPrompts;
    setCharacterPrompts(
      current.map((item) => (item.id === id ? { ...item, ...values } : item)),
    );
  }

  function toggleExpanded(id: string) {
    const current = useGenerationStore.getState().characterPromptExpandedIds;
    setExpandedIds(
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }

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

  function copyCharacter(id: string) {
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
  }

  function deleteCharacter(id: string) {
    const current = useGenerationStore.getState().characterPrompts;
    setCharacterPrompts(current.filter((item) => item.id !== id));
    setExpandedIds(
      useGenerationStore
        .getState()
        .characterPromptExpandedIds.filter((value) => value !== id),
    );
  }

  const canAdd = characterPrompts.length < MAX_CHARACTER_PROMPTS;

  return (
    <>
      <Text style={styles.characterSectionLabel}>
        캐릭터 ({characterPrompts.length})
      </Text>
      <View style={styles.characterCards}>
        {characterPrompts.map((item, index) => (
          <RendraCharacterCard
            key={item.id}
            item={item}
            index={index}
            expanded={expandedIds.includes(item.id)}
            positionEnabled={positionEnabled}
            canCopy={canAdd}
            canReorder={characterPrompts.length > 1}
            onToggleExpand={() => toggleExpanded(item.id)}
            onUpdate={(values) => updateCharacter(item.id, values)}
            onRename={(name) =>
              updateCharacter(item.id, { name: name || undefined })
            }
            onCopy={() => copyCharacter(item.id)}
            onDelete={() => deleteCharacter(item.id)}
            onOpenOrder={() => open("characterOrder")}
            onOpenPosition={() => openCharacterPosition(item.id)}
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
        <RendraToggle
          value={positionEnabled}
          label="Character Positions"
          onChange={setPositionEnabled}
        />
      </View>
    </>
  );
}

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
      <RendraReferenceRow
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
      <RendraReferenceRow
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
      <RendraReferenceRow
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
      <RendraReferenceRow
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
  const [mountedTabs, setMountedTabs] = useState<
    Record<SettingsTabKey, boolean>
  >({
    settings: true,
    prompt: false,
    character: false,
    imageRef: false,
  });
  const scrollRef = useRef<KeyboardAwareScrollViewRef>(null);
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
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      scrollY.setValue(0);
      setMountedTabs((current) =>
        current[nextTab] ? current : { ...current, [nextTab]: true },
      );
      setActiveTab(nextTab);
    },
    [scrollY],
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
          {mountedTabs.settings ? (
            <View style={activeTab !== "settings" && styles.hiddenTab}>
              <SettingsTabContent />
            </View>
          ) : null}
          {mountedTabs.prompt ? (
            <View style={activeTab !== "prompt" && styles.hiddenTab}>
              <PromptTabContent />
            </View>
          ) : null}
          {mountedTabs.character ? (
            <View style={activeTab !== "character" && styles.hiddenTab}>
              <CharacterTabContent />
            </View>
          ) : null}
          {mountedTabs.imageRef ? (
            <View style={activeTab !== "imageRef" && styles.hiddenTab}>
              <ImageReferenceTabContent />
            </View>
          ) : null}
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
          style={[styles.bottomBar, { bottom: insets.bottom + tokens.space[6] }]}
        >
          <RendraIconButton
            icon="chevron-back"
            label="뒤로"
            size={52}
            style={styles.bottomBackButton}
            onPress={() => router.back()}
          />
          <RendraSettingsTabBar
            tabs={TABS}
            activeKey={activeTab}
            onChange={handleTabChange}
          />
        </View>

        <KeyboardStickyView
          style={styles.suggestionSticky}
          offset={{ closed: 0, opened: 0 }}
        >
          <RendraSuggestionBar />
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
  hiddenTab: {
    display: "none",
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
