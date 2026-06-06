import { type ReactNode } from "react";

import {
  type GenerationRecord,
  resolveGenerationImageUri,
  resolveGenerationThumbnailUri,
} from "../lib/generationHistory";
import {
  type CharacterPrompt,
  type GenerationState,
  useGenerationBootstrap,
  useGenerationStore,
} from "../store/generationStore";

export type { CharacterPrompt };

// 레거시 consumer 호환 shim. 스토어 전체를 구독해 기존 context와 동일한 객체를 반환한다.
// (granular selector가 필요한 새 컴포넌트는 useGenerationStore를 직접 사용)
type GenerationOptionsContextValue = GenerationState & {
  currentImageUri: string | null;
  resolveGenerationImageUri: (record: GenerationRecord) => string;
  resolveGenerationThumbnailUri: (record: GenerationRecord) => string | null;
};

export function GenerationOptionsProvider({ children }: { children: ReactNode }) {
  useGenerationBootstrap();
  return <>{children}</>;
}

export function useGenerationOptions(): GenerationOptionsContextValue {
  const state = useGenerationStore();
  return {
    ...state,
    currentImageUri: state.currentGeneration
      ? resolveGenerationImageUri(state.currentGeneration)
      : null,
    resolveGenerationImageUri,
    resolveGenerationThumbnailUri,
  };
}
