import { useCallback, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import PagerView from "react-native-pager-view";

import { useAppSheetOpen } from "../../context/AppSheetContext";
import { GenerationScreen } from "../generation/GenerationScreen";
import { HistoryScreen } from "../history/HistoryScreen";

const MAIN_PAGE = 0;
const HISTORY_PAGE = 1;

export function MainPagerScreen({
  initialPage = MAIN_PAGE,
}: {
  initialPage?: number;
}) {
  const pagerRef = useRef<PagerView>(null);
  const isSheetOpen = useAppSheetOpen();
  const [isHistoryPagingEnabled, setIsHistoryPagingEnabled] = useState(true);

  const openHistory = useCallback(() => {
    pagerRef.current?.setPage(HISTORY_PAGE);
  }, []);

  return (
    <PagerView
      ref={pagerRef}
      initialPage={initialPage}
      scrollEnabled={isHistoryPagingEnabled && !isSheetOpen}
      style={styles.pager}
    >
      <View key="main" collapsable={false} style={styles.page}>
        <GenerationScreen onOpenHistory={openHistory} />
      </View>
      <View key="history" collapsable={false} style={styles.page}>
        <HistoryScreen onPagingEnabledChange={setIsHistoryPagingEnabled} />
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
