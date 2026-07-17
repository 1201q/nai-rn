import { memo, useCallback } from "react";

import {
  MODELS,
  NOISE_SCHEDULES,
  SAMPLERS,
  type NoiseSchedule,
} from "../../constants/generation";
import { useGenerationStore } from "../../store/generationStore";
import {
  RendraSelectionSheet,
  type RendraSelectionOption,
} from "./RendraSelectionSheet";

export type RendraGenerationOptionRoute = "model" | "sampler" | "schedule";

const MODEL_OPTIONS: readonly RendraSelectionOption<string>[] = MODELS.map(
  ({ label, value }) => ({
    label,
    value,
    recommended: value === "nai-diffusion-4-5-full",
  }),
);

const SAMPLER_OPTIONS: readonly RendraSelectionOption<string>[] = SAMPLERS.map(
  ({ label, value }) => ({
    label,
    value,
    recommended: value === "k_euler_ancestral",
  }),
);

const SCHEDULE_OPTIONS: readonly RendraSelectionOption<string>[] =
  NOISE_SCHEDULES.map(({ label, value }) => ({
    label,
    value,
    recommended: value === "karras",
  }));

export const RendraGenerationOptionSheet = memo(
  function RendraGenerationOptionSheet({
    route,
    onSelect,
  }: {
    route: RendraGenerationOptionRoute;
    onSelect: () => void;
  }) {
    const model = useGenerationStore((state) => state.model);
    const setModel = useGenerationStore((state) => state.setModel);
    const sampler = useGenerationStore((state) => state.sampler);
    const setSampler = useGenerationStore((state) => state.setSampler);
    const noiseSchedule = useGenerationStore((state) => state.noiseSchedule);
    const setNoiseSchedule = useGenerationStore(
      (state) => state.setNoiseSchedule,
    );

    const selectedValue =
      route === "model"
        ? model
        : route === "sampler"
          ? sampler
          : noiseSchedule;
    const options =
      route === "model"
        ? MODEL_OPTIONS
        : route === "sampler"
          ? SAMPLER_OPTIONS
          : SCHEDULE_OPTIONS;

    const handleSelect = useCallback(
      (value: string) => {
        if (route === "model") setModel(value);
        else if (route === "sampler") setSampler(value);
        else setNoiseSchedule(value as NoiseSchedule);
        onSelect();
      },
      [onSelect, route, setModel, setNoiseSchedule, setSampler],
    );

    return (
      <RendraSelectionSheet
        options={options}
        selectedValue={selectedValue}
        onSelect={handleSelect}
      />
    );
  },
);
