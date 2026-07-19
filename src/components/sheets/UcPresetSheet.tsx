import { memo, useCallback } from "react";

import { SelectionSheet } from "./SelectionSheet";
import {
  UC_PRESET_OPTIONS,
  type SelectableUcPresetIndex,
} from "../../lib/naiPresets";
import { useGenerationStore } from "../../store/generationStore";

export const UcPresetSheet = memo(function UcPresetSheet({
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
    <SelectionSheet
      options={UC_PRESET_OPTIONS}
      selectedValue={selectedPreset}
      onSelect={handleSelect}
    />
  );
});
