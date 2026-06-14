import React from "react";
import { type BottomSheetBackdropProps } from "@gorhom/bottom-sheet";

import { OptionsSheet, type OptionsSheetHandle } from "./OptionsSheet";

// Main options share one BottomSheet instance and switch content by route.
export function OptionSheets({
  optionsRef,
  onOptionsOpenChange,
  renderBackdrop,
}: {
  optionsRef: React.RefObject<OptionsSheetHandle | null>;
  onOptionsOpenChange: (open: boolean) => void;
  renderBackdrop: (props: BottomSheetBackdropProps) => React.ReactElement;
}) {
  return (
    <OptionsSheet
      ref={optionsRef}
      onOpenChange={onOptionsOpenChange}
      renderBackdrop={renderBackdrop}
    />
  );
}
