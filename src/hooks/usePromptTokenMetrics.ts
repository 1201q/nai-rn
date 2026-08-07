import { useEffect, useRef, useState } from "react";

import { getImagePromptTokenPolicy } from "../constants/generation";
import {
  calculatePromptTokenMetrics,
  type PromptTokenMetrics,
  type PromptTokenTarget,
} from "../lib/promptTokens/metrics";
import { useGenerationStore } from "../store/generationStore";

const TOKEN_COUNT_DEBOUNCE_MS = 250;

function createInitialMetrics(model: string): PromptTokenMetrics {
  const policy = getImagePromptTokenPolicy(model);
  return policy
    ? {
        status: "loading",
        fieldTokens: null,
        totalTokens: null,
        maxTokens: policy.maxTokens,
        remainingTokens: null,
        includedInTotal: false,
      }
    : {
        status: "unavailable",
        fieldTokens: null,
        totalTokens: null,
        maxTokens: null,
        remainingTokens: null,
        includedInTotal: false,
      };
}

export function usePromptTokenMetrics(
  target: PromptTokenTarget,
  draftText: string,
): PromptTokenMetrics {
  const model = useGenerationStore((state) => state.model);
  const prompt = useGenerationStore((state) => state.prompt);
  const negativePrompt = useGenerationStore((state) => state.negativePrompt);
  const qualityToggle = useGenerationStore((state) => state.qualityToggle);
  const ucPreset = useGenerationStore((state) => state.ucPreset);
  const characterPrompts = useGenerationStore(
    (state) => state.characterPrompts,
  );
  const [metrics, setMetrics] = useState(() => createInitialMetrics(model));
  const requestIdRef = useRef(0);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    const policy = getImagePromptTokenPolicy(model);
    if (!policy) {
      setMetrics(createInitialMetrics(model));
      return;
    }

    setMetrics((current) =>
      current.maxTokens === policy.maxTokens
        ? current
        : createInitialMetrics(model),
    );
    const timeout = setTimeout(() => {
      calculatePromptTokenMetrics(
        {
          model,
          prompt,
          negativePrompt,
          qualityToggle,
          ucPreset,
          characterPrompts,
        },
        target,
        draftText,
      )
        .then((next) => {
          if (requestIdRef.current === requestId) setMetrics(next);
        })
        .catch(() => {
          if (requestIdRef.current !== requestId) return;
          setMetrics({
            status: "error",
            fieldTokens: null,
            totalTokens: null,
            maxTokens: policy.maxTokens,
            remainingTokens: null,
            includedInTotal: false,
          });
        });
    }, TOKEN_COUNT_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [
    characterPrompts,
    draftText,
    model,
    negativePrompt,
    prompt,
    qualityToggle,
    target,
    ucPreset,
  ]);

  return metrics;
}
