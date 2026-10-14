import { useEffect, useRef, useState } from "react";

import { getImagePromptTokenPolicy } from "../constants/models";
import {
  calculatePromptTokenMetrics,
  type PromptTokenMetrics,
  type PromptTokenTarget,
} from "../lib/promptTokens/metrics";
import { useGenerationStore } from "../store/generationStore";
import { usePromptChunkStore } from "../store/promptChunkStore";

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
  const qualityPreset = useGenerationStore((state) => state.qualityPreset);
  const transparentBackground = useGenerationStore(
    (state) => state.transparentBackground,
  );
  const ucPreset = useGenerationStore((state) => state.ucPreset);
  const characterPrompts = useGenerationStore(
    (state) => state.characterPrompts,
  );
  const chunks = usePromptChunkStore((state) => state.chunks);
  const [metrics, setMetrics] = useState(() => createInitialMetrics(model));
  const requestIdRef = useRef(0);
  const targetScope = target.scope;
  const targetChannel = target.channel;
  const targetCharacterId =
    target.scope === "character" ? target.characterId : "";

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
          qualityPreset,
          transparentBackground,
          ucPreset,
          characterPrompts,
          chunks,
        },
        targetScope === "base"
          ? { scope: targetScope, channel: targetChannel }
          : {
              scope: targetScope,
              channel: targetChannel,
              characterId: targetCharacterId,
            },
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
    chunks,
    draftText,
    model,
    negativePrompt,
    prompt,
    qualityPreset,
    targetScope,
    targetChannel,
    targetCharacterId,
    transparentBackground,
    ucPreset,
  ]);

  return metrics;
}
