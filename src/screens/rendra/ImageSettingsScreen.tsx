import { useCallback, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RendraIconButton } from "../../components/rendra/RendraButtons";
import { ScreenEdgeFade } from "../../components/ScreenEdgeFade";
import {
  RendraParameterSlider,
  RendraToggle,
} from "../../components/rendra/RendraFormControls";
import {
  RendraOptionCard,
  RendraSettingsRow,
  RendraSettingsTabBar,
  type RendraSettingsTab,
} from "../../components/rendra/RendraSettingsNavigation";
import {
  MODELS,
  NOISE_SCHEDULES,
  SAMPLERS,
} from "../../constants/generation";
import { useGenerationStore } from "../../store/generationStore";
import { tokens } from "../../styles/tokens";
import type { OptionRoute } from "../home/OptionsSheet";
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

function SettingsTabContent({
  openDetail,
}: {
  openDetail: (route: OptionRoute) => void;
}) {
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
  const seedText = seedLocked ? seed.toLocaleString() : "Random";

  return (
    <>
      <View style={styles.optionCards}>
        <RendraOptionCard
          icon="cube-outline"
          label="Model"
          value={modelText}
          onPress={() => openDetail("model")}
        />
        <RendraOptionCard
          icon="scan-outline"
          label="Resolution"
          value={`${resolution.width}x${resolution.height}`}
          onPress={() => openDetail("resolution")}
        />
      </View>

      <RendraSettingsRow
        icon="dice-outline"
        label="Seed"
        value={seedText}
        onPress={() => openDetail("seed")}
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
          onPress={() => openDetail("sampler")}
        />
        <RendraSettingsRow
          icon="pulse-outline"
          label="Schedule"
          value={scheduleText}
          onPress={() => openDetail("schedule")}
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
      </View>
    </>
  );
}

export function ImageSettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<SettingsTabKey>("settings");
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

  const openDetail = useCallback(
    (route: OptionRoute) => {
      router.push({ pathname: "/option-detail", params: { route } });
    },
    [router],
  );

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      <Animated.ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 18,
            paddingBottom: insets.bottom + 360,
          },
        ]}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.header, { opacity: titleOpacity }]}>
          <Text style={styles.title}>{TITLES[activeTab]}</Text>
        </Animated.View>
        {activeTab === "settings" ? (
          <SettingsTabContent openDetail={openDetail} />
        ) : null}
      </Animated.ScrollView>

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

      <View
        pointerEvents="box-none"
        style={[styles.bottomBar, { bottom: insets.bottom + 19 }]}
      >
        <RendraIconButton
          icon="chevron-back"
          label="뒤로"
          size={48}
          onPress={() => router.back()}
        />
        <RendraSettingsTabBar
          tabs={TABS}
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as SettingsTabKey)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: tokens.color.app,
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
    paddingHorizontal: tokens.space[10],
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
    fontFamily: tokens.font.bold,
    fontSize: tokens.type["3xs"],
    letterSpacing: tokens.tracking.wide,
  },
  parameters: {
    gap: 24,
  },
  selectionRows: {
    marginTop: 18,
  },
  edgeFade: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 3,
  },
  bottomBar: {
    position: "absolute",
    left: tokens.space[10],
    right: tokens.space[10],
    zIndex: 4,
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space[5],
  },
});
