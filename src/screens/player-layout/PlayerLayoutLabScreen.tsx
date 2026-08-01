import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Svg, { Defs, Line, Pattern, Rect } from "react-native-svg";
import Reanimated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { toast } from "sonner-native";

import { monoFont, tokens } from "../../styles/tokens";
import {
  getDraggedSheetY,
  getContainedImageTarget,
  getExpandedSheetGeometry,
  getPanelDragY,
  getPanelProgress,
  getSheetProgress,
  getSheetVisuals,
  getThumbnailVisuals,
  shouldClosePanel,
  shouldExpandSheet,
} from "./playerLayoutMotion";
import { playerLayoutTokens as theme } from "./playerLayoutTokens";

type LabTab = "main" | "history" | "settings";
type PanelTab = "prompt" | "settings" | "character" | "imageRef";
type IconName = keyof typeof Ionicons.glyphMap;
type SelectedImage = {
  uri: string;
  width: number;
  height: number;
};

const MAIN_TILE_HEIGHTS = [186, 132, 158, 210, 144, 172, 126, 196, 150];
const HISTORY_GROUPS = [
  { title: "오늘", count: 12 },
  { title: "어제", count: 9 },
  { title: "7월 28일", count: 6 },
] as const;
const SETTINGS_ROWS: Array<{ icon: IconName; label: string }> = [
  { icon: "diamond-outline", label: "Subscription" },
  { icon: "sparkles-outline", label: "Anlas & purchases" },
  { icon: "color-palette-outline", label: "Default generation settings" },
  { icon: "cloud-download-outline", label: "Storage & downloads" },
  { icon: "help-circle-outline", label: "Help" },
];
const NAV_TABS: Array<{
  id: LabTab;
  label: string;
  activeIcon: IconName;
  inactiveIcon: IconName;
}> = [
  {
    id: "main",
    label: "Main",
    activeIcon: "sparkles",
    inactiveIcon: "sparkles-outline",
  },
  {
    id: "history",
    label: "History",
    activeIcon: "images",
    inactiveIcon: "images-outline",
  },
  {
    id: "settings",
    label: "Settings",
    activeIcon: "settings",
    inactiveIcon: "settings-outline",
  },
];
const IMAGE_ACTIONS: IconName[] = [
  "download-outline",
  "copy-outline",
  "dice-outline",
  "information-circle-outline",
];
const ENTRY_BADGES: Array<{
  id: PanelTab;
  icon: IconName;
  label: string;
  value: string;
}> = [
  {
    id: "prompt",
    icon: "document-text-outline",
    label: "프롬프트",
    value: "142",
  },
  {
    id: "settings",
    icon: "settings-outline",
    label: "설정",
    value: "28 · 5.0",
  },
  {
    id: "character",
    icon: "person-outline",
    label: "캐릭터",
    value: "2",
  },
  {
    id: "imageRef",
    icon: "options-outline",
    label: "고급 기능",
    value: "0",
  },
];
const PANEL_TITLES: Record<PanelTab, string> = {
  prompt: "프롬프트",
  settings: "설정",
  character: "캐릭터",
  imageRef: "고급 기능",
};
const DEFAULT_IMAGE_SIZE = { width: 832, height: 1216 } as const;

const SHEET_EASING = Easing.bezier(...theme.motion.easing);

function StripePlaceholder() {
  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Defs>
        <Pattern
          id="player-layout-stripes"
          width="20"
          height="20"
          patternTransform="rotate(45)"
          patternUnits="userSpaceOnUse"
        >
          <Line
            x1="0"
            y1="0"
            x2="0"
            y2="20"
            stroke={theme.color.placeholderStripe}
            strokeWidth="2"
          />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#player-layout-stripes)" />
    </Svg>
  );
}

