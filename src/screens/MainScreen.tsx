import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, StyleSheet, View } from "react-native";
import PagerView from "react-native-pager-view";

import { MainPage } from "./main/MainPage";
import { PromptPage } from "./main/PromptPage";
import { HistoryScreen } from "./HistoryScreen";
import { useAppSheet } from "../context/AppSheetContext";

export function MainScreen() {
  const [isHistorySelectionMode, setIsHistorySelectionMode] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  // 메인의 옵션 패널 클릭 → 프롬프트 페이지로 스크롤 + 옵션 탭 활성화.
  const [optionsRequestSeq, setOptionsRequestSeq] = useState(0);
  const pagerRef = useRef<PagerView>(null);
  const { isOpen: isSheetOpen } = useAppSheet();

  const requestOptions = useCallback(() => {
    pagerRef.current?.setPage(0);
    setOptionsRequestSeq((n) => n + 1);
  }, []);

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
        <PromptPage focusOptionsSignal={optionsRequestSeq} />
      </View>
    ),
    [optionsRequestSeq],
  );
  const mainPage = useMemo(
    () => (
      <View key="main" style={styles.page}>
        <MainPage requestOptions={requestOptions} />
      </View>
    ),
    [requestOptions],
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
      ref={pagerRef}
      style={styles.pager}
      initialPage={1}
      scrollEnabled={
        !isHistorySelectionMode && !isKeyboardVisible && !isSheetOpen
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
