import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TabBar, TabView } from "react-native-tab-view";

import { Header } from "../components/Header";
import { useGenerationOptions } from "../context/GenerationOptionsContext";
import type { OptionScreenNavigationProp } from "../navigation/types";
import { colors } from "../styles/colors";
import { OptionTabScene, optionTabRoutes } from "./option/OptionTabs";
import { styles } from "./option/styles";

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
    </View>
  );
}
