import { useRef } from "react";
import { StyleSheet, View } from "react-native";
import PagerView from "react-native-pager-view";

import { MainPage } from "./main/MainPage";
import { PromptPage } from "./main/PromptPage";
import { HistoryScreen } from "./HistoryScreen";

export function MainScreen() {
  const pagerRef = useRef<PagerView>(null);
  const goToPage = (index: number) => pagerRef.current?.setPage(index);

  return (
    <PagerView ref={pagerRef} style={styles.pager} initialPage={1}>
      <View key="prompt" style={styles.page}>
        <PromptPage />
      </View>
      <View key="main" style={styles.page}>
        <MainPage onOpenHistory={() => goToPage(2)} />
      </View>
      <View key="history" style={styles.page}>
        <HistoryScreen onBack={() => goToPage(1)} />
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
