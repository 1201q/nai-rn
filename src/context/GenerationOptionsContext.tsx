import { type ReactNode } from "react";

import {
  type CharacterPrompt,
  useGenerationBootstrap,
} from "../store/generationStore";

export type { CharacterPrompt };

export function GenerationOptionsProvider({ children }: { children: ReactNode }) {
  useGenerationBootstrap();
  return <>{children}</>;
}
