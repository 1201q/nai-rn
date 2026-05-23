import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { generateNovelAiImage } from "../lib/novelai";
import { getNovelAiToken, saveNovelAiToken } from "../lib/secureToken";
import {
  ASPECT_DIMENSIONS,
  type AspectRatio,
} from "../constants/generation";

type GenerationOptionsContextValue = {
  // 프롬프트
  prompt: string;
  setPrompt: (v: string) => void;
  negativePrompt: string;
  setNegativePrompt: (v: string) => void;

  // 옵션
  model: string;
  setModel: (v: string) => void;
  aspectRatio: AspectRatio;
  setAspectRatio: (v: AspectRatio) => void;
  steps: number;
  setSteps: (v: number) => void;
  scale: number;
  setScale: (v: number) => void;
  sampler: string;
  setSampler: (v: string) => void;
  seedText: string;
  setSeedText: (v: string) => void;
  outputCount: number;
  setOutputCount: (v: number) => void;

  // 토큰
  storedToken: string | null;
  saveToken: (token: string) => Promise<void>;

  // 생성 결과
  imageDataUri: string | null;
  generatedDimensions: { width: number; height: number } | null;

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
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("3:4");
  const [steps, setSteps] = useState(28);
  const [scale, setScale] = useState(5);
  const [sampler, setSampler] = useState("k_euler_ancestral");
  const [seedText, setSeedText] = useState("");
  const [outputCount, setOutputCount] = useState(1);

  const [storedToken, setStoredToken] = useState<string | null>(null);
  const [imageDataUri, setImageDataUri] = useState<string | null>(null);
  const [generatedDimensions, setGeneratedDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    getNovelAiToken()
      .then(setStoredToken)
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
    const dimensions = ASPECT_DIMENSIONS[aspectRatio];

    setIsLoading(true);
    setMessage(null);

    try {
      const result = await generateNovelAiImage({
        token: storedToken,
        prompt: prompt.trim(),
        negativePrompt: negativePrompt.trim(),
        model,
        width: dimensions.width,
        height: dimensions.height,
        steps,
        scale,
        sampler,
        seed: Number.isFinite(fixedSeed) ? fixedSeed : undefined,
        nSamples: outputCount,
      });

      setImageDataUri(result.imageDataUri);
      setGeneratedDimensions(dimensions);
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
        aspectRatio,
        setAspectRatio,
        steps,
        setSteps,
        scale,
        setScale,
        sampler,
        setSampler,
        seedText,
        setSeedText,
        outputCount,
        setOutputCount,
        storedToken,
        saveToken,
        imageDataUri,
        generatedDimensions,
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
