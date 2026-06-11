import { useEffect, useMemo, useState } from "react";
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

  const promptPage = useMemo(
    () => (
      <View key="prompt" style={styles.page}>
        <PromptPage />
      </View>
    ),
    [],
  );
  const mainPage = useMemo(
    () => (
      <View key="main" style={styles.page}>
        <MainPage onSheetOpenChange={setIsMainSheetOpen} />
      </View>
    ),
    [],
  );
  const historyPage = useMemo(
    () => (
      <View key="history" style={styles.page}>
        <HistoryScreen onSelectionModeChange={setIsHistorySelectionMode} />
      </View>
    ),
    [],
  );

  return (
    <PagerView
      style={styles.pager}
      initialPage={1}
      scrollEnabled={
        !isHistorySelectionMode && !isKeyboardVisible && !isMainSheetOpen
      }
    >
      {promptPage}
      {mainPage}
      {historyPage}
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
