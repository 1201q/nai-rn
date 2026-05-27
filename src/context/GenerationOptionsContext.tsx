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
import { generateNovelAiImage } from "../lib/novelai";
import { getNovelAiToken, saveNovelAiToken } from "../lib/secureToken";
import {
  DEFAULT_NAI_RESOLUTION,
  NAI_RESOLUTIONS,
  type NaiResolution,
  type NoiseSchedule,
} from "../constants/generation";

const GENERATION_OPTIONS_STORAGE_KEY = "nai_generation_options_v1";

type PersistedGenerationOptions = Partial<{
  prompt: string;
  negativePrompt: string;
  model: string;
  resolution: NaiResolution;
  steps: number;
  promptGuidance: number;
  promptGuidanceRescale: number;
  noiseSchedule: NoiseSchedule;
  sampler: string;
  seedText: string;
  outputCount: number;
  optionTabIndex: number;
}>;

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
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

type GenerationOptionsContextValue = {
  // 프롬프트
  prompt: string;
  setPrompt: (v: string) => void;
  negativePrompt: string;
  setNegativePrompt: (v: string) => void;

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
  seedText: string;
  setSeedText: (v: string) => void;
  outputCount: number;
  setOutputCount: (v: number) => void;
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
  const [model, setModel] = useState("nai-diffusion-4-5-full");
  const [resolution, setResolution] = useState<NaiResolution>(
    DEFAULT_NAI_RESOLUTION,
  );
  const [steps, setSteps] = useState(28);
  const [promptGuidance, setPromptGuidance] = useState(5);
  const [promptGuidanceRescale, setPromptGuidanceRescale] = useState(0);
  const [noiseSchedule, setNoiseSchedule] = useState<NoiseSchedule>("karras");
  const [sampler, setSampler] = useState("k_euler_ancestral");
  const [seedText, setSeedText] = useState("");
  const [outputCount, setOutputCount] = useState(1);
  const [optionTabIndex, setOptionTabIndex] = useState(1);

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
        if (isString(parsed.seedText)) setSeedText(parsed.seedText);
        if (isNumber(parsed.outputCount)) setOutputCount(parsed.outputCount);
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
      model,
      resolution,
      steps,
      promptGuidance,
      promptGuidanceRescale,
      noiseSchedule,
      sampler,
      seedText,
      outputCount,
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
    model,
    resolution,
    steps,
    promptGuidance,
    promptGuidanceRescale,
    noiseSchedule,
    sampler,
    seedText,
    outputCount,
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

    const fixedSeed = Number.parseInt(seedText.trim(), 10);

    setIsLoading(true);
    setMessage(null);

    try {
      const result = await generateNovelAiImage({
        token: storedToken,
        prompt: prompt.trim(),
        negativePrompt: negativePrompt.trim(),
        model,
        width: resolution.width,
        height: resolution.height,
        steps,
        promptGuidance,
        promptGuidanceRescale,
        noiseSchedule,
        sampler,
        seed: Number.isFinite(fixedSeed) ? fixedSeed : undefined,
        nSamples: outputCount,
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
        seedText,
        setSeedText,
        outputCount,
        setOutputCount,
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
