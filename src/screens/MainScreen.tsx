import { useEffect, useState } from "react";
import { Keyboard, StyleSheet, View } from "react-native";
import PagerView from "react-native-pager-view";

import { MainPage } from "./main/MainPage";
import { PromptPage } from "./main/PromptPage";
import { HistoryScreen } from "./HistoryScreen";

export function MainScreen() {
  const [isHistorySelectionMode, setIsHistorySelectionMode] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [isMainSheetOpen, setIsMainSheetOpen] = useState(false);

  useEffect(() => {
    const showSubscription = Keyboard.addListener("keyboardDidShow", () => {
      setIsKeyboardVisible(true);
    });
    const hideSubscription = Keyboard.addListener("keyboardDidHide", () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  return (
    <PagerView
      style={styles.pager}
      initialPage={1}
      scrollEnabled={
        !isHistorySelectionMode && !isKeyboardVisible && !isMainSheetOpen
      }
    >
      <View key="prompt" style={styles.page}>
        <PromptPage />
      </View>
      <View key="main" style={styles.page}>
        <MainPage onSheetOpenChange={setIsMainSheetOpen} />
      </View>
      <View key="history" style={styles.page}>
        <HistoryScreen onSelectionModeChange={setIsHistorySelectionMode} />
      </View>
    </PagerView>
  );
}

const styles = StyleSheet.create({
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
});
