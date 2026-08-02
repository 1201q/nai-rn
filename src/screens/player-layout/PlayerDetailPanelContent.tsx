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

import { monoFont, tokens } from "../../styles/tokens";
import { playerLayoutTokens as theme } from "./playerLayoutTokens";

export type PlayerPanelTab =
  | "prompt"
  | "settings"
  | "character"
  | "imageRef";
export type PlayerPanelDetail = "model";

type IconName = keyof typeof Ionicons.glyphMap;

const PANEL_CONTENT_EASING = Easing.bezier(...theme.motion.easing);

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

function ParameterCard({
  label,
  value,
  progress,
}: {
  label: string;
  value: string;
  progress: number;
}) {
  return (
    <View style={styles.parameterCard}>
      <View style={styles.parameterHeader}>
        <Text style={styles.parameterLabel}>{label}</Text>
        <Text style={styles.parameterValue}>{value}</Text>
      </View>
      <View style={styles.sliderRow}>
        <Ionicons name="remove-outline" size={18} color={theme.color.textMuted} />
        <View style={styles.sliderTrack}>
          <View style={[styles.sliderFill, { width: `${progress}%` }]} />
          <View style={[styles.sliderThumb, { left: `${progress}%` }]} />
        </View>
        <Ionicons name="add-outline" size={18} color={theme.color.textMuted} />
      </View>
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

function SettingsContent({ onOpenModel }: { onOpenModel: () => void }) {
  const [variety, setVariety] = useState(false);

  return (
    <View>
      <SettingsGroup>
        <SettingsRow
          icon="cube-outline"
          label="Model"
          value="V4.5 Full"
          accentIcon
          onPress={onOpenModel}
        />
        <SettingsRow
          icon="scan-outline"
          label="Resolution"
          value="832 x 1216"
          accentIcon
        />
      </SettingsGroup>

      <View style={styles.settingsBlockGap}>
        <SettingsGroup>
          <SettingsRow icon="dice-outline" label="Seed" value="3841102" />
        </SettingsGroup>
      </View>

      <SectionLabel>PARAMETERS</SectionLabel>
      <View style={styles.parameterStack}>
        <ParameterCard label="Steps" value="28" progress={55} />
        <ParameterCard label="Guidance" value="5" progress={50} />
        <ParameterCard label="Guidance Rescale" value="0" progress={0} />
      </View>

      <SectionLabel>ADVANCED SETTINGS</SectionLabel>
      <SettingsGroup>
        <SettingsRow icon="shuffle-outline" label="Sampler" value="Euler Ancestral" />
        <SettingsRow icon="pulse-outline" label="Schedule" value="Karras" />
      </SettingsGroup>
      <View style={styles.settingsBlockGap}>
        <SettingsGroup>
        <SettingsRow
          icon="sparkles-outline"
          label="Variety+"
          trailing={
            <PanelSwitch label="Variety+" value={variety} onChange={setVariety} />
          }
        />
        </SettingsGroup>
      </View>
    </View>
  );
}

const MODEL_OPTIONS = [
  {
    id: "v45-full",
    name: "NAI Diffusion Anime V4.5 Full",
    description: "가장 높은 표현력과 프롬프트 이해도",
  },
  {
    id: "v45-curated",
    name: "NAI Diffusion Anime V4.5 Curated",
    description: "선별된 학습 데이터 기반의 안정적인 결과",
  },
  {
    id: "v4-full",
    name: "NAI Diffusion Anime V4 Full",
    description: "기존 V4 스타일과 호환되는 범용 모델",
  },
] as const;

function ModelContent() {
  const [selectedModel, setSelectedModel] = useState("v45-full");

  return (
    <View>
      <View style={styles.modelNotice}>
        <Text style={styles.modelNoticeTitle}>MODEL</Text>
        <Text style={styles.modelNoticeDescription}>
          패널 내부 상세 화면 전환을 확인하기 위한 임시 콘텐츠입니다.
        </Text>
      </View>

      <View style={styles.modelOptionStack}>
        {MODEL_OPTIONS.map((model) => {
          const selected = model.id === selectedModel;
          return (
            <Pressable
              key={model.id}
              accessibilityRole="radio"
              accessibilityLabel={model.name}
              accessibilityState={{ selected }}
              onPress={() => setSelectedModel(model.id)}
              style={({ pressed }) => [
                styles.modelOption,
                selected && styles.modelOptionSelected,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.modelOptionCopy}>
                <Text style={styles.modelOptionTitle}>{model.name}</Text>
                <Text style={styles.modelOptionDescription}>
                  {model.description}
                </Text>
              </View>
              <Ionicons
                name={selected ? "radio-button-on" : "radio-button-off"}
                size={21}
                color={
                  selected ? theme.color.accent : theme.color.textMuted
                }
              />
            </Pressable>
          );
        })}
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
  onOpenModel,
}: {
  tab: PlayerPanelTab;
  onOpenModel: () => void;
}) {
  switch (tab) {
    case "prompt":
      return <PromptContent />;
    case "settings":
      return <SettingsContent onOpenModel={onOpenModel} />;
    case "character":
      return <CharacterContent />;
    case "imageRef":
      return <AdvancedContent />;
  }
}

type PanelTabScreenRole = "incoming" | "outgoing" | "hidden";

function AnimatedPanelTabScreen({
  tab,
  role,
  direction,
  progress,
  width,
  onOpenModel,
}: {
  tab: PlayerPanelTab;
  role: PanelTabScreenRole;
  direction: SharedValue<number>;
  progress: SharedValue<number>;
  width: number;
  onOpenModel: () => void;
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
        <PanelBody tab={tab} onOpenModel={onOpenModel} />
      </ScrollView>
    </Reanimated.View>
  );
}

export function PlayerDetailPanelContent({
  activeTab,
  activeDetail,
  onSelectTab,
  onOpenModel,
}: {
  activeTab: PlayerPanelTab;
  activeDetail: PlayerPanelDetail | null;
  onSelectTab: (tab: PlayerPanelTab) => void;
  onOpenModel: () => void;
}) {
  const { width } = useWindowDimensions();
  const detailProgress = useSharedValue(activeDetail ? 1 : 0);
  const tabTransitionProgress = useSharedValue(1);
  const tabTransitionDirection = useSharedValue(1);
  const [displayedTab, setDisplayedTab] = useState(activeTab);
  const [outgoingTab, setOutgoingTab] = useState<PlayerPanelTab | null>(null);

  const clearOutgoingTab = useCallback(() => {
    setOutgoingTab(null);
  }, []);

  useEffect(() => {
    detailProgress.value = withTiming(activeDetail ? 1 : 0, {
      duration: theme.motion.fadeDuration,
      easing: PANEL_CONTENT_EASING,
    });
  }, [activeDetail, detailProgress]);

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
                onOpenModel={onOpenModel}
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
        <ScrollView
          bounces={false}
          nestedScrollEnabled
          overScrollMode="never"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={[styles.panelScroll, styles.panelDetailScroll]}
          contentContainerStyle={styles.panelScrollContent}
        >
          <ModelContent />
        </ScrollView>
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
  modelNotice: {
    marginHorizontal: -16,
    marginBottom: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 4,
    backgroundColor: theme.color.raised,
  },
  modelNoticeTitle: {
    color: theme.color.textMuted,
    fontFamily: tokens.font.semibold,
    fontSize: 11,
    letterSpacing: 0.66,
  },
  modelNoticeDescription: {
    color: theme.color.textTertiary,
    fontFamily: tokens.font.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  modelOptionStack: { gap: 12 },
  modelOption: {
    minHeight: 76,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: theme.radius.panelCard,
    borderWidth: 1,
    borderColor: theme.color.borderSubtle,
    backgroundColor: theme.color.card,
  },
  modelOptionSelected: { borderColor: theme.color.accent },
  modelOptionCopy: { flex: 1, minWidth: 0 },
  modelOptionTitle: {
    color: theme.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: 15,
    lineHeight: 20,
  },
  modelOptionDescription: {
    marginTop: 3,
    color: theme.color.textMuted,
    fontFamily: tokens.font.regular,
    fontSize: 12,
    lineHeight: 17,
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
  parameterHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  parameterLabel: {
    color: theme.color.textPrimary,
    fontFamily: tokens.font.regular,
    fontSize: 16,
  },
  parameterValue: {
    color: theme.color.textTertiary,
    fontFamily: monoFont,
    fontSize: 16,
  },
  sliderRow: {
    height: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sliderTrack: {
    flex: 1,
    height: 3,
    position: "relative",
    borderRadius: 2,
    backgroundColor: theme.color.borderSubtle,
  },
  sliderFill: {
    height: 3,
    borderRadius: 2,
    backgroundColor: theme.color.accent,
  },
  sliderThumb: {
    position: "absolute",
    top: -5.5,
    width: 14,
    height: 14,
    marginLeft: -7,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.accent,
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
