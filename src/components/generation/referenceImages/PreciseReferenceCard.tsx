import { memo, useEffect, useState } from "react";

import { PRECISE_REFERENCE_COST } from "../../../lib/anlasCost";
import {
  MAX_PRECISE_REFERENCES,
  resolvePreciseReferenceThumbnailUri,
  resolvePreciseReferenceImageUri,
  type PreciseReferenceType,
} from "../../../lib/preciseReferences";
import { useGenerationStore } from "../../../store/generationStore";
import { SheetSelect } from "../../forms/SheetSelect";
import {
  ReferenceItem,
  ReferenceSection,
  ReferenceSlider,
} from "./ReferenceParts";
import { useReferenceUpload } from "./useReferenceUpload";

const MODES: { label: string; value: PreciseReferenceType }[] = [
  { label: "Character & Style", value: "character&style" },
  { label: "Style Only", value: "style" },
  { label: "Character Only", value: "character" },
];
const MODE_LABELS = MODES.map((mode) => mode.label);

export const PreciseReferenceCard = memo(function PreciseReferenceCard({
  active,
}: {
  active: boolean;
}) {
  const references = useGenerationStore((state) => state.preciseReferences);
  const { busy, pickImage } = useReferenceUpload("precise");
  const [openModeId, setOpenModeId] = useState<string | null>(null);
  useEffect(() => {
    if (!active) setOpenModeId(null);
  }, [active]);
  const state = useGenerationStore.getState;
  return (
    <ReferenceSection
      group
      title="Precise Reference"
      description="캐릭터나 스타일의 참조 이미지를 추가합니다."
      icon="albums-outline"
      count={references.length}
      activeCount={references.filter((reference) => reference.enabled).length}
      limit={MAX_PRECISE_REFERENCES}
      busy={busy}
      onAdd={() => void pickImage()}
    >
      {references.map((reference, index) => (
        <ReferenceItem
          key={reference.id}
          first={index === 0}
          name={`Precise ${index + 1}`}
          uri={
            resolvePreciseReferenceThumbnailUri(reference) ??
            resolvePreciseReferenceImageUri(reference)
          }
          enabled={reference.enabled}
          cost={reference.enabled ? `${PRECISE_REFERENCE_COST} Anlas` : "Off"}
          onToggle={(value) =>
            state().setPreciseReferenceEnabled(reference.id, value)
          }
          onRemove={() => void state().removePreciseReference(reference.id)}
        >
          <SheetSelect
            accessibilityLabel={`Precise ${index + 1} Mode`}
            value={
              MODES.find((mode) => mode.value === reference.referenceType)!
                .label
            }
            options={MODE_LABELS}
            open={active && openModeId === reference.id}
            onOpenChange={(open) => setOpenModeId(open ? reference.id : null)}
            onChange={(label) => {
              const mode = MODES.find((item) => item.label === label);
              if (mode)
                state().setPreciseReferenceType(reference.id, mode.value);
            }}
          />
          <ReferenceSlider
            label="Strength"
            value={reference.strength}
            min={0}
            max={1}
            step={0.05}
            precision={2}
            onChange={(value) =>
              state().setPreciseReferenceStrength(reference.id, value)
            }
          />
          <ReferenceSlider
            label="Fidelity"
            value={reference.fidelity}
            min={0}
            max={1}
            step={0.05}
            precision={2}
            onChange={(value) =>
              state().setPreciseReferenceFidelity(reference.id, value)
            }
          />
        </ReferenceItem>
      ))}
    </ReferenceSection>
  );
});