function MainTab({ onOpenSheet }: { onOpenSheet: () => void }) {
  const columns = [
    MAIN_TILE_HEIGHTS.filter((_, index) => index % 2 === 0),
    MAIN_TILE_HEIGHTS.filter((_, index) => index % 2 === 1),
  ];

  return (
    <View style={styles.mainContent}>
      <View style={styles.mainHeader}>
        <Text style={styles.brand}>Rendra</Text>
        <View style={styles.balancePill}>
          <Ionicons
            name="diamond-outline"
            size={14}
            color={theme.color.accent}
          />
          <Text style={styles.balanceText}>8,420</Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Latest generation placeholder"
        onPress={onOpenSheet}
        style={({ pressed }) => [styles.hero, pressed && styles.pressed]}
      >
        <StripePlaceholder />
        <LinearGradient
          colors={["transparent", "rgba(10,10,11,0.85)"]}
          style={styles.heroCaption}
        >
          <Text style={styles.heroTitle}>Latest generation</Text>
          <Text style={styles.heroMeta}>832 x 1216 · 2분 전</Text>
        </LinearGradient>
      </Pressable>

      <View style={styles.masonry}>
        {columns.map((column, columnIndex) => (
          <View key={columnIndex} style={styles.masonryColumn}>
            {column.map((height, itemIndex) => (
              <Pressable
                key={`${columnIndex}-${itemIndex}`}
                accessibilityRole="button"
                accessibilityLabel="Generation placeholder"
                onPress={onOpenSheet}
                style={({ pressed }) => [
                  styles.masonryTile,
                  { height },
                  pressed && styles.pressed,
                ]}
              >
                <StripePlaceholder />
              </Pressable>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

function HistoryTab({
  tileWidth,
  onOpenSheet,
}: {
  tileWidth: number;
  onOpenSheet: () => void;
}) {
  return (
    <View style={styles.historyContent}>
      {HISTORY_GROUPS.map((group, groupIndex) => (
        <View key={group.title} style={styles.historyGroup}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>{group.title}</Text>
            <Text style={styles.historyCount}>{group.count}장</Text>
          </View>
          <View style={styles.historyGrid}>
            {Array.from({ length: group.count }, (_, index) => {
              const stack = groupIndex === 0 && index % 5 === 0;
              return (
                <Pressable
                  key={index}
                  accessibilityRole="button"
                  accessibilityLabel={`${group.title} generation ${index + 1}`}
                  onPress={onOpenSheet}
                  style={({ pressed }) => [
                    styles.historyTile,
                    { width: tileWidth, height: tileWidth },
                    pressed && styles.pressed,
                  ]}
                >
                  <StripePlaceholder />
                  {stack ? (
                    <View style={styles.stackBadge}>
                      <Ionicons
                        name="copy-outline"
                        size={11}
                        color={theme.color.textPrimary}
                      />
                      <Text style={styles.stackCount}>4</Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

function SettingsTab() {
  return (
    <View style={styles.settingsContent}>
      <Text style={styles.settingsTitle}>Settings</Text>

      <View style={styles.accountCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>R</Text>
        </View>
        <View style={styles.accountCopy}>
          <Text style={styles.accountName}>rendra_user</Text>
          <Text style={styles.accountPlan}>Opus · 8,420 Anlas</Text>
        </View>
      </View>

      <View style={styles.settingsList}>
        {SETTINGS_ROWS.map((row, index) => (
          <View key={row.label}>
            {index > 0 ? <View style={styles.settingsDivider} /> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={row.label}
              style={({ pressed }) => [
                styles.settingsRow,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name={row.icon}
                size={19}
                color={theme.color.textTertiary}
              />
              <Text style={styles.settingsRowLabel}>{row.label}</Text>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={theme.color.textMuted}
              />
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  );
}

function BottomTabs({
  activeTab,
  animatedProps,
  animatedStyle,
  onSelect,
}: {
  activeTab: LabTab;
  animatedProps: object;
  animatedStyle: object;
  onSelect: (tab: LabTab) => void;
}) {
  return (
    <Reanimated.View
      animatedProps={animatedProps}
      style={[styles.tabBar, animatedStyle]}
    >
      <LinearGradient
        colors={["transparent", "rgba(10,10,11,0.96)"]}
        locations={[0, 0.4]}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />
      {NAV_TABS.map((tab) => {
        const active = tab.id === activeTab;
        const color = active ? theme.color.accent : theme.color.textMuted;
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(tab.id)}
            style={({ pressed }) => [
              styles.tabButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name={active ? tab.activeIcon : tab.inactiveIcon}
              size={22}
              color={color}
            />
            <Text style={[styles.tabLabel, { color }]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </Reanimated.View>
  );
}

export function PlayerLayoutLabScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState<LabTab>("main");
  const [expanded, setExpanded] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<PanelTab>("settings");
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
  const [imagePickerBusy, setImagePickerBusy] = useState(false);
  const tileWidth = (width - 4) / 3;
  const collapsed = Math.max(
    0,
    height - theme.layout.miniHeight - theme.layout.tabBarHeight,
  );
  const expandedGeometry = getExpandedSheetGeometry(height);
  const imageTarget = getContainedImageTarget(
    width,
    selectedImage?.width ?? DEFAULT_IMAGE_SIZE.width,
    selectedImage?.height ?? DEFAULT_IMAGE_SIZE.height,
    expandedGeometry.imageFrameHeight,
  );
  const panelTravel = Math.max(0, height - theme.layout.panelTop);
  const sheetY = useSharedValue(collapsed);
  const panelDrag = useSharedValue(panelTravel);
  const progress = useDerivedValue(() =>
    getSheetProgress(sheetY.value, collapsed),
  );
  const panelProgress = useDerivedValue(() =>
    getPanelProgress(
      panelOpen,
      panelDrag.value,
      panelTravel,
      progress.value,
    ),
  );
  const visuals = useDerivedValue(() =>
    getSheetVisuals(
      progress.value,
      panelProgress.value,
      expandedGeometry.actionTop,
      expandedGeometry.actionTopCollapsed,
    ),
  );

  useEffect(() => {
    sheetY.value = expanded ? 0 : collapsed;
  }, [collapsed, sheetY]);

  useEffect(() => {
    if (!panelOpen) panelDrag.value = panelTravel;
  }, [panelTravel, panelDrag]);

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: Math.round(sheetY.value) }],
  }));
  const headerAnimatedStyle = useAnimatedStyle(() => ({
    height: visuals.value.headerHeight,
  }));
  const miniAnimatedStyle = useAnimatedStyle(() => ({
    opacity: visuals.value.miniOpacity,
  }));
  const fullHeaderAnimatedStyle = useAnimatedStyle(() => ({
    top: visuals.value.fullHeaderTop,
    opacity: visuals.value.contentOpacity,
  }));
  const fullContentAnimatedStyle = useAnimatedStyle(() => ({
    opacity: visuals.value.contentOpacity,
  }));
  const imageActionsAnimatedStyle = useAnimatedStyle(() => ({
    top: visuals.value.bodyTop,
    opacity: visuals.value.contentOpacity,
  }));
  const scrimAnimatedStyle = useAnimatedStyle(() => ({
    opacity: visuals.value.scrimOpacity,
  }));
  const tabBarAnimatedStyle = useAnimatedStyle(() => ({
    opacity: visuals.value.tabBarOpacity,
    transform: [{ translateY: visuals.value.tabBarY }],
  }));
  const thumbnailAnimatedStyle = useAnimatedStyle(() =>
    getThumbnailVisuals(
      progress.value,
      imageTarget.width,
      imageTarget.height,
      panelProgress.value,
      imageTarget.left,
      imageTarget.top,
    ),
  );
  const dockAnimatedStyle = useAnimatedStyle(() => ({
    opacity: panelProgress.value,
  }));
  const panelAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: Math.round(
          panelOpen && progress.value > 0.99
            ? panelDrag.value
            : panelTravel + theme.motion.panelClosedOvershoot,
        ),
      },
    ],
  }));
  const tabBarAnimatedProps = useAnimatedProps(() => ({
    pointerEvents: progress.value > 0.5 ? ("none" as const) : ("auto" as const),
  }));
  const miniAnimatedProps = useAnimatedProps(() => ({
    pointerEvents:
      progress.value > 0.4 ? ("none" as const) : ("auto" as const),
  }));
  const fullContentAnimatedProps = useAnimatedProps(() => ({
    pointerEvents:
      progress.value > 0.6 && panelProgress.value < 0.5
        ? ("auto" as const)
        : ("none" as const),
  }));
  const dockAnimatedProps = useAnimatedProps(() => ({
    pointerEvents:
      panelProgress.value > 0.5 ? ("auto" as const) : ("none" as const),
  }));
  const panelAnimatedProps = useAnimatedProps(() => ({
    pointerEvents:
      panelOpen && progress.value > 0.99
        ? ("auto" as const)
        : ("none" as const),
  }));

  const animateSheet = useCallback(
    (nextExpanded: boolean) => {
      setExpanded(nextExpanded);
      sheetY.value = withTiming(nextExpanded ? 0 : collapsed, {
        duration: theme.motion.sheetDuration,
        easing: SHEET_EASING,
      });
    },
    [collapsed, sheetY],
  );
  const commitExpanded = useCallback((nextExpanded: boolean) => {
    setExpanded(nextExpanded);
  }, []);
  const sheetPanGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!panelOpen)
        .activeOffsetY([
          -theme.motion.panActivationOffset,
          theme.motion.panActivationOffset,
        ])
        .failOffsetX([
          -theme.motion.panHorizontalFailOffset,
          theme.motion.panHorizontalFailOffset,
        ])
        .onBegin(() => {
          cancelAnimation(sheetY);
        })
        .onUpdate((event) => {
          const base = expanded ? 0 : collapsed;
          sheetY.value = getDraggedSheetY(
            base,
            event.translationY,
            collapsed,
          );
        })
        .onEnd((event) => {
          const nextExpanded = shouldExpandSheet(
            expanded,
            event.translationY,
          );
          sheetY.value = withTiming(nextExpanded ? 0 : collapsed, {
            duration: theme.motion.sheetDuration,
            easing: SHEET_EASING,
          });
          runOnJS(commitExpanded)(nextExpanded);
        })
        .onFinalize((_event, success) => {
          if (success) return;
          sheetY.value = withTiming(expanded ? 0 : collapsed, {
            duration: theme.motion.sheetDuration,
            easing: SHEET_EASING,
          });
        }),
    [collapsed, commitExpanded, expanded, panelOpen, sheetY],
  );

  const openSheet = useCallback(() => animateSheet(true), [animateSheet]);
  const closeSheet = useCallback(() => animateSheet(false), [animateSheet]);
  const commitPanelClosed = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setPanelOpen(false);
        panelDrag.value = panelTravel;
      });
    });
  }, [panelDrag, panelTravel]);
  const closePanel = useCallback(() => {
    cancelAnimation(panelDrag);
    panelDrag.value = withTiming(
      panelTravel + theme.motion.panelClosedOvershoot,
      {
        duration: theme.motion.sheetDuration,
        easing: SHEET_EASING,
      },
      (finished) => {
        if (finished) runOnJS(commitPanelClosed)();
      },
    );
  }, [commitPanelClosed, panelDrag, panelTravel]);
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          if (panelOpen) {
            closePanel();
            return true;
          }
          if (expanded) {
            closeSheet();
            return true;
          }
          return false;
        },
      );

      return () => subscription.remove();
    }, [closePanel, closeSheet, expanded, panelOpen]),
  );
  const openPanel = useCallback(
    (nextTab: PanelTab) => {
      cancelAnimation(panelDrag);
      panelDrag.value = panelTravel;
      setPanelTab(nextTab);
      setPanelOpen(true);
      requestAnimationFrame(() => {
        panelDrag.value = withTiming(0, {
          duration: theme.motion.sheetDuration,
          easing: SHEET_EASING,
        });
      });
    },
    [panelDrag, panelTravel],
  );
  const panelPanGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(panelOpen)
        .minDistance(1)
        .onBegin(() => {
          cancelAnimation(panelDrag);
        })
        .onUpdate((event) => {
          panelDrag.value = getPanelDragY(event.translationY, panelTravel);
        })
        .onEnd((event) => {
          if (shouldClosePanel(event.translationY)) {
            panelDrag.value = withTiming(
              panelTravel + theme.motion.panelClosedOvershoot,
              {
                duration: theme.motion.sheetDuration,
                easing: SHEET_EASING,
              },
              (finished) => {
                if (finished) runOnJS(commitPanelClosed)();
              },
            );
            return;
          }
          panelDrag.value = withTiming(0, {
            duration: theme.motion.sheetDuration,
            easing: SHEET_EASING,
          });
        })
        .onFinalize((_event, success) => {
          if (success) return;
          panelDrag.value = withTiming(0, {
            duration: theme.motion.sheetDuration,
            easing: SHEET_EASING,
          });
        }),
    [commitPanelClosed, panelDrag, panelOpen, panelTravel],
  );
  const pickImage = useCallback(async () => {
    if (imagePickerBusy) return;
    setImagePickerBusy(true);
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        toast.error("이미지를 선택하려면 사진 접근 권한이 필요합니다.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 1,
        base64: false,
      });
      const asset = result.canceled ? undefined : result.assets[0];
      if (!asset) return;

      setSelectedImage({
        uri: asset.uri,
        width: asset.width || DEFAULT_IMAGE_SIZE.width,
        height: asset.height || DEFAULT_IMAGE_SIZE.height,
      });
    } catch {
      toast.error("이미지를 선택하지 못했습니다.");
    } finally {
      setImagePickerBusy(false);
    }
  }, [imagePickerBusy]);
  const handleImagePress = useCallback(() => {
    if (panelOpen) {
      closePanel();
      return;
    }
    void pickImage();
  }, [closePanel, panelOpen, pickImage]);

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(theme.layout.contentTop, insets.top + 6),
          },
        ]}
        pointerEvents={expanded ? "none" : "auto"}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === "main" ? (
          <MainTab onOpenSheet={openSheet} />
        ) : null}
        {activeTab === "history" ? (
          <HistoryTab tileWidth={tileWidth} onOpenSheet={openSheet} />
        ) : null}
        {activeTab === "settings" ? <SettingsTab /> : null}
      </ScrollView>

      <Reanimated.View
        pointerEvents="none"
        style={[styles.scrim, scrimAnimatedStyle]}
      />

      <GestureDetector gesture={sheetPanGesture}>
        <Reanimated.View
          style={[
            styles.generationSheet,
            { height },
            sheetAnimatedStyle,
          ]}
        >
          <Reanimated.View style={[styles.sheetHeader, headerAnimatedStyle]}>
            <Reanimated.View
              animatedProps={miniAnimatedProps}
              style={[styles.miniBar, miniAnimatedStyle]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="생성 시트 펼치기"
                accessibilityState={{ expanded: false }}
                onPress={openSheet}
                style={({ pressed }) => [
                  styles.miniBarPressTarget,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.miniCopy}>
                  <Text numberOfLines={1} style={styles.miniTitle}>
                    NAI Diffusion Anime V4.5 · Full
                  </Text>
                  <Text numberOfLines={1} style={styles.miniMeta}>
                    {selectedImage?.width ?? DEFAULT_IMAGE_SIZE.width} x{" "}
                    {selectedImage?.height ?? DEFAULT_IMAGE_SIZE.height} · 28
                    steps
                  </Text>
                </View>
                <View style={styles.miniGenerateButton}>
                  <Ionicons
                    name="sparkles"
                    size={15}
                    color={theme.color.onAccent}
                  />
                  <Text style={styles.miniGenerateLabel}>Generate</Text>
                </View>
              </Pressable>
            </Reanimated.View>

            <Reanimated.View
              animatedProps={fullContentAnimatedProps}
              style={[styles.fullHeader, fullHeaderAnimatedStyle]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="생성 시트 접기"
                accessibilityState={{ expanded: true }}
                hitSlop={8}
                onPress={closeSheet}
                style={({ pressed }) => [
                  styles.collapseButton,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name="chevron-down"
                  size={24}
                  color={theme.color.textSecondary}
                />
              </Pressable>
              <View style={styles.fullHeaderCopy}>
                <Text style={styles.fullHeaderOverline}>IMAGE GENERATION</Text>
                <Text style={styles.fullHeaderTitle}>
                  NAI Diffusion Anime V4.5 · Full
                </Text>
              </View>
            </Reanimated.View>
          </Reanimated.View>

          <Reanimated.View
            style={[styles.sheetThumbnail, thumbnailAnimatedStyle]}
          >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              panelOpen ? "디테일 패널 닫기" : "테스트 이미지 선택"
            }
            accessibilityState={{ disabled: imagePickerBusy }}
            disabled={imagePickerBusy}
            onPress={handleImagePress}
            style={({ pressed }) => [
              styles.imagePressTarget,
              pressed && styles.pressed,
            ]}
          >
            {selectedImage ? (
              <ExpoImage
                contentFit="cover"
                source={{ uri: selectedImage.uri }}
                style={StyleSheet.absoluteFill}
                transition={0}
              />
            ) : (
              <>
                <StripePlaceholder />
                <View pointerEvents="none" style={styles.imagePickerHint}>
                  <Ionicons
                    name="image-outline"
                    size={18}
                    color={theme.color.textTertiary}
                  />
                </View>
              </>
            )}
          </Pressable>
          </Reanimated.View>

        <Reanimated.View
          animatedProps={dockAnimatedProps}
          style={[styles.panelDock, dockAnimatedStyle]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="디테일 패널 닫기"
            onPress={closePanel}
            style={({ pressed }) => [
              styles.panelDockPressTarget,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.panelDockCopy}>
              <Text numberOfLines={1} style={styles.miniTitle}>
                NAI Diffusion Anime V4.5 · Full
              </Text>
              <Text numberOfLines={1} style={styles.miniMeta}>
                {selectedImage?.width ?? DEFAULT_IMAGE_SIZE.width} x{" "}
                {selectedImage?.height ?? DEFAULT_IMAGE_SIZE.height} · 28 steps
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Generate placeholder"
              onPress={(event) => event.stopPropagation()}
              style={({ pressed }) => [
                styles.dockGenerateButton,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name="sparkles"
                size={17}
                color={theme.color.onAccent}
              />
            </Pressable>
          </Pressable>
        </Reanimated.View>

        <Reanimated.View
          animatedProps={panelAnimatedProps}
          style={[styles.detailPanel, panelAnimatedStyle]}
        >
          <GestureDetector gesture={panelPanGesture}>
            <Reanimated.View style={styles.detailPanelHeader}>
              <View style={styles.panelHandleArea}>
                <View style={styles.panelHandle} />
              </View>
              <View style={styles.panelTitleRow}>
                <Text style={styles.panelTitle}>{PANEL_TITLES[panelTab]}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="디테일 패널 닫기"
                  hitSlop={8}
                  onPress={closePanel}
                  style={({ pressed }) => [
                    styles.panelCloseButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons
                    name="close"
                    size={24}
                    color={theme.color.textSecondary}
                  />
                </Pressable>
              </View>
            </Reanimated.View>
          </GestureDetector>
          <View style={styles.panelShellBody}>
            <Ionicons
              name="swap-vertical-outline"
              size={28}
              color={theme.color.accent}
            />
            <Text style={styles.panelShellTitle}>Motion shell</Text>
            <Text style={styles.panelShellDescription}>
              패널 콘텐츠 없이 2단계 morph와 닫기 제스처만 검증합니다.
            </Text>
          </View>
        </Reanimated.View>

        <Reanimated.View
          animatedProps={fullContentAnimatedProps}
          style={[styles.imageActionsRow, imageActionsAnimatedStyle]}
        >
          <View style={styles.imageActionsPill}>
            {IMAGE_ACTIONS.map((icon, index) => (
              <Pressable
                key={icon}
                accessibilityRole="button"
                accessibilityLabel={icon}
                style={({ pressed }) => [
                  styles.imageAction,
                  index > 0 && styles.imageActionDivider,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name={icon}
                  size={16}
                  color={theme.color.textTertiary}
                />
              </Pressable>
            ))}
          </View>
        </Reanimated.View>

          <Reanimated.View
            animatedProps={fullContentAnimatedProps}
            style={[styles.fullBottom, fullContentAnimatedStyle]}
          >
          <LinearGradient
            colors={["transparent", theme.color.sheet]}
            locations={[0, 0.28]}
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
          />
          <ScrollView
            horizontal
            contentContainerStyle={styles.entryBadges}
            showsHorizontalScrollIndicator={false}
          >
            {ENTRY_BADGES.map((badge) => (
              <Pressable
                key={badge.label}
                accessibilityRole="button"
                accessibilityLabel={badge.label}
                onPress={() => openPanel(badge.id)}
                style={({ pressed }) => [
                  styles.entryBadge,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name={badge.icon}
                  size={15}
                  color={theme.color.textSecondary}
                />
                <Text style={styles.entryBadgeLabel}>{badge.label}</Text>
                <Text style={styles.entryBadgeValue}>{badge.value}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.fullGenerateWrap}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Generate placeholder"
              style={({ pressed }) => [
                styles.fullGenerateButton,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name="sparkles"
                size={18}
                color={theme.color.onAccent}
              />
              <Text style={styles.fullGenerateLabel}>Generate</Text>
              <Text style={styles.fullGenerateCost}>0 Anlas</Text>
            </Pressable>
          </View>
          </Reanimated.View>
        </Reanimated.View>
      </GestureDetector>

      <BottomTabs
        activeTab={activeTab}
        animatedProps={tabBarAnimatedProps}
        animatedStyle={tabBarAnimatedStyle}
        onSelect={setActiveTab}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.color.app,
  },
  scrim: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 20,
    backgroundColor: theme.color.sheet,
  },
  generationSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    zIndex: 40,
    overflow: "hidden",
    borderTopLeftRadius: theme.radius.sheet,
    borderTopRightRadius: theme.radius.sheet,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.color.borderSubtle,
    backgroundColor: theme.color.sheet,
    shadowColor: theme.color.sheet,
    shadowOpacity: 0.6,
    shadowRadius: 50,
    shadowOffset: { width: 0, height: -18 },
    elevation: 24,
  },
  sheetHeader: {
    position: "relative",
  },
  miniBar: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  miniBarPressTarget: {
    flex: 1,
    paddingRight: 12,
    paddingLeft: 68,
    paddingBottom: theme.layout.miniBottomGap,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
  },
  miniCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  miniTitle: {
    color: theme.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: 13,
  },
  miniMeta: {
    color: theme.color.textMuted,
    fontFamily: monoFont,
    fontSize: 11,
  },
  miniGenerateButton: {
    height: 44,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.accent,
  },
  miniGenerateLabel: {
    color: theme.color.onAccent,
    fontFamily: tokens.font.bold,
    fontSize: 14,
  },
  fullHeader: {
    position: "absolute",
    left: theme.layout.mainInset,
    right: theme.layout.mainInset,
    height: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  collapseButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  fullHeaderCopy: {
    flex: 1,
    paddingRight: 32,
    alignItems: "center",
    gap: 2,
  },
  fullHeaderOverline: {
    color: theme.color.textTertiary,
    fontFamily: tokens.font.semibold,
    fontSize: 10,
    letterSpacing: 0.8,
  },
  fullHeaderTitle: {
    color: theme.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: 14,
  },
  sheetThumbnail: {
    position: "absolute",
    zIndex: 12,
    overflow: "hidden",
    backgroundColor: theme.color.panel,
  },
  imagePressTarget: {
    flex: 1,
    overflow: "hidden",
  },
  imagePickerHint: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  panelDock: {
    position: "absolute",
    left: 0,
    right: 0,
    top: theme.layout.dockTop,
    zIndex: 7,
    height: theme.layout.dockHeight,
  },
  panelDockPressTarget: {
    flex: 1,
    paddingRight: 12,
    paddingLeft: 70,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  panelDockCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  dockGenerateButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.accent,
  },
  detailPanel: {
    position: "absolute",
    left: 0,
    right: 0,
    top: theme.layout.panelTop,
    bottom: 0,
    zIndex: 9,
    overflow: "hidden",
    borderTopLeftRadius: theme.radius.panel,
    borderTopRightRadius: theme.radius.panel,
    backgroundColor: theme.color.panel,
    shadowColor: theme.color.sheet,
    shadowOpacity: 0.5,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: -12 },
    elevation: 18,
  },
  detailPanelHeader: {
    width: "100%",
  },
  panelHandleArea: {
    height: 26,
    alignItems: "center",
  },
  panelHandle: {
    width: 38,
    height: 4,
    marginTop: 9,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.panelHandle,
  },
  panelTitleRow: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  panelTitle: {
    flex: 1,
    color: theme.color.textPrimary,
    fontFamily: tokens.font.bold,
    fontSize: 24,
    letterSpacing: -0.4,
  },
  panelCloseButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  panelShellBody: {
    marginHorizontal: theme.layout.panelInset,
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 28,
    alignItems: "center",
    gap: 8,
    borderRadius: theme.radius.panelCard,
    borderWidth: 1,
    borderColor: theme.color.borderSubtle,
    backgroundColor: theme.color.card,
  },
  panelShellTitle: {
    color: theme.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: 16,
  },
  panelShellDescription: {
    maxWidth: 260,
    color: theme.color.textTertiary,
    fontFamily: tokens.font.regular,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  imageActionsRow: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 14,
    paddingHorizontal: theme.layout.mainInset,
    alignItems: "flex-end",
  },
  imageActionsPill: {
    height: theme.layout.imageActionHeight,
    paddingHorizontal: 2,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.card,
  },
  imageAction: {
    width: 40,
    height: theme.layout.imageActionHeight,
    alignItems: "center",
    justifyContent: "center",
  },
  imageActionDivider: {
    borderLeftWidth: 1,
    borderLeftColor: theme.color.borderSubtle,
  },
  fullBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 14,
    paddingTop: 12,
    paddingBottom: theme.layout.fullBottomPadding,
    gap: theme.layout.fullBottomGap,
  },
  entryBadges: {
    paddingHorizontal: theme.layout.mainInset,
    gap: 8,
  },
  entryBadge: {
    height: theme.layout.entryChipHeight,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.raised,
  },
  entryBadgeLabel: {
    color: theme.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: 12.5,
  },
  entryBadgeValue: {
    color: theme.color.textMuted,
    fontFamily: monoFont,
    fontSize: 11,
  },
  fullGenerateWrap: {
    height: theme.layout.fullGenerateHeight,
    paddingHorizontal: theme.layout.mainInset,
  },
  fullGenerateButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 16,
    backgroundColor: theme.color.accent,
  },
  fullGenerateLabel: {
    color: theme.color.onAccent,
    fontFamily: tokens.font.bold,
    fontSize: 16,
  },
  fullGenerateCost: {
    color: theme.color.onAccent,
    fontFamily: tokens.font.semibold,
    fontSize: 13,
    opacity: 0.65,
  },
  scrollContent: {
    paddingBottom: theme.layout.contentBottom,
  },
  mainContent: {
    paddingHorizontal: theme.layout.mainInset,
    gap: 12,
  },
  mainHeader: {
    paddingHorizontal: 2,
    paddingBottom: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: {
    color: theme.color.textPrimary,
    fontFamily: tokens.font.bold,
    fontSize: 22,
    letterSpacing: -0.3,
  },
  balancePill: {
    height: 34,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.color.borderSubtle,
    backgroundColor: theme.color.card,
  },
  balanceText: {
    color: theme.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: 13,
  },
  hero: {
    height: 300,
    overflow: "hidden",
    borderRadius: theme.radius.hero,
    backgroundColor: theme.color.cardAlt,
  },
  heroCaption: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 3,
  },
  heroTitle: {
    color: theme.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: 15,
  },
  heroMeta: {
    color: theme.color.textTertiary,
    fontFamily: monoFont,
    fontSize: 12,
  },
  masonry: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  masonryColumn: {
    flex: 1,
    gap: 10,
  },
  masonryTile: {
    overflow: "hidden",
    borderRadius: theme.radius.tile,
    backgroundColor: theme.color.cardAlt,
  },
  historyContent: {
    gap: 2,
  },
  historyGroup: {
    paddingBottom: 14,
    gap: 6,
  },
  historyHeader: {
    paddingHorizontal: theme.layout.mainInset,
    paddingTop: 10,
    paddingBottom: 2,
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  historyTitle: {
    color: theme.color.textPrimary,
    fontFamily: tokens.font.bold,
    fontSize: 15,
  },
  historyCount: {
    color: theme.color.textMuted,
    fontFamily: tokens.font.regular,
    fontSize: 12,
  },
  historyGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 2,
  },
  historyTile: {
    overflow: "hidden",
    backgroundColor: theme.color.cardAlt,
  },
  stackBadge: {
    position: "absolute",
    right: 5,
    bottom: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  stackCount: {
    color: theme.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: 10,
  },
  settingsContent: {
    paddingHorizontal: theme.layout.panelInset,
    gap: 16,
  },
  settingsTitle: {
    color: theme.color.textPrimary,
    fontFamily: tokens.font.bold,
    fontSize: 26,
    letterSpacing: -0.4,
  },
  accountCard: {
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: theme.radius.account,
    borderWidth: 1,
    borderColor: theme.color.borderSubtle,
    backgroundColor: theme.color.card,
  },
  avatar: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.accent,
  },
  avatarText: {
    color: theme.color.onAccent,
    fontFamily: tokens.font.bold,
    fontSize: 17,
  },
  accountCopy: {
    flex: 1,
    gap: 2,
  },
  accountName: {
    color: theme.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: 15,
  },
  accountPlan: {
    color: theme.color.accent,
    fontFamily: tokens.font.semibold,
    fontSize: 12,
  },
  settingsList: {
    overflow: "hidden",
    borderRadius: theme.radius.hero,
    borderWidth: 1,
    borderColor: theme.color.borderSubtle,
    backgroundColor: theme.color.card,
  },
  settingsDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
    backgroundColor: theme.color.borderSubtle,
  },
  settingsRow: {
    height: 54,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  settingsRowLabel: {
    flex: 1,
    color: theme.color.textPrimary,
    fontFamily: tokens.font.regular,
    fontSize: 15,
  },
  tabBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
    height: theme.layout.tabBarHeight,
    paddingHorizontal: 22,
    paddingBottom: theme.layout.tabBarBottomPadding,
    flexDirection: "row",
    alignItems: "center",
  },
  tabButton: {
    flex: 1,
    paddingTop: 10,
    alignItems: "center",
    gap: 4,
  },
  tabLabel: {
    fontFamily: tokens.font.semibold,
    fontSize: 10,
    letterSpacing: 0.3,
  },
  pressed: {
    opacity: 0.7,
  },
});
