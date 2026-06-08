import { StyleSheet, View } from "react-native";
import PagerView from "react-native-pager-view";

import { MainPage } from "./main/MainPage";
import { PromptPage } from "./main/PromptPage";
import { HistoryScreen } from "./HistoryScreen";

export function MainScreen() {
  return (
    <PagerView style={styles.pager} initialPage={1}>
      <View key="prompt" style={styles.page}>
        <PromptPage />
      </View>
      <View key="main" style={styles.page}>
        <MainPage />
      </View>
      <View key="history" style={styles.page}>
        <HistoryScreen />
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
