import { memo, useCallback } from "react";

import {
  MODELS,
  NOISE_SCHEDULES,
  SAMPLERS,
  type NoiseSchedule,
} from "../../constants/generation";
import { useGenerationStore } from "../../store/generationStore";
import {
  SelectionSheet,
  type SelectionOption,
} from "./SelectionSheet";

export type GenerationOptionRoute = "model" | "sampler" | "schedule";

const MODEL_OPTIONS: readonly SelectionOption<string>[] = MODELS.map(
  ({ label, value }) => ({
    label,
    value,
    recommended: value === "nai-diffusion-4-5-full",
  }),
);

const SAMPLER_OPTIONS: readonly SelectionOption<string>[] = SAMPLERS.map(
  ({ label, value }) => ({
    label,
    value,
    recommended: value === "k_euler_ancestral",
  }),
);

const SCHEDULE_OPTIONS: readonly SelectionOption<string>[] =
  NOISE_SCHEDULES.map(({ label, value }) => ({
    label,
    value,
    recommended: value === "karras",
  }));

export const GenerationOptionSheet = memo(
  function GenerationOptionSheet({
    route,
    onSelect,
  }: {
    route: GenerationOptionRoute;
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
      <SelectionSheet
        options={options}
        selectedValue={selectedValue}
        onSelect={handleSelect}
      />
    );
  },
);
