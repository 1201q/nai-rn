type SheetDraftId =
  | "seed"
  | "resolutionCustom"
  | "characterOrder"
  | "metadataImport";

export type SheetDraftController = {
  id: SheetDraftId;
  dirty: boolean;
  canSave: boolean;
  promptTitle: string;
  promptMessage: string;
  save: () => boolean;
};

export type RegisterSheetDraft = (
  controller: SheetDraftController | null,
) => void;
