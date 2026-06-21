import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  BackHandler,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import BottomSheet, {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  type BottomSheetScrollViewMethods,
} from "@gorhom/bottom-sheet";

import type { GenerationRecord } from "../../lib/generationHistory";
import { BaseSheet } from "./BaseSheet";
import { MetadataViewContent } from "./MetadataViewContent";
import { light, styles as homeStyles } from "./styles";

export type MetadataSheetHandle = {
  open: (record: GenerationRecord) => void;
  close: () => void;
  // 열려있으면 닫고 true 반환 (Modal 내부 onRequestClose 가로채기용).
  requestCloseIfOpen: () => boolean;
};

export const MetadataSheet = forwardRef<MetadataSheetHandle>(
  function MetadataSheet(_props, ref) {
    const sheetRef = useRef<BottomSheet>(null);
    const scrollRef = useRef<BottomSheetScrollViewMethods>(null);
    const openRef = useRef(false);
    const pendingExpandRef = useRef(false);
    const { height } = useWindowDimensions();
    const [record, setRecord] = useState<GenerationRecord | null>(null);
    // open() 마다 증가 → 컨텐츠 remount 키. onLayout 발화를 보장한다.
    const [openSeq, setOpenSeq] = useState(0);

    // 새 record 컨텐츠 레이아웃 완료 신호. 측정이 gorhom 에 반영되도록 한 프레임
    // 양보한 뒤 펼친다 (이중 측정 방지). pendingExpandRef 로 open 당 1회만.
    const handleContentLayout = useCallback(() => {
      if (!pendingExpandRef.current) return;
      pendingExpandRef.current = false;
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ y: 0, animated: false });
        sheetRef.current?.expand();
      });
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        open: (next) => {
          setRecord(next);
          // expand 는 open() 에서 직접 호출하지 않는다. openSeq 를 올려 컨텐츠를
          // remount → 새 record 가 레이아웃된 뒤 onLayout 에서 측정 완료 시점에
          // 펼친다 (blind rAF 의 "작게 열렸다 커짐" 이중 측정 깜빡임 제거).
          pendingExpandRef.current = true;
          setOpenSeq((n) => n + 1);
        },
        close: () => sheetRef.current?.close(),
        requestCloseIfOpen: () => {
          if (!openRef.current) return false;
          sheetRef.current?.close();
          return true;
        },
      }),
      [],
    );

    // 안드로이드 하드웨어 백: 시트 열려있으면 닫음 (Modal 밖 = 메인페이지 경로).
    useEffect(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        if (!openRef.current) return false;
        sheetRef.current?.close();
        return true;
      });
      return () => sub.remove();
    }, []);

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          pressBehavior="close"
        />
      ),
      [],
    );

    return (
      <BaseSheet
        sheetRef={sheetRef}
        scrollRef={scrollRef}
        sheetKey="metadata"
        onSheetChange={(_key, index) => {
          openRef.current = index >= 0;
        }}
        renderBackdrop={renderBackdrop}
        enableDynamicSizing
        maxDynamicContentSize={height * 0.9}
        stickyHeaderIndices={[0]}
      >
        <View style={ms.stickyHeader}>
          <Text style={homeStyles.sheetTitle}>메타데이터</Text>
        </View>

        <View key={openSeq} onLayout={handleContentLayout}>
          {record ? <MetadataViewContent record={record} /> : null}
        </View>
      </BaseSheet>
    );
  },
);

const ms = StyleSheet.create({
  stickyHeader: {
    backgroundColor: light.bg,
  },
});
