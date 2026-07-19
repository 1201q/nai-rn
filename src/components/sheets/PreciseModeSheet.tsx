import { useCallback } from "react";

import type { PreciseReferenceType } from "../../lib/preciseReferences";
import { useGenerationStore } from "../../store/generationStore";
import {
  SelectionSheet,
  type SelectionOption,
} from "./SelectionSheet";

const MODE_OPTIONS: readonly SelectionOption<PreciseReferenceType>[] = [
  { label: "Both", value: "character&style" },
  { label: "Character", value: "character" },
  { label: "Style", value: "style" },
];

export function PreciseModeSheet({
  referenceId,
  onSelect,
}: {
  referenceId: string;
  onSelect: () => void;
}) {
  const selectedValue = useGenerationStore(
    (state) =>
      state.preciseReferences.find((item) => item.id === referenceId)
        ?.referenceType,
  );
  const setType = useGenerationStore(
    (state) => state.setPreciseReferenceType,
  );

  const handleSelect = useCallback(
    (value: PreciseReferenceType) => {
      setType(referenceId, value);
      onSelect();
    },
    [onSelect, referenceId, setType],
  );

  if (!selectedValue) return null;

  return (
    <SelectionSheet
      options={MODE_OPTIONS}
      selectedValue={selectedValue}
      onSelect={handleSelect}
    />
  );
}
