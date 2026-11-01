import { PromptChunksSheetContent } from "../../../components/generation/PromptChunksSheetContent";
import { PromptSheetContent } from "../../../components/generation/PromptSheetContent";
import { ReferenceImagesSheetContent } from "../../../components/generation/ReferenceImagesSheetContent";
import { useGenerationStore } from "../../../store/generationStore";
import type { SharedValue } from "react-native-reanimated";
import { TabbedSheetHost, type TabbedSheetStage } from "./TabbedSheetHost";

export type PromptSheetStage = TabbedSheetStage;

export function PromptSheetHost({
  promptPreview,
  promptStage,
  predictiveBackProgress,
  onPromptStageChange,
  onMetadataExtract,
  onEditCharacterPositions,
  positionEditing = false,
}: {
  onEditCharacterPositions: (characterId: string | null) => void;
  positionEditing?: boolean;
  promptPreview: string;
  promptStage: PromptSheetStage;
  predictiveBackProgress: SharedValue<number>;
  onPromptStageChange: (stage: PromptSheetStage) => void;
  onMetadataExtract?: (metadataJson: string) => void;
}) {
  const referenceCount = useGenerationStore(
    (state) =>
      (state.i2iSourceImage && state.i2iEnabled ? 1 : 0) +
      state.vibeReferences.filter((reference) => reference.enabled).length +
      state.preciseReferences.filter((reference) => reference.enabled).length,
  );
  return (
    <TabbedSheetHost
      title="Prompt"
      preview={promptPreview.trim() || "Prompt를 입력하세요"}
      stage={promptStage}
      predictiveBackProgress={predictiveBackProgress}
      onStageChange={onPromptStageChange}
      tabs={[
        { key: "prompt", label: "Prompt" },
        { key: "reference", label: "Reference Images", count: referenceCount },
        { key: "chunks", label: "Chunks" },
      ]}
      renderPage={(key, active, sheetHiddenHeight) =>
        key === "prompt" ? (
          <PromptSheetContent
            active={active}
            sheetHiddenHeight={sheetHiddenHeight}
            onEditCharacterPositions={onEditCharacterPositions}
            positionEditing={positionEditing}
          />
        ) : key === "reference" ? (
          <ReferenceImagesSheetContent
            active={active}
            sheetHiddenHeight={sheetHiddenHeight}
            onMetadataExtract={onMetadataExtract}
          />
        ) : (
          <PromptChunksSheetContent
            active={active}
            sheetHiddenHeight={sheetHiddenHeight}
          />
        )
      }
    />
  );
}
