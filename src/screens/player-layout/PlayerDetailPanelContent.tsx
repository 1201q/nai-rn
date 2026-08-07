import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Reanimated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { PrimaryButton } from "../../components/common/Buttons";
import {
  ParameterSlider,
  Toggle,
} from "../../components/forms/FormControls";
import type {
  RegisterSheetDraft,
  SheetDraftController,
} from "../../components/sheets/SheetDraft";
import { MODELS, NOISE_SCHEDULES, SAMPLERS } from "../../constants/generation";
import { useGenerationStore } from "../../store/generationStore";
import { monoFont, tokens } from "../../styles/tokens";
import {
  PlayerSettingDetailContent,
  type PlayerPanelDetail,
} from "./PlayerSettingDetailContent";
import { playerLayoutTokens as theme } from "./playerLayoutTokens";

export type { PlayerPanelDetail } from "./PlayerSettingDetailContent";

export type PlayerPanelTab =
  | "prompt"
  | "settings"
  | "character"
  | "imageRef";
type IconName = keyof typeof Ionicons.glyphMap;

const PANEL_CONTENT_EASING = Easing.bezier(...theme.motion.easing);
const STEPS_CONFIG = { min: 1, max: 50, step: 1, precision: 0 } as const;
const GUIDANCE_CONFIG = { min: 0, max: 10, step: 0.1, precision: 1 } as const;
const GUIDANCE_RESCALE_CONFIG = {
  min: 0,
  max: 1,
  step: 0.02,
  precision: 2,
} as const;
const OPTION_DESCRIPTIONS = {
  steps:
    "이미지를 정제하는 반복 횟수입니다. 낮으면 빠르게 구도를 시험할 수 있고, 높으면 시간과 비용이 늘지만 항상 더 좋아지지는 않습니다. Opus 티어의 무료 일반 생성 상한은 28입니다.",
  guidance:
    "프롬프트를 따르는 강도입니다. 낮으면 더 자유롭고 부드러우며, 높으면 지시와 세부 표현이 강해집니다. 너무 높으면 색과 형태가 과해질 수 있습니다.",
  guidanceRescale:
    "높은 CFG에서 색이 지나치게 진하거나 경계가 거칠어질 때 완화합니다. 평소에는 0으로 두고 문제가 보일 때 조금씩 올려보세요.",
  varietyPlus:
    "초기 구도 단계의 프롬프트 제약을 줄여 포즈와 배경의 다양성을 높입니다. 세부 단계에서는 다시 프롬프트를 따르지만, UC도 늦게 적용된다는 점에 유의하세요.",
} as const;

const PANEL_TABS: ReadonlyArray<{
  id: PlayerPanelTab;
  label: string;
  icon: IconName;
}> = [
  { id: "prompt", label: "프롬프트", icon: "document-text-outline" },
  { id: "settings", label: "설정", icon: "settings-outline" },
  { id: "character", label: "캐릭터", icon: "person-outline" },
  { id: "imageRef", label: "고급 기능", icon: "options-outline" },
];

