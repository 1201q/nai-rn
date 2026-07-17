import { memo, useCallback } from "react";

import { RendraSelectionSheet } from "./RendraSelectionSheet";
import {
  UC_PRESET_OPTIONS,
  type SelectableUcPresetIndex,
} from "../../lib/naiPresets";
import { useGenerationStore } from "../../store/generationStore";

export const RendraUcPresetSheet = memo(function RendraUcPresetSheet({
  onSelect,
}: {
  onSelect: () => void;
}) {
  const selectedPreset = useGenerationStore((state) => state.ucPreset);
  const setUcPreset = useGenerationStore((state) => state.setUcPreset);

  const handleSelect = useCallback(
    (value: SelectableUcPresetIndex) => {
      setUcPreset(value);
      onSelect();
    },
    [onSelect, setUcPreset],
  );

  return (
    <RendraSelectionSheet
      options={UC_PRESET_OPTIONS}
      selectedValue={selectedPreset}
      onSelect={handleSelect}
    />
  );
});
