import React, { type ComponentProps } from "react";
import BottomSheet, {
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";

import { styles } from "./styles";
import type { SheetKey } from "./OptionSheets";

type BSProps = ComponentProps<typeof BottomSheet>;

// 모든 옵션 시트가 공유하는 셸. 각 호출이 별도 BottomSheet 인스턴스를 만든다
// (인스턴스 공유 금지 — 교차클릭 시 높이/위치 버그, Android 뒤로가기 오작동).
// 셸 공통 prop 만 모으고 snapPoints/enableDynamicSizing/keyboard 등 시트별 차이는
// 그대로 패스스루. enableDynamicSizing 은 필수 — 호출측이 반드시 명시해 측정 버그 방지.
export function BaseSheet({
  sheetRef,
  sheetKey,
  onSheetChange,
  renderBackdrop,
  snapPoints,
  enableDynamicSizing,
  maxDynamicContentSize,
  keyboardBehavior,
  keyboardBlurBehavior,
  stickyHeaderIndices,
  children,
}: {
  sheetRef: React.RefObject<BottomSheet | null>;
  sheetKey: SheetKey;
  onSheetChange: (sheet: SheetKey, index: number) => void;
  renderBackdrop: (props: BottomSheetBackdropProps) => React.ReactElement;
  snapPoints?: BSProps["snapPoints"];
  enableDynamicSizing: boolean;
  maxDynamicContentSize?: number;
  keyboardBehavior?: BSProps["keyboardBehavior"];
  keyboardBlurBehavior?: BSProps["keyboardBlurBehavior"];
  stickyHeaderIndices?: number[];
  children: React.ReactNode;
}) {
  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      style={styles.sheetContainer}
      containerStyle={styles.sheetContainer}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.sheetHandle}
      enableDynamicSizing={enableDynamicSizing}
      maxDynamicContentSize={maxDynamicContentSize}
      keyboardBehavior={keyboardBehavior}
      keyboardBlurBehavior={keyboardBlurBehavior}
      onChange={(index) => onSheetChange(sheetKey, index)}
    >
      <BottomSheetScrollView
        contentContainerStyle={styles.sheetScrollContent}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={stickyHeaderIndices}
      >
        {children}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}
