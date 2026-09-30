import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GestureDetector } from "react-native-gesture-handler";
import Reanimated from "react-native-reanimated";

import { GENERATION_SHEET_HEADER_HEIGHT } from "../../../../hooks/useGenerationChromeMetrics";
import type { MetadataSheetSource } from "./MetadataSheetContent";
import { tokens } from "../../../../styles/tokens";
import { PressableSurface } from "../SheetLayers";
import { MetadataImportContent } from "./MetadataImportContent";
import { MetadataSheetContent } from "./MetadataSheetContent";
import { useHorizontalPager } from "../useHorizontalPager";

type MetadataTab = "metadata" | "import";

const TABS: ReadonlyArray<{ key: MetadataTab; label: string }> = [
  { key: "metadata", label: "Metadata" },
  { key: "import", label: "Import" },
];

export const MetadataSheetPager = memo(function MetadataSheetPager({
  generation,
  onClose,
  controller,
}: {
  generation: MetadataSheetSource;
  onClose: () => void;
  controller: MetadataSheetPagerController;
}) {
  const { tab, changeTab, pageGesture, pageTrackStyle, windowWidth } =
    controller;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View accessibilityRole="tablist" style={styles.tabs}>
          {TABS.map((item) => {
            const active = item.key === tab;
            return (
              <Pressable
                key={item.key}
                accessibilityRole="tab"
                accessibilityLabel={item.label}
                accessibilityState={{ selected: active }}
                onPress={() => changeTab(item.key)}
                style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
              >
                <Text
                  style={[styles.tabLabel, active && styles.tabLabelActive]}
                >
                  {item.label}
                </Text>
                <View
                  style={[
                    styles.tabIndicator,
                    active && styles.tabIndicatorActive,
                  ]}
                />
              </Pressable>
            );
          })}
        </View>
        <PressableSurface
          accessibilityLabel="Metadata 닫기"
          onPress={onClose}
          style={styles.closeButton}
        >
          <Ionicons name="close" size={21} color={tokens.color.textPrimary} />
        </PressableSurface>
      </View>

      <GestureDetector gesture={pageGesture}>
        <View style={styles.pageViewport}>
          <Reanimated.View
            style={[
              styles.pageTrack,
              { width: windowWidth * TABS.length },
              pageTrackStyle,
            ]}
          >
            {TABS.map((item) => {
              const active = item.key === tab;
              return (
                <View
                  key={item.key}
                  testID={`metadata-page-${item.key}`}
                  accessibilityElementsHidden={!active}
                  importantForAccessibility={
                    active ? "auto" : "no-hide-descendants"
                  }
                  style={[styles.page, { width: windowWidth }]}
                >
                  {item.key === "metadata" ? (
                    <MetadataSheetContent generation={generation} />
                  ) : (
                    <MetadataImportContent
                      generation={generation}
                      onImported={onClose}
                    />
                  )}
                </View>
              );
            })}
          </Reanimated.View>
        </View>
      </GestureDetector>
    </View>
  );
});

export function useMetadataSheetPagerController() {
  return useHorizontalPager(TABS);
}

export type MetadataSheetPagerController = ReturnType<
  typeof useMetadataSheetPagerController
>;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: GENERATION_SHEET_HEADER_HEIGHT,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.color.borderSubtle,
    flexDirection: "row",
    alignItems: "stretch",
  },
  tabs: {
    flex: 1,
    flexDirection: "row",
    overflow: "hidden",
  },
  tab: {
    minWidth: 0,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  tabLabel: {
    color: tokens.color.textMuted,
    fontFamily: tokens.font.semibold,
    fontSize: 15,
  },
  tabLabelActive: {
    color: tokens.color.textPrimary,
  },
  tabIndicator: {
    position: "absolute",
    right: 12,
    bottom: 0,
    left: 12,
    height: 2,
    backgroundColor: "transparent",
  },
  tabIndicatorActive: {
    backgroundColor: tokens.color.accent,
  },
  closeButton: {
    width: 34,
    height: 34,
    marginTop: 2,
    marginLeft: 4,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.raised,
  },
  pageViewport: {
    flex: 1,
    overflow: "hidden",
  },
  pageTrack: {
    flex: 1,
    flexDirection: "row",
  },
  page: {
    height: "100%",
  },
  pressed: {
    opacity: 0.65,
  },
});
