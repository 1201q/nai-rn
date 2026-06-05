import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  type GenerationRecord,
  initGenerationHistoryStorage,
  listGenerations,
  resolveGenerationImageUri,
  resolveGenerationThumbnailUri,
  saveGenerationImage,
} from "../lib/generationHistory";
import {
  type GenerateNovelAiCharacterPrompt,
  generateNovelAiImage,
} from "../lib/novelai";
import { getNovelAiToken, saveNovelAiToken } from "../lib/secureToken";
import {
  DEFAULT_NAI_RESOLUTION,
  NAI_RESOLUTIONS,
  type NaiResolution,
  type NoiseSchedule,
} from "../constants/generation";

const GENERATION_OPTIONS_STORAGE_KEY = "nai_generation_options_v1";
const MAX_CHARACTER_PROMPTS = 6;

export type CharacterPrompt = {
  id: string;
  prompt: string;
  negativePrompt: string;
  enabled: boolean;
};

type PersistedGenerationOptions = Partial<{
  prompt: string;
  negativePrompt: string;
  characterPrompts: CharacterPrompt[];
  model: string;
  resolution: NaiResolution;
  steps: number;
  promptGuidance: number;
  promptGuidanceRescale: number;
  noiseSchedule: NoiseSchedule;
  sampler: string;
  seed: number;
  seedLocked: boolean;
  outputCount: number;
  varietyPlus: boolean;
  optionTabIndex: number;
}>;

function generateRandomSeed(): number {
  return Math.floor(Math.random() * 4_294_967_295);
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isNoiseSchedule(value: unknown): value is NoiseSchedule {
  return (
    value === "native" ||
    value === "karras" ||
    value === "exponential" ||
    value === "polyexponential"
  );
}

function resolveStoredResolution(value: unknown): NaiResolution | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<NaiResolution>;
  if (!isNumber(candidate.width) || !isNumber(candidate.height)) {
    return null;
  }

  for (const group of NAI_RESOLUTIONS) {
    const preset = group.options.find(
      (item) =>
        item.width === candidate.width && item.height === candidate.height,
    );
    if (preset) {
      return preset;
    }
  }

  return {
    label: isString(candidate.label) ? candidate.label : "Custom Resolution",
    width: candidate.width,
    height: candidate.height,
  };
}

function resolveStoredCharacterPrompts(value: unknown): CharacterPrompt[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.slice(0, MAX_CHARACTER_PROMPTS).flatMap((item, index) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const candidate = item as Partial<CharacterPrompt>;
    return [
      {
        id: isString(candidate.id)
          ? candidate.id
          : `stored-character-${index}`,
        prompt: isString(candidate.prompt) ? candidate.prompt : "",
        negativePrompt: isString(candidate.negativePrompt)
          ? candidate.negativePrompt
          : "",
        enabled: isBoolean(candidate.enabled) ? candidate.enabled : true,
      },
    ];
  });
}

function resolveActiveCharacterPrompts(
  characterPrompts: CharacterPrompt[],
): GenerateNovelAiCharacterPrompt[] {
  return characterPrompts.flatMap((item) => {
    if (!item.enabled) {
      return [];
    }

    const prompt = item.prompt.trim();
    const negativePrompt = item.negativePrompt.trim();
    if (!prompt && !negativePrompt) {
      return [];
    }

    return [{ prompt, negativePrompt }];
  });
}

type GenerationOptionsContextValue = {
  // 프롬프트
  prompt: string;
  setPrompt: (v: string) => void;
  negativePrompt: string;
  setNegativePrompt: (v: string) => void;
  characterPrompts: CharacterPrompt[];
  setCharacterPrompts: (v: CharacterPrompt[]) => void;

  // 옵션
  model: string;
  setModel: (v: string) => void;
  resolution: NaiResolution;
  setResolution: (v: NaiResolution) => void;
  steps: number;
  setSteps: (v: number) => void;
  promptGuidance: number;
  setPromptGuidance: (v: number) => void;
  promptGuidanceRescale: number;
  setPromptGuidanceRescale: (v: number) => void;
  noiseSchedule: NoiseSchedule;
  setNoiseSchedule: (v: NoiseSchedule) => void;
  sampler: string;
  setSampler: (v: string) => void;
  seed: number;
  setSeed: (v: number) => void;
  seedLocked: boolean;
  setSeedLocked: (v: boolean) => void;
  outputCount: number;
  setOutputCount: (v: number) => void;
  varietyPlus: boolean;
  setVarietyPlus: (v: boolean) => void;
  optionTabIndex: number;
  setOptionTabIndex: (v: number) => void;
  hasLoadedOptions: boolean;

  // 토큰
  storedToken: string | null;
  saveToken: (token: string) => Promise<void>;

  // 생성 결과
  currentGeneration: GenerationRecord | null;
  currentImageUri: string | null;
  generationHistory: GenerationRecord[];
  resolveGenerationImageUri: (record: GenerationRecord) => string;
  resolveGenerationThumbnailUri: (record: GenerationRecord) => string | null;

  // 생성 상태
  isLoading: boolean;
  message: string | null;
  setMessage: (v: string | null) => void;
  generateImage: (onSuccess?: () => void) => Promise<void>;
};