function PanelSwitch({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      hitSlop={8}
      onPress={() => onChange(!value)}
      style={[styles.switchTrack, value && styles.switchTrackActive]}
    >
      <View style={[styles.switchThumb, value && styles.switchThumbActive]} />
    </Pressable>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

function SettingsRow({
  icon,
  label,
  value,
  trailing,
  accentIcon = false,
  minHeight = 56,
  onPress,
}: {
  icon: IconName;
  label: string;
  value?: string;
  trailing?: ReactNode;
  accentIcon?: boolean;
  minHeight?: number;
  onPress?: () => void;
}) {
  const content = (
    <>
      <Ionicons
        name={icon}
        size={19}
        color={accentIcon ? theme.color.accent : theme.color.textTertiary}
      />
      <Text style={styles.rowLabel}>{label}</Text>
      {value ? (
        <Text numberOfLines={1} style={styles.rowValue}>
          {value}
        </Text>
      ) : null}
      {trailing ?? (
        <Ionicons
          name="chevron-forward"
          size={16}
          color={theme.color.textMuted}
        />
      )}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={({ pressed }) => [
          styles.settingsRow,
          { minHeight },
          pressed && styles.pressed,
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={[styles.settingsRow, { minHeight }]}>{content}</View>;
}

function SettingsGroup({ children }: { children: ReactNode }) {
  const items = Array.isArray(children) ? children : [children];

  return (
    <View style={styles.settingsGroup}>
      {items.map((item, index) => (
        <View key={index}>
          {index > 0 ? <View style={styles.groupDivider} /> : null}
          {item}
        </View>
      ))}
    </View>
  );
}

function ParameterItem({
  label,
  value,
  config,
  description,
  onChange,
}: {
  label: string;
  value: number;
  config: {
    min: number;
    max: number;
    step: number;
    precision: number;
  };
  description: string;
  onChange: (value: number) => void;
}) {
  return (
    <View style={styles.parameterItem}>
      <View style={styles.parameterCard}>
        <ParameterSlider
          label={label}
          value={value}
          min={config.min}
          max={config.max}
          step={config.step}
          precision={config.precision}
          onChange={onChange}
          settingsCard
        />
      </View>
      <Text style={styles.optionDescription}>{description}</Text>
    </View>
  );
}

function PromptContent() {
  const [mode, setMode] = useState<"base" | "negative">("base");
  const [qualityTags, setQualityTags] = useState(true);
  const negative = mode === "negative";

  return (
    <View style={styles.contentStack}>
      <View
        style={[styles.promptCard, negative && styles.promptCardNegative]}
      >
        <Text style={styles.promptText}>
          {negative
            ? "lowres, bad anatomy, bad hands, text, error, missing finger, extra digits, worst quality, jpeg artifacts, watermark, signature"
            : "1girl, solo, silver hair, long braid, translucent raincoat, looking at viewer, soft smile, cinematic lighting, detailed eyes, soft shadows, masterpiece"}
        </Text>
        <View style={styles.promptModeRow}>
          <View style={styles.promptModeControl}>
            {(["base", "negative"] as const).map((item) => {
              const active = mode === item;
              return (
                <Pressable
                  key={item}
                  accessibilityRole="radio"
                  accessibilityLabel={item === "base" ? "Base" : "Negative"}
                  accessibilityState={{ selected: active }}
                  onPress={() => setMode(item)}
                  style={[
                    styles.promptModeButton,
                    item === "base"
                      ? styles.promptModeBaseButton
                      : styles.promptModeNegativeButton,
                    active && styles.promptModeButtonActive,
                    active && negative && styles.promptModeNegativeActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.promptModeLabel,
                      active && styles.promptModeLabelActive,
                      active && negative && styles.promptModeNegativeLabelActive,
                    ]}
                  >
                    {item === "base" ? "Base" : "Negative"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.tokenCount}>
            {negative ? "38 / 225" : "142 / 225"}
          </Text>
        </View>
      </View>

      <SettingsGroup>
        <SettingsRow
          icon="pricetag-outline"
          label="Quality Tags"
          trailing={
            <PanelSwitch
              label="Quality Tags"
              value={qualityTags}
              onChange={setQualityTags}
            />
          }
        />
        <SettingsRow icon="shield-outline" label="UC Preset" value="Heavy" />
      </SettingsGroup>
    </View>
  );
}

function SettingsContent({
  onOpenDetail,
}: {
  onOpenDetail: (detail: PlayerPanelDetail) => void;
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

  return (
    <View>
      <SettingsGroup>
        <SettingsRow
          icon="cube-outline"
          label="Model"
          value={modelText}
          accentIcon
          onPress={() => onOpenDetail("model")}
        />
        <SettingsRow
          icon="scan-outline"
          label="Resolution"
          value={`${resolution.width} x ${resolution.height}`}
          accentIcon
          onPress={() => onOpenDetail("resolution")}
        />
      </SettingsGroup>

      <View style={styles.settingsBlockGap}>
        <SettingsGroup>
          <SettingsRow
            icon="dice-outline"
            label="Seed"
            value={seedLocked ? String(seed) : "Random"}
            onPress={() => onOpenDetail("seed")}
          />
        </SettingsGroup>
      </View>

      <SectionLabel>PARAMETERS</SectionLabel>
      <View style={styles.parameterStack}>
        <ParameterItem
          label="Steps"
          value={steps}
          config={STEPS_CONFIG}
          description={OPTION_DESCRIPTIONS.steps}
          onChange={setSteps}
        />
        <ParameterItem
          label="Guidance"
          value={promptGuidance}
          config={GUIDANCE_CONFIG}
          description={OPTION_DESCRIPTIONS.guidance}
          onChange={setPromptGuidance}
        />
        <ParameterItem
          label="Guidance Rescale"
          value={promptGuidanceRescale}
          config={GUIDANCE_RESCALE_CONFIG}
          description={OPTION_DESCRIPTIONS.guidanceRescale}
          onChange={setPromptGuidanceRescale}
        />
      </View>

      <SectionLabel>ADVANCED SETTINGS</SectionLabel>
      <SettingsGroup>
        <SettingsRow
          icon="shuffle-outline"
          label="Sampler"
          value={samplerText}
          onPress={() => onOpenDetail("sampler")}
        />
        <SettingsRow
          icon="pulse-outline"
          label="Schedule"
          value={scheduleText}
          onPress={() => onOpenDetail("schedule")}
        />
      </SettingsGroup>
      <View style={styles.settingsBlockGap}>
        <View style={styles.parameterItem}>
          <SettingsGroup>
            <SettingsRow
              icon="sparkles-outline"
              label="Variety+"
              trailing={
                <Toggle
                  label="Variety+"
                  value={varietyPlus}
                  onChange={setVarietyPlus}
                />
              }
            />
          </SettingsGroup>
          <Text style={styles.optionDescription}>
            {OPTION_DESCRIPTIONS.varietyPlus}
          </Text>
        </View>
      </View>
    </View>
  );
}

function CharacterCard({
  index,
  name,
  color,
  positionsEnabled,
  initiallyExpanded,
  prompt,
  negativePrompt,
}: {
  index: number;
  name: string;
  color: string;
  positionsEnabled: boolean;
  initiallyExpanded: boolean;
  prompt: string;
  negativePrompt: string;
}) {
  const [enabled, setEnabled] = useState(true);
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const [mode, setMode] = useState<"base" | "negative">("base");
  const negative = mode === "negative";
  const shownPrompt = negative ? negativePrompt : prompt;
  const count = shownPrompt.split(",").length;

  return (
    <View
      style={[
        styles.characterCard,
        negative && styles.characterCardNegative,
        !enabled && styles.characterCardDisabled,
      ]}
    >
      <View style={styles.characterHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${name} ${expanded ? "접기" : "펼치기"}`}
          accessibilityState={{ expanded }}
          onPress={() => setExpanded(!expanded)}
          style={({ pressed }) => [
            styles.characterHeaderMain,
            pressed && styles.pressed,
          ]}
        >
          <View
            style={[
              styles.characterBadge,
              {
                backgroundColor: positionsEnabled ? color : theme.color.raised,
              },
            ]}
          >
            <Text
              style={[
                styles.characterBadgeText,
                !positionsEnabled && styles.characterBadgeTextInactive,
              ]}
            >
              {index}
            </Text>
          </View>
          <View style={styles.characterCopy}>
            <Text numberOfLines={1} style={styles.characterTitle}>
              {name}
            </Text>
            <Text style={styles.characterMeta}>
              {positionsEnabled
                ? `X ${index === 1 ? "0.33" : "0.66"} · Y 0.50`
                : "위치 미지정"}
            </Text>
          </View>
        </Pressable>
        <View style={styles.characterSwitchHitbox}>
          <PanelSwitch
            label={`${name} 활성화`}
            value={enabled}
            onChange={setEnabled}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${name} ${expanded ? "접기" : "펼치기"}`}
          onPress={() => setExpanded(!expanded)}
          style={({ pressed }) => [
            styles.characterChevron,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={18}
            color={theme.color.textMuted}
          />
        </Pressable>
      </View>
      {expanded ? (
        <View style={styles.characterEditor}>
          <Text style={styles.characterPrompt}>{shownPrompt}</Text>
          <View style={styles.promptModeRow}>
            <View style={styles.promptModeControl}>
              {(["base", "negative"] as const).map((item) => {
                const active = mode === item;
                return (
                  <Pressable
                    key={item}
                    accessibilityRole="radio"
                    accessibilityLabel={item === "base" ? "Base" : "Negative"}
                    accessibilityState={{ selected: active }}
                    onPress={() => setMode(item)}
                    style={[
                      styles.promptModeButton,
                      item === "base"
                        ? styles.promptModeBaseButton
                        : styles.promptModeNegativeButton,
                      active && styles.promptModeButtonActive,
                      active && negative && styles.promptModeNegativeActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.promptModeLabel,
                        active && styles.promptModeLabelActive,
                        active && negative && styles.promptModeNegativeLabelActive,
                      ]}
                    >
                      {item === "base" ? "Base" : "Negative"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.tokenCount}>{count} tags</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function CharacterContent() {
  const [positions, setPositions] = useState(false);

  return (
    <View>
      <View style={styles.characterBanner}>
        <Text style={styles.characterBannerTitle}>CHARACTERS</Text>
        <Text style={styles.characterBannerDescription}>
          캐릭터는 최대 6명까지 켤 수 있습니다. 위치를 지정하려면 Character
          Positions를 켜세요.
        </Text>
      </View>

      <View style={styles.characterStack}>
        <CharacterCard
          index={1}
          name="Character 1"
          color={theme.color.badge1}
          positionsEnabled={positions}
          initiallyExpanded
          prompt="silver hair, long braid, translucent raincoat, looking at viewer, soft smile"
          negativePrompt="hat, glasses, closed eyes"
        />
        <CharacterCard
          index={2}
          name="Character 2"
          color={theme.color.badge2}
          positionsEnabled={positions}
          initiallyExpanded={false}
          prompt="black umbrella, dark suit, looking away, back turned"
          negativePrompt="smiling, facing viewer"
        />
      </View>

      <View style={styles.characterPositionCard}>
        <SettingsRow
          icon="location-outline"
          label="Character Positions"
          minHeight={60}
          trailing={
            <PanelSwitch
              label="Character Positions"
              value={positions}
              onChange={setPositions}
            />
          }
        />
      </View>
    </View>
  );
}

function AdvancedToggleRow({
  icon,
  label,
  summary,
  value,
  onChange,
}: {
  icon: IconName;
  label: string;
  summary: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.advancedToggleRow}>
      <View style={styles.advancedToggleMain}>
        <Ionicons name={icon} size={21} color={theme.color.accent} />
        <View style={styles.advancedToggleCopy}>
          <Text style={styles.advancedToggleLabel}>{label}</Text>
          <Text style={styles.advancedToggleState}>
            {value ? summary : "사용 안 함"}
          </Text>
        </View>
      </View>
      <View style={styles.advancedToggleTrailing}>
        <PanelSwitch label={label} value={value} onChange={onChange} />
      </View>
    </View>
  );
}

function AdvancedToolRow({
  icon,
  label,
  value,
}: {
  icon: IconName;
  label: string;
  value?: string;
}) {
  return (
    <View style={styles.advancedToolRow}>
      <Ionicons name={icon} size={21} color={theme.color.accent} />
      <Text style={styles.advancedToolLabel}>{label}</Text>
      {value ? <Text style={styles.advancedToolValue}>{value}</Text> : null}
      <Ionicons
        name="chevron-forward"
        size={18}
        color={theme.color.textMuted}
      />
    </View>
  );
}

function AdvancedContent() {
  const [imageToImage, setImageToImage] = useState(false);
  const [vibe, setVibe] = useState(false);
  const [precise, setPrecise] = useState(false);

  return (
    <View>
      <SettingsGroup>
        <AdvancedToggleRow
          icon="image-outline"
          label="Image2Image"
          summary="S 0.7 · N 0.0"
          value={imageToImage}
          onChange={setImageToImage}
        />
        <AdvancedToggleRow
          icon="color-palette-outline"
          label="Vibe Transfer"
          summary="I 1.0 · S 0.6"
          value={vibe}
          onChange={setVibe}
        />
        <AdvancedToggleRow
          icon="person-outline"
          label="Precise Reference"
          summary="Both · F 0.5 · S 0.6"
          value={precise}
          onChange={setPrecise}
        />
      </SettingsGroup>

      <View style={styles.settingsBlockGap}>
        <SettingsGroup>
          <AdvancedToolRow icon="scan-outline" label="Metadata Extract" />
          <AdvancedToolRow icon="images-outline" label="Batch Count" value="1" />
        </SettingsGroup>
      </View>
    </View>
  );
}

function PanelBody({
  tab,
  onOpenDetail,
}: {
  tab: PlayerPanelTab;
  onOpenDetail: (detail: PlayerPanelDetail) => void;
}) {
  switch (tab) {
    case "prompt":
      return <PromptContent />;
    case "settings":
      return <SettingsContent onOpenDetail={onOpenDetail} />;
    case "character":
      return <CharacterContent />;
    case "imageRef":
      return <AdvancedContent />;
  }
}

type PanelTabScreenRole = "incoming" | "outgoing" | "hidden";
type PanelDetailScreenRole = "incoming" | "outgoing";

function AnimatedPanelTabScreen({
  tab,
  role,
  direction,
  progress,
  width,
  onOpenDetail,
}: {
  tab: PlayerPanelTab;
  role: PanelTabScreenRole;
  direction: SharedValue<number>;
  progress: SharedValue<number>;
  width: number;
  onOpenDetail: (detail: PlayerPanelDetail) => void;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    if (role === "hidden") {
      return {
        opacity: 0,
        transform: [{ translateX: 0 }],
      };
    }

    const value = progress.value;
    const translateX =
      role === "incoming"
        ? width * 0.2 * direction.value * (1 - value)
        : -width * 0.2 * direction.value * value;

    return {
      opacity: role === "incoming" ? value : 1 - value,
      transform: [{ translateX: Math.round(translateX) }],
    };
  });
  const active = role === "incoming";

  return (
    <Reanimated.View
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? "auto" : "no-hide-descendants"}
      pointerEvents={active ? "auto" : "none"}
      style={[
        styles.panelTabScreen,
        role === "incoming" && styles.panelTabIncomingScreen,
        animatedStyle,
      ]}
    >
      <ScrollView
        bounces={false}
        nestedScrollEnabled
        overScrollMode="never"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={styles.panelTabScroll}
        contentContainerStyle={styles.panelScrollContent}
      >
        <PanelBody tab={tab} onOpenDetail={onOpenDetail} />
      </ScrollView>
    </Reanimated.View>
  );
}

function AnimatedPlayerDetailScreen({
  activeDraft,
  detail,
  direction,
  onOpenDetail,
  onReturnToSettings,
  onSaveDraft,
  progress,
  registerDraft,
  role,
  width,
}: {
  activeDraft: SheetDraftController | null;
  detail: PlayerPanelDetail;
  direction: SharedValue<number>;
  onOpenDetail: (detail: PlayerPanelDetail) => void;
  onReturnToSettings: () => void;
  onSaveDraft: () => void;
  progress: SharedValue<number>;
  registerDraft: RegisterSheetDraft;
  role: PanelDetailScreenRole;
  width: number;
}) {
  const active = role === "incoming";
  const animatedStyle = useAnimatedStyle(() => {
    const value = progress.value;
    const translateX =
      role === "incoming"
        ? width * direction.value * (1 - value)
        : -width * 0.2 * direction.value * value;
    return {
      opacity: role === "incoming" ? value : 1 - value,
      transform: [{ translateX: Math.round(translateX) }],
    };
  });

  return (
    <Reanimated.View
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? "auto" : "no-hide-descendants"}
      pointerEvents={active ? "auto" : "none"}
      style={[
        styles.playerDetailRoute,
        active && styles.playerDetailRouteIncoming,
        animatedStyle,
      ]}
    >
      <ScrollView
        bounces={false}
        nestedScrollEnabled
        overScrollMode="never"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={[styles.panelScroll, styles.panelDetailScroll]}
        contentContainerStyle={[
          styles.panelDetailScrollContent,
          active && activeDraft && styles.panelDetailScrollContentWithFooter,
        ]}
      >
        <PlayerSettingDetailContent
          detail={detail}
          onCommitAndReturnToSettings={onReturnToSettings}
          onOpenDetail={onOpenDetail}
          registerDraft={registerDraft}
        />
      </ScrollView>
      {active && activeDraft ? (
        <View style={styles.draftFooter}>
          <PrimaryButton
            label="저장"
            disabled={!activeDraft.canSave}
            onPress={onSaveDraft}
          />
        </View>
      ) : null}
    </Reanimated.View>
  );
}

export function PlayerDetailPanelContent({
  activeTab,
  activeDetail,
  detailDepth,
  activeDraft,
  onSelectTab,
  onOpenDetail,
  onCommitDetailBack,
  onReturnToSettings,
  registerDraft,
}: {
  activeTab: PlayerPanelTab;
  activeDetail: PlayerPanelDetail | null;
  detailDepth: number;
  activeDraft: SheetDraftController | null;
  onSelectTab: (tab: PlayerPanelTab) => void;
  onOpenDetail: (detail: PlayerPanelDetail) => void;
  onCommitDetailBack: () => void;
  onReturnToSettings: () => void;
  registerDraft: RegisterSheetDraft;
}) {
  const { width } = useWindowDimensions();
  const detailProgress = useSharedValue(activeDetail ? 1 : 0);
  const detailTransitionProgress = useSharedValue(1);
  const detailTransitionDirection = useSharedValue(1);
  const tabTransitionProgress = useSharedValue(1);
  const tabTransitionDirection = useSharedValue(1);
  const [displayedTab, setDisplayedTab] = useState(activeTab);
  const [outgoingTab, setOutgoingTab] = useState<PlayerPanelTab | null>(null);
  const [displayedDetail, setDisplayedDetail] =
    useState<PlayerPanelDetail | null>(activeDetail);
  const [displayedDetailDepth, setDisplayedDetailDepth] = useState(detailDepth);
  const [outgoingDetail, setOutgoingDetail] =
    useState<PlayerPanelDetail | null>(null);

  const clearOutgoingTab = useCallback(() => {
    setOutgoingTab(null);
  }, []);
  const clearOutgoingDetail = useCallback(() => {
    setOutgoingDetail(null);
  }, []);
  const clearDisplayedDetail = useCallback(() => {
    setDisplayedDetail(null);
    setOutgoingDetail(null);
  }, []);
  const handleDraftSave = useCallback(() => {
    if (!activeDraft?.save()) return;
    if (activeDetail === "resolutionCustom") onCommitDetailBack();
    else onReturnToSettings();
  }, [
    activeDetail,
    activeDraft,
    onCommitDetailBack,
    onReturnToSettings,
  ]);

  useEffect(() => {
    cancelAnimation(detailProgress);
    detailProgress.value = withTiming(
      activeDetail ? 1 : 0,
      {
        duration: theme.motion.fadeDuration,
        easing: PANEL_CONTENT_EASING,
      },
      (finished) => {
        if (finished && !activeDetail) runOnJS(clearDisplayedDetail)();
      },
    );
  }, [activeDetail, clearDisplayedDetail, detailProgress]);

  useEffect(() => {
    if (!activeDetail || activeDetail === displayedDetail) return;
    if (!displayedDetail) {
      setDisplayedDetail(activeDetail);
      setDisplayedDetailDepth(detailDepth);
      return;
    }

    cancelAnimation(detailTransitionProgress);
    detailTransitionDirection.value =
      detailDepth > displayedDetailDepth ? 1 : -1;
    detailTransitionProgress.value = 0;
    setOutgoingDetail(displayedDetail);
    setDisplayedDetail(activeDetail);
    setDisplayedDetailDepth(detailDepth);
    detailTransitionProgress.value = withTiming(
      1,
      {
        duration: theme.motion.fadeDuration,
        easing: PANEL_CONTENT_EASING,
      },
      (finished) => {
        if (finished) runOnJS(clearOutgoingDetail)();
      },
    );
  }, [
    activeDetail,
    clearOutgoingDetail,
    detailDepth,
    detailTransitionDirection,
    detailTransitionProgress,
    displayedDetail,
    displayedDetailDepth,
  ]);

  useEffect(() => {
    if (activeTab === displayedTab) return;

    cancelAnimation(tabTransitionProgress);
    tabTransitionDirection.value =
      PANEL_TABS.findIndex((tab) => tab.id === activeTab) >
      PANEL_TABS.findIndex((tab) => tab.id === displayedTab)
        ? 1
        : -1;
    tabTransitionProgress.value = 0;
    setOutgoingTab(displayedTab);
    setDisplayedTab(activeTab);
    tabTransitionProgress.value = withTiming(
      1,
      {
        duration: theme.motion.fadeDuration,
        easing: PANEL_CONTENT_EASING,
      },
      (finished) => {
        if (finished) runOnJS(clearOutgoingTab)();
      },
    );
  }, [
    activeTab,
    clearOutgoingTab,
    displayedTab,
    tabTransitionDirection,
    tabTransitionProgress,
  ]);

  const rootScreenAnimatedStyle = useAnimatedStyle(() => ({
    opacity: 1 - detailProgress.value,
    transform: [
      {
        translateX: Math.round(-width * 0.2 * detailProgress.value),
      },
    ],
  }));
  const detailScreenAnimatedStyle = useAnimatedStyle(() => ({
    opacity: detailProgress.value,
    transform: [
      {
        translateX: Math.round(width * (1 - detailProgress.value)),
      },
    ],
  }));

  return (
    <View style={styles.panelContent}>
      <Reanimated.View
        accessibilityElementsHidden={activeDetail !== null}
        importantForAccessibility={
          activeDetail === null ? "auto" : "no-hide-descendants"
        }
        pointerEvents={activeDetail === null ? "auto" : "none"}
        style={[styles.panelScreen, rootScreenAnimatedStyle]}
      >
        <View accessibilityRole="tablist" style={styles.panelTabs}>
          {PANEL_TABS.map((tab) => {
            const active = tab.id === activeTab;
            return (
              <Pressable
                key={tab.id}
                accessibilityRole="tab"
                accessibilityLabel={tab.label}
                accessibilityState={{ selected: active }}
                onPress={() => onSelectTab(tab.id)}
                style={({ pressed }) => [
                  styles.panelTab,
                  active && styles.panelTabActive,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name={tab.icon}
                  size={15}
                  color={
                    active ? theme.color.onAccent : theme.color.textTertiary
                  }
                />
                <Text
                  numberOfLines={1}
                  style={[
                    styles.panelTabLabel,
                    active && styles.panelTabLabelActive,
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.panelTabViewport}>
          {PANEL_TABS.map((tab) => {
            const role: PanelTabScreenRole =
              tab.id === displayedTab
                ? "incoming"
                : tab.id === outgoingTab
                  ? "outgoing"
                  : "hidden";

            return (
              <AnimatedPanelTabScreen
                key={tab.id}
                tab={tab.id}
                role={role}
                direction={tabTransitionDirection}
                progress={tabTransitionProgress}
                width={width}
                onOpenDetail={onOpenDetail}
              />
            );
          })}
        </View>
      </Reanimated.View>

      <Reanimated.View
        accessibilityElementsHidden={activeDetail === null}
        importantForAccessibility={
          activeDetail === null ? "no-hide-descendants" : "auto"
        }
        pointerEvents={activeDetail === null ? "none" : "auto"}
        style={[
          styles.panelScreen,
          styles.panelDetailScreen,
          detailScreenAnimatedStyle,
        ]}
      >
        {outgoingDetail ? (
          <AnimatedPlayerDetailScreen
            activeDraft={null}
            detail={outgoingDetail}
            direction={detailTransitionDirection}
            onOpenDetail={onOpenDetail}
            onReturnToSettings={onReturnToSettings}
            onSaveDraft={handleDraftSave}
            progress={detailTransitionProgress}
            registerDraft={registerDraft}
            role="outgoing"
            width={width}
          />
        ) : null}
        {displayedDetail ? (
          <AnimatedPlayerDetailScreen
            activeDraft={activeDraft}
            detail={displayedDetail}
            direction={detailTransitionDirection}
            onOpenDetail={onOpenDetail}
            onReturnToSettings={onReturnToSettings}
            onSaveDraft={handleDraftSave}
            progress={detailTransitionProgress}
            registerDraft={registerDraft}
            role="incoming"
            width={width}
          />
        ) : null}
      </Reanimated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  panelContent: { flex: 1, overflow: "hidden" },
  panelScreen: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: theme.color.panel,
  },
  panelDetailScreen: { zIndex: 1 },
  playerDetailRoute: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: theme.color.panel,
  },
  playerDetailRouteIncoming: { zIndex: 1 },
  panelTabs: {
    height: 44,
    paddingHorizontal: theme.layout.panelInset,
    paddingTop: 2,
    paddingBottom: 6,
    flexDirection: "row",
    gap: 6,
  },
  panelTab: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderRadius: theme.radius.segment,
    borderWidth: 1,
    borderColor: theme.color.segmentInactive,
    backgroundColor: theme.color.segmentInactive,
  },
  panelTabActive: {
    borderColor: theme.color.accent,
    backgroundColor: theme.color.accent,
  },
  panelTabLabel: {
    color: theme.color.textTertiary,
    fontFamily: tokens.font.semibold,
    fontSize: 12,
  },
  panelTabLabelActive: { color: theme.color.onAccent },
  panelTabViewport: {
    flex: 1,
    marginTop: 10,
    overflow: "hidden",
  },
  panelTabScreen: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: theme.color.panel,
  },
  panelTabIncomingScreen: { zIndex: 1 },
  panelTabScroll: { flex: 1 },
  panelScroll: { flex: 1, marginTop: 10 },
  panelDetailScroll: { marginTop: 0 },
  panelDetailScrollContent: {
    paddingHorizontal: 0,
    paddingTop: 2,
    paddingBottom: 60,
  },
  panelDetailScrollContentWithFooter: { paddingBottom: 112 },
  draftFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 76,
    paddingHorizontal: theme.layout.panelInset,
    paddingTop: 10,
    backgroundColor: theme.color.panel,
  },
  panelScrollContent: {
    paddingHorizontal: theme.layout.panelInset,
    paddingTop: 2,
    paddingBottom: 60,
  },
  contentStack: { gap: 16 },
  sectionLabel: {
    marginTop: 24,
    marginBottom: 12,
    paddingHorizontal: 4,
    color: theme.color.textMuted,
    fontFamily: tokens.font.semibold,
    fontSize: 11,
    letterSpacing: 0.66,
  },
  settingsGroup: {
    overflow: "hidden",
    borderRadius: theme.radius.panelCard,
    backgroundColor: theme.color.card,
  },
  groupDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
    backgroundColor: theme.color.borderSubtle,
  },
  settingsRow: {
    minHeight: 56,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  rowLabel: {
    flex: 1,
    color: theme.color.textPrimary,
    fontFamily: tokens.font.regular,
    fontSize: 16,
  },
  rowValue: {
    maxWidth: "48%",
    color: theme.color.textTertiary,
    fontFamily: tokens.font.regular,
    fontSize: 15,
  },
  switchTrack: {
    width: 44,
    height: 26,
    padding: 3,
    justifyContent: "center",
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.controlTrackOff,
  },
  switchTrackActive: { backgroundColor: theme.color.accent },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.textPrimary,
  },
  switchThumbActive: {
    transform: [{ translateX: 18 }],
    backgroundColor: theme.color.onAccent,
  },
  promptCard: {
    minHeight: 420,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    gap: 14,
    borderRadius: theme.radius.panelCard,
    borderWidth: 1,
    borderColor: theme.color.borderSubtle,
    backgroundColor: theme.color.card,
  },
  promptCardNegative: {
    borderColor: theme.color.borderNegative,
  },
  promptModeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  promptModeControl: {
    width: 150,
    height: 32,
    padding: 3,
    flexDirection: "row",
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.panel,
  },
  promptModeButton: {
    height: 26,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.pill,
  },
  promptModeBaseButton: { width: 66 },
  promptModeNegativeButton: { width: 78 },
  promptModeButtonActive: { backgroundColor: theme.color.accent },
  promptModeNegativeActive: { backgroundColor: theme.color.textNegative },
  promptModeLabel: {
    color: theme.color.textTertiary,
    fontFamily: tokens.font.medium,
    fontSize: 11,
  },
  promptModeLabelActive: {
    color: theme.color.onAccent,
    fontFamily: tokens.font.semibold,
  },
  promptModeNegativeLabelActive: {
    color: theme.color.app,
  },
  tokenCount: {
    color: theme.color.textMuted,
    fontFamily: monoFont,
    fontSize: 12,
  },
  promptText: {
    flex: 1,
    color: theme.color.textPrimary,
    fontFamily: tokens.font.regular,
    fontSize: 15,
    lineHeight: 22,
  },
  settingsBlockGap: { marginTop: 16 },
  parameterItem: { gap: 8 },
  optionDescription: {
    paddingHorizontal: 4,
    color: theme.color.textMuted,
    fontFamily: tokens.font.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  parameterStack: { gap: 16 },
  parameterCard: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    gap: 14,
    borderRadius: theme.radius.panelCard,
    backgroundColor: theme.color.card,
  },
  characterBanner: {
    marginTop: -4,
    marginHorizontal: -16,
    marginBottom: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 4,
    backgroundColor: theme.color.raised,
  },
  characterBannerTitle: {
    color: theme.color.textMuted,
    fontFamily: tokens.font.semibold,
    fontSize: 11,
    letterSpacing: 0.66,
  },
  characterBannerDescription: {
    color: theme.color.textTertiary,
    fontFamily: tokens.font.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  characterStack: { gap: 12 },
  characterCard: {
    overflow: "hidden",
    minHeight: 64,
    borderRadius: theme.radius.panelCard,
    borderWidth: 1,
    borderColor: theme.color.borderSubtle,
    backgroundColor: theme.color.card,
  },
  characterCardNegative: { borderColor: theme.color.borderNegative },
  characterCardDisabled: { opacity: 0.55 },
  characterHeader: {
    minHeight: 64,
    paddingLeft: 16,
    paddingRight: 6,
    flexDirection: "row",
    alignItems: "center",
  },
  characterHeaderMain: {
    flex: 1,
    minWidth: 0,
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  characterBadge: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  characterBadgeText: {
    color: theme.color.onAccent,
    fontFamily: tokens.font.semibold,
    fontSize: 15,
  },
  characterBadgeTextInactive: { color: theme.color.textMuted },
  characterCopy: { flex: 1, minWidth: 0 },
  characterTitle: {
    color: theme.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: 16,
    lineHeight: 20,
  },
  characterMeta: {
    marginTop: 1,
    color: theme.color.textMuted,
    fontFamily: tokens.font.regular,
    fontSize: 12,
    lineHeight: 16,
  },
  characterSwitchHitbox: {
    width: 52,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  characterChevron: {
    width: 40,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  characterEditor: {
    minHeight: 190,
    paddingTop: 2,
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 14,
  },
  characterPrompt: {
    flex: 1,
    color: theme.color.textPrimary,
    fontFamily: tokens.font.regular,
    fontSize: 15,
    lineHeight: 22,
  },
  characterPositionCard: {
    marginTop: 20,
    overflow: "hidden",
    borderRadius: theme.radius.panelCard,
    backgroundColor: theme.color.card,
  },
  advancedToggleRow: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
  },
  advancedToggleMain: {
    flex: 1,
    minWidth: 0,
    paddingLeft: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  advancedToggleCopy: { flex: 1, minWidth: 0 },
  advancedToggleLabel: {
    color: theme.color.textPrimary,
    fontFamily: tokens.font.regular,
    fontSize: 15,
    lineHeight: 20,
  },
  advancedToggleState: {
    marginTop: 2,
    color: theme.color.textMuted,
    fontFamily: tokens.font.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  advancedToggleTrailing: {
    paddingHorizontal: 16,
  },
  advancedToolRow: {
    minHeight: 56,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  advancedToolLabel: {
    flex: 1,
    color: theme.color.textPrimary,
    fontFamily: tokens.font.regular,
    fontSize: 15,
  },
  advancedToolValue: {
    color: theme.color.textTertiary,
    fontFamily: monoFont,
    fontSize: 15,
  },
  pressed: { opacity: 0.7 },
});
