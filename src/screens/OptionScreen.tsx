import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TabBar, TabView } from "react-native-tab-view";
import { KeyboardStickyView } from "react-native-keyboard-controller";

import { Header } from "../components/Header";
import { useGenerationOptions } from "../context/GenerationOptionsContext";
import {
  SuggestionBarProvider,
  useSuggestionBarActions,
  useSuggestions,
} from "../context/SuggestionBarContext";
import type { OptionScreenNavigationProp } from "../navigation/types";
import type { TagType } from "../lib/tagDb";
import { colors } from "../styles/colors";
import { OptionTabScene, optionTabRoutes } from "./option/OptionTabs";
import { styles } from "./option/styles";

const TAG_TYPE_COLORS: Record<TagType, string> = {
  general: colors.blue500,
  artist: colors.orange500,
  character: colors.green500,
  copyright: colors.purple500,
};

function SuggestionBarWidget() {
  const suggestions = useSuggestions();
  const actions = useSuggestionBarActions();

  if (!suggestions.length || !actions) return null;

  return (
    <View style={barStyles.bar}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={barStyles.scroll}
        keyboardShouldPersistTaps="always"
      >
        {suggestions.map((item, i) => (
          <Pressable
            key={`${item.label}-${i}`}
            style={({ pressed }) => [
              barStyles.chip,
              pressed && barStyles.chipPressed,
            ]}
            onPress={() => actions.pickRef.current?.(item)}
          >
            <View
              style={[
                barStyles.dot,
                { backgroundColor: TAG_TYPE_COLORS[item.type] },
              ]}
            />
            <Text style={barStyles.chipText} numberOfLines={1}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

export function OptionScreen() {
  const insets = useSafeAreaInsets();
  const layout = useWindowDimensions();

  const navigation = useNavigation<OptionScreenNavigationProp>();
  const {
    prompt,
    setPrompt,
    negativePrompt,
    setNegativePrompt,
    characterPrompts,
    setCharacterPrompts,
    optionTabIndex,
    setOptionTabIndex,
    hasLoadedOptions,
    isLoading,
    generateImage,
  } = useGenerationOptions();

  return (
    <SuggestionBarProvider>
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <Header title="Prompt" onBack={() => navigation.goBack()} />

        <TabView
          style={styles.tabView}
          initialLayout={{ width: layout.width }}
          navigationState={{ index: optionTabIndex, routes: optionTabRoutes }}
          onIndexChange={setOptionTabIndex}
          renderTabBar={(props) => (
            <TabBar
              {...props}
              style={styles.tabBar}
              indicatorStyle={styles.tabIndicator}
              activeColor={colors.colorTextPrimary}
              inactiveColor={colors.colorTextTertiary}
            />
          )}
          renderScene={({ route }) => (
            <OptionTabScene
              route={route}
              hasLoadedOptions={hasLoadedOptions}
              prompt={prompt}
              setPrompt={setPrompt}
              negativePrompt={negativePrompt}
              setNegativePrompt={setNegativePrompt}
              characterPrompts={characterPrompts}
              setCharacterPrompts={setCharacterPrompts}
            />
          )}
        />

        <View style={[styles.footer, { paddingBottom: insets.bottom + 18 }]}>
          <TouchableOpacity
            style={[styles.generateButton, isLoading && styles.disabledButton]}
            activeOpacity={0.82}
            onPress={() => generateImage(() => navigation.goBack())}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.colorTextInverse} />
            ) : (
              <Text style={styles.generateText}>Generate</Text>
            )}
          </TouchableOpacity>
        </View>

        <KeyboardStickyView
          style={barStyles.sticky}
          offset={{ closed: 0, opened: 0 }}
        >
          <SuggestionBarWidget />
        </KeyboardStickyView>
      </View>
    </SuggestionBarProvider>
  );
}

const barStyles = StyleSheet.create({
  sticky: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    elevation: 20,
  },
  bar: {
    height: 70,
    backgroundColor: colors.colorBackgroundSecondary,
    borderTopWidth: 1,
    borderTopColor: colors.colorBorderTertiary,
    justifyContent: "center",
  },
  scroll: {
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    height: 36,
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: colors.colorBackgroundTertiary,
  },
  chipPressed: {
    opacity: 0.7,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chipText: {
    color: colors.colorTextPrimary,
    fontSize: 14,
    maxWidth: 180,
  },
});
