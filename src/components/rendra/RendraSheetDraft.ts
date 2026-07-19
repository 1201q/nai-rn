export type RendraSheetDraftId =
  | "seed"
  | "resolutionCustom"
  | "metadataImport";

export type RendraSheetDraftController = {
  id: RendraSheetDraftId;
  dirty: boolean;
  canSave: boolean;
  promptTitle: string;
  promptMessage: string;
  save: () => boolean;
};

export type RegisterRendraSheetDraft = (
  controller: RendraSheetDraftController | null,
) => void;
