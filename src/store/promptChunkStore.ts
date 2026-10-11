import { create } from "zustand";

import {
  parsePromptChunkDocument,
  type PromptChunk,
  type PromptChunkCategory,
} from "../lib/promptChunks";
import { storage } from "../lib/storage";

const PROMPT_CHUNKS_STORAGE_KEY = "nai_prompt_chunks_v1";

type PromptChunkState = {
  chunks: PromptChunk[];
  categories: PromptChunkCategory[];
};

const initial = parsePromptChunkDocument(
  storage.getString(PROMPT_CHUNKS_STORAGE_KEY),
);

// 변경은 promptChunkActions의 함수로만 한다.
export const usePromptChunkStore = create<PromptChunkState>(() => ({
  chunks: initial.chunks,
  categories: initial.categories,
}));

usePromptChunkStore.subscribe(({ chunks, categories }) => {
  storage.set(
    PROMPT_CHUNKS_STORAGE_KEY,
    JSON.stringify({ version: 1, chunks, categories }),
  );
});