const GenerationOptionsContext =
  createContext<GenerationOptionsContextValue | null>(null);

export function GenerationOptionsProvider({ children }: { children: ReactNode }) {
  const [prompt, setPrompt] = useState(
    "silver-haired mage, under moonlight, arcane magic circle, purple runes, starry night",
  );
  const [negativePrompt, setNegativePrompt] = useState(
    "low quality, blurry, watermark, text",
  );
  const [characterPrompts, setCharacterPrompts] = useState<CharacterPrompt[]>(
    [],
  );
  const [model, setModel] = useState("nai-diffusion-4-5-full");
  const [resolution, setResolution] = useState<NaiResolution>(
    DEFAULT_NAI_RESOLUTION,
  );
  const [steps, setSteps] = useState(28);
  const [promptGuidance, setPromptGuidance] = useState(5);
  const [promptGuidanceRescale, setPromptGuidanceRescale] = useState(0);
  const [noiseSchedule, setNoiseSchedule] = useState<NoiseSchedule>("karras");
  const [sampler, setSampler] = useState("k_euler_ancestral");
  const [seed, setSeed] = useState(generateRandomSeed);
  const [seedLocked, setSeedLocked] = useState(false);
  const [outputCount, setOutputCount] = useState(1);
  const [varietyPlus, setVarietyPlus] = useState(false);
  const [optionTabIndex, setOptionTabIndex] = useState(0);

  const [storedToken, setStoredToken] = useState<string | null>(null);
  const [currentGeneration, setCurrentGeneration] =
    useState<GenerationRecord | null>(null);
  const [generationHistory, setGenerationHistory] = useState<
    GenerationRecord[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [hasLoadedOptions, setHasLoadedOptions] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(GENERATION_OPTIONS_STORAGE_KEY)
      .then((storedOptions) => {
        if (!storedOptions) return;

        const parsed = JSON.parse(storedOptions) as PersistedGenerationOptions;
        if (isString(parsed.prompt)) setPrompt(parsed.prompt);
        if (isString(parsed.negativePrompt)) {
          setNegativePrompt(parsed.negativePrompt);
        }
        setCharacterPrompts(
          resolveStoredCharacterPrompts(parsed.characterPrompts),
        );
        if (isString(parsed.model)) setModel(parsed.model);

        const storedResolution = resolveStoredResolution(parsed.resolution);
        if (storedResolution) setResolution(storedResolution);

        if (isNumber(parsed.steps)) setSteps(parsed.steps);
        if (isNumber(parsed.promptGuidance)) {
          setPromptGuidance(parsed.promptGuidance);
        }
        if (isNumber(parsed.promptGuidanceRescale)) {
          setPromptGuidanceRescale(parsed.promptGuidanceRescale);
        }
        if (isNoiseSchedule(parsed.noiseSchedule)) {
          setNoiseSchedule(parsed.noiseSchedule);
        }
        if (isString(parsed.sampler)) setSampler(parsed.sampler);
        if (isNumber(parsed.seed)) setSeed(parsed.seed);
        if (isBoolean(parsed.seedLocked)) setSeedLocked(parsed.seedLocked);
        if (isNumber(parsed.outputCount)) setOutputCount(parsed.outputCount);
        if (isBoolean(parsed.varietyPlus)) setVarietyPlus(parsed.varietyPlus);
        if (
          isNumber(parsed.optionTabIndex) &&
          (parsed.optionTabIndex === 0 || parsed.optionTabIndex === 1)
        ) {
          setOptionTabIndex(parsed.optionTabIndex);
        }
      })
      .catch((error: unknown) => {
        setMessage(error instanceof Error ? error.message : String(error));
      })
      .finally(() => setHasLoadedOptions(true));
  }, []);

  useEffect(() => {
    if (!hasLoadedOptions) return;

    const nextOptions: PersistedGenerationOptions = {
      prompt,
      negativePrompt,
      characterPrompts,
      model,
      resolution,
      steps,
      promptGuidance,
      promptGuidanceRescale,
      noiseSchedule,
      sampler,
      // 시드는 잠금일 때만 저장 (NAIS2 동일)
      ...(seedLocked ? { seed } : {}),
      seedLocked,
      outputCount,
      varietyPlus,
      optionTabIndex,
    };

    AsyncStorage.setItem(
      GENERATION_OPTIONS_STORAGE_KEY,
      JSON.stringify(nextOptions),
    ).catch((error: unknown) => {
      setMessage(error instanceof Error ? error.message : String(error));
    });
  }, [
    hasLoadedOptions,
    prompt,
    negativePrompt,
    characterPrompts,
    model,
    resolution,
    steps,
    promptGuidance,
    promptGuidanceRescale,
    noiseSchedule,
    sampler,
    seed,
    seedLocked,
    outputCount,
    varietyPlus,
    optionTabIndex,
  ]);

  useEffect(() => {
    getNovelAiToken()
      .then(setStoredToken)
      .catch((error: unknown) => {
        setMessage(error instanceof Error ? error.message : String(error));
      });
  }, []);

  useEffect(() => {
    initGenerationHistoryStorage()
      .then(listGenerations)
      .then((records) => {
        setGenerationHistory(records);
        setCurrentGeneration((current) => current ?? records[0] ?? null);
      })
      .catch((error: unknown) => {
        setMessage(error instanceof Error ? error.message : String(error));
      });
  }, []);

  async function saveToken(token: string) {
    await saveNovelAiToken(token);
    setStoredToken(token);
  }

  async function generateImage(onSuccess?: () => void) {
    if (!storedToken) {
      setMessage("저장된 NovelAI 토큰이 없습니다.");
      return;
    }

    if (!prompt.trim()) {
      setMessage("프롬프트를 입력해주세요.");
      return;
    }

    // 이번 생성에 쓸 시드 확정 후, 잠금이 아니면 즉시 다음 시드로 advance (UI에 다음 시드 표시)
    let currentSeed = seed;
    if (currentSeed === 0) {
      currentSeed = generateRandomSeed();
    }
    if (!seedLocked) {
      setSeed(generateRandomSeed());
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const activeCharacterPrompts =
        resolveActiveCharacterPrompts(characterPrompts);
      const result = await generateNovelAiImage({
        token: storedToken,
        prompt: prompt.trim(),
        negativePrompt: negativePrompt.trim(),
        characterPrompts: activeCharacterPrompts,
        model,
        width: resolution.width,
        height: resolution.height,
        steps,
        promptGuidance,
        promptGuidanceRescale,
        noiseSchedule,
        sampler,
        seed: currentSeed,
        nSamples: outputCount,
        varietyPlus,
      });

      const generation = await saveGenerationImage({
        imageBytes: result.imageBytes,
        prompt: prompt.trim(),
        negativePrompt: negativePrompt.trim(),
        model,
        width: resolution.width,
        height: resolution.height,
        steps,
        scale: promptGuidance,
        cfgRescale: promptGuidanceRescale,
        noiseSchedule,
        sampler,
        seed: result.seed,
        metadata: result.metadata,
      });

      setCurrentGeneration(generation);
      setGenerationHistory((records) => [generation, ...records]);
      onSuccess?.();
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <GenerationOptionsContext.Provider
      value={{
        prompt,
        setPrompt,
        negativePrompt,
        setNegativePrompt,
        characterPrompts,
        setCharacterPrompts,
        model,
        setModel,
        resolution,
        setResolution,
        steps,
        setSteps,
        promptGuidance,
        setPromptGuidance,
        promptGuidanceRescale,
        setPromptGuidanceRescale,
        noiseSchedule,
        setNoiseSchedule,
        sampler,
        setSampler,
        seed,
        setSeed,
        seedLocked,
        setSeedLocked,
        outputCount,
        setOutputCount,
        varietyPlus,
        setVarietyPlus,
        optionTabIndex,
        setOptionTabIndex,
        hasLoadedOptions,
        storedToken,
        saveToken,
        currentGeneration,
        currentImageUri: currentGeneration
          ? resolveGenerationImageUri(currentGeneration)
          : null,
        generationHistory,
        resolveGenerationImageUri,
        resolveGenerationThumbnailUri,
        isLoading,
        message,
        setMessage,
        generateImage,
      }}
    >
      {children}
    </GenerationOptionsContext.Provider>
  );
}

export function useGenerationOptions(): GenerationOptionsContextValue {
  const ctx = useContext(GenerationOptionsContext);
  if (!ctx) {
    throw new Error(
      "useGenerationOptions must be used within GenerationOptionsProvider",
    );
  }
  return ctx;
}
