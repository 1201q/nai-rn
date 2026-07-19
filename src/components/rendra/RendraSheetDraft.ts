type RendraSheetDraftId =
  | "seed"
  | "resolutionCustom"
  | "characterOrder"
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
