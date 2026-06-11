import React from "react";
import { Dimensions } from "react-native";
import BottomSheet, {
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";

import { ImageUploadSheet } from "./ImageUploadSheet";
import { BaseSheet } from "./BaseSheet";
import { OptionsSheet, type OptionsSheetHandle } from "./OptionsSheet";

// 값 옵션은 OptionsSheet 단일 인스턴스(시트 내 라우팅)로 통합.
// imageImport(이미지 업로드)는 dynamic sizing + sticky header 라 별도 시트 유지.
export function OptionSheets({
  optionsRef,
  imageImportRef,
  onOptionsOpenChange,
  onSheetChange,
  renderBackdrop,
}: {
  optionsRef: React.RefObject<OptionsSheetHandle | null>;
  imageImportRef: React.RefObject<BottomSheet | null>;
  onOptionsOpenChange: (open: boolean) => void;
  onSheetChange: (sheet: string, index: number) => void;
  renderBackdrop: (props: BottomSheetBackdropProps) => React.ReactElement;
}) {
  return (
    <>
      <OptionsSheet
        ref={optionsRef}
        onOpenChange={onOptionsOpenChange}
        renderBackdrop={renderBackdrop}
        onRequestImageImport={() => {
          optionsRef.current?.close();
          imageImportRef.current?.snapToIndex(0);
        }}
      />

      <BaseSheet
        sheetRef={imageImportRef}
        sheetKey="imageImport"
        onSheetChange={onSheetChange}
        renderBackdrop={renderBackdrop}
        enableDynamicSizing
        maxDynamicContentSize={Dimensions.get("window").height * 0.92}
        stickyHeaderIndices={[0]}
      >
        <ImageUploadSheet
          onClose={() => imageImportRef.current?.close()}
        />
      </BaseSheet>
    </>
  );
}
