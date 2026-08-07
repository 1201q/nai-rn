import {
  CustomResolutionEditor,
} from "../../components/sheets/CustomResolutionSheet";
import {
  GenerationOptionSheet,
  type GenerationOptionRoute,
} from "../../components/sheets/GenerationOptionSheet";
import { ResolutionSheet } from "../../components/sheets/ResolutionSheet";
import { SeedEditor } from "../../components/sheets/SeedSheet";
import type { RegisterSheetDraft } from "../../components/sheets/SheetDraft";

export type PlayerPanelDetail =
  | GenerationOptionRoute
  | "resolution"
  | "resolutionCustom"
  | "seed";

export const PLAYER_PANEL_DETAIL_TITLES: Record<PlayerPanelDetail, string> = {
  model: "Model",
  resolution: "Resolution",
  resolutionCustom: "Custom Resolution",
  seed: "Seed",
  sampler: "Sampler",
  schedule: "Schedule",
};

export function PlayerSettingDetailContent({
  detail,
  onCommitAndReturnToSettings,
  onOpenDetail,
  registerDraft,
}: {
  detail: PlayerPanelDetail;
  onCommitAndReturnToSettings: () => void;
  onOpenDetail: (detail: PlayerPanelDetail) => void;
  registerDraft: RegisterSheetDraft;
}) {
  if (detail === "seed") {
    return (
      <SeedEditor
        nativeInput
        onSaveAndClose={onCommitAndReturnToSettings}
        registerDraft={registerDraft}
      />
    );
  }

  if (detail === "resolution") {
    return (
      <ResolutionSheet
        onOpenCustom={() => onOpenDetail("resolutionCustom")}
        onSelect={onCommitAndReturnToSettings}
      />
    );
  }

  if (detail === "resolutionCustom") {
    return (
      <CustomResolutionEditor nativeInput registerDraft={registerDraft} />
    );
  }

  return (
    <GenerationOptionSheet
      route={detail}
      onSelect={onCommitAndReturnToSettings}
    />
  );
}
