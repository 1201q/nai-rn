import { memo } from "react";
import { Platform, StyleSheet } from "react-native";

import { useGenerationChromeMetrics } from "../../hooks/useGenerationChromeMetrics";
import { BottomSheetKeyboardAwareScrollView } from "./BottomSheetKeyboardAwareScrollView";
import { ImageToImageReferenceCard } from "./referenceImages/ImageToImageReferenceCard";
import { MetadataExtractCard } from "./referenceImages/MetadataExtractCard";
import { PreciseReferenceCard } from "./referenceImages/PreciseReferenceCard";
import { VibeReferenceCard } from "./referenceImages/VibeReferenceCard";

export {
  ImageToImageReferenceCard,
  MetadataExtractCard,
  PreciseReferenceCard,
  VibeReferenceCard,
};

export const ReferenceImagesSheetContent = memo(
  function ReferenceImagesSheetContent({
    active,
    sheetHiddenHeight = 0,
    onMetadataExtract,
  }: {
    active: boolean;
    sheetHiddenHeight?: number;
    onMetadataExtract?: (metadataJson: string) => void;
  }) {
    const { sheetContentPaddingBottom } = useGenerationChromeMetrics();
    return (
      <BottomSheetKeyboardAwareScrollView
        active={active}
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: sheetContentPaddingBottom + sheetHiddenHeight },
        ]}
        bottomOffset={-sheetHiddenHeight}
        mode={Platform.OS === "android" ? "layout" : "insets"}
        removeClippedSubviews={false}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <ImageToImageReferenceCard />
        <VibeReferenceCard />
        <PreciseReferenceCard active={active} />
        {onMetadataExtract ? (
          <MetadataExtractCard onExtract={onMetadataExtract} />
        ) : null}
      </BottomSheetKeyboardAwareScrollView>
    );
  },
);

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 14, gap: 12 },
});
