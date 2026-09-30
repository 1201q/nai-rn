import { memo } from "react";

import { useGenerationStore } from "../../../store/generationStore";
import {
  ReferenceItem,
  ReferenceSection,
  ReferenceSlider,
} from "./ReferenceParts";
import { useReferenceUpload } from "./useReferenceUpload";

export const ImageToImageReferenceCard = memo(
  function ImageToImageReferenceCard() {
    const source = useGenerationStore((state) => state.i2iSourceImage);
    const enabled = useGenerationStore((state) => state.i2iEnabled);
    const strength = useGenerationStore((state) => state.i2iStrength);
    const noise = useGenerationStore((state) => state.i2iNoise);
    const { busy, pickImage } = useReferenceUpload("i2i");
    const state = useGenerationStore.getState;
    return (
      <ReferenceSection
        group
        title="Image2Image"
        description="이미지를 변형합니다."
        icon="color-wand-outline"
        count={source ? 1 : 0}
        activeCount={source && enabled ? 1 : 0}
        limit={1}
        busy={busy}
        onAdd={() => void pickImage()}
        onReplace={() => void pickImage()}
      >
        {source ? (
          <ReferenceItem
            first
            name="I2I 이미지"
            uri={source.uri}
            enabled={enabled}
            onToggle={(value) => state().setI2IEnabled(value)}
            onRemove={() => state().clearI2I()}
          >
            <ReferenceSlider
              label="Strength"
              value={strength}
              min={0.01}
              max={0.99}
              step={0.01}
              precision={2}
              onChange={(value) => state().setI2IStrength(value)}
            />
            <ReferenceSlider
              label="Noise"
              value={noise}
              min={0}
              max={0.99}
              step={0.01}
              precision={2}
              onChange={(value) => state().setI2INoise(value)}
            />
          </ReferenceItem>
        ) : null}
      </ReferenceSection>
    );
  },
);
